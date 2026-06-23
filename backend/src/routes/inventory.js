const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const inventoryService = require('../services/inventoryService');

const adminOnly = [authenticate, authorize('SUPER_ADMIN', 'ADMIN')];

// Validación de datos para crear/actualizar insumo
const inventoryItemSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  sku: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().default('GENERAL'),
  unit: z.string().min(1, 'Unidad requerida').default('unidad'),
  currentStock: z.number().int().nonnegative('Stock no puede ser negativo'),
  minStockAlert: z.number().int().nonnegative('Alerta debe ser >= 0'),
  maxStock: z.number().int().nonnegative().optional(),
  location: z.string().optional(),
  costPerUnit: z.number().int().nonnegative('Costo debe ser >= 0').default(0),
  supplier: z.string().optional(),
  supplierId: z.string().optional(),
  expiresAt: z.string().datetime().optional().or(z.string().length(0)),
  isActive: z.boolean().optional(),
});

// Ajuste de stock (entrada/salida): delta puede ser negativo
const stockAdjustSchema = z.object({
  delta: z.number().int().refine((v) => v !== 0, 'El ajuste no puede ser 0'),
  reason: z.string().optional(),
});

// Movimiento manual de stock
const movementSchema = z.object({
  itemId: z.string().min(1),
  type: z.enum(['IN', 'ADJUSTMENT', 'WASTE', 'RETURN']),
  quantity: z.number().int().positive(),
  reason: z.string().optional(),
  unitCostGs: z.number().int().nonnegative().optional(),
  supplierId: z.string().optional(),
});

const supplierSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

const recipeSchema = z.object({
  serviceId: z.string().min(1),
  itemId: z.string().min(1),
  vehicleSize: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
});

// GET /api/inventory — listar insumos (con búsqueda, filtro de categoría y paginación)
router.get('/', ...adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, category } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (category) where.category = category;

    const [items, total] = await Promise.all([
      req.prisma.inventoryItem.findMany({ where, skip, take: parseInt(limit), orderBy: { name: 'asc' } }),
      req.prisma.inventoryItem.count({ where }),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
});

// GET /api/inventory/stats — KPIs reales del inventario
router.get('/stats', ...adminOnly, async (req, res, next) => {
  try {
    const items = await req.prisma.inventoryItem.findMany({
      select: { currentStock: true, minStockAlert: true, costPerUnit: true },
    });

    const totalItems = items.length;
    let lowStock = 0;
    let outOfStock = 0;
    let inventoryValueGs = 0;

    for (const it of items) {
      if (it.currentStock <= 0) outOfStock += 1;
      else if (it.currentStock <= it.minStockAlert) lowStock += 1;
      inventoryValueGs += (it.currentStock || 0) * (it.costPerUnit || 0);
    }

    res.json({ success: true, data: { totalItems, lowStock, outOfStock, inventoryValueGs } });
  } catch (err) { next(err); }
});

// GET /api/inventory/alerts — insumos con stock <= alerta mínima
router.get('/alerts', ...adminOnly, async (req, res, next) => {
  try {
    // El @@map real de la tabla es "inventory_items" (no "InventoryItem").
    const alerts = await req.prisma.$queryRaw`
      SELECT * FROM "inventory_items"
      WHERE "current_stock" <= "min_stock_alert"
      ORDER BY "current_stock" ASC
    `;
    // Normalizar a camelCase para el frontend
    const data = alerts.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      unit: a.unit,
      currentStock: a.current_stock,
      minStockAlert: a.min_stock_alert,
      costPerUnit: a.cost_per_unit,
      supplier: a.supplier,
    }));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/inventory — crear insumo
router.post('/', ...adminOnly, validateBody(inventoryItemSchema), async (req, res, next) => {
  try {
    const data = { ...req.validatedBody };
    data.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    const item = await req.prisma.inventoryItem.create({ data });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

// PUT /api/inventory/:id — actualizar insumo
router.put('/:id', ...adminOnly, validateBody(inventoryItemSchema.partial()), async (req, res, next) => {
  try {
    const existing = await req.prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Insumo no encontrado' });

    const data = { ...req.validatedBody };
    if ('expiresAt' in data) data.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    const item = await req.prisma.inventoryItem.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// PATCH /api/inventory/:id/adjust — ajuste rápido de stock (entrada/salida)
router.patch('/:id/adjust', ...adminOnly, validateBody(stockAdjustSchema), async (req, res, next) => {
  try {
    const { delta, reason } = req.validatedBody;
    const { item } = await inventoryService.applyMovement(req.prisma, {
      itemId: req.params.id,
      type: delta > 0 ? 'IN' : 'ADJUSTMENT',
      quantity: Math.abs(delta),
      reason: reason || (delta > 0 ? 'Entrada manual' : 'Ajuste / salida manual'),
      userId: req.user.id,
    });
    res.json({ success: true, data: item });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
});

// DELETE /api/inventory/:id — eliminar insumo. Si tiene historial de movimientos
// se desactiva (soft delete) para no romper el ledger; si no, hard delete.
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const existing = await req.prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Insumo no encontrado' });

    const movements = await req.prisma.stockMovement.count({ where: { itemId: req.params.id } });
    if (movements > 0) {
      const item = await req.prisma.inventoryItem.update({ where: { id: req.params.id }, data: { isActive: false } });
      return res.json({ success: true, message: 'Insumo desactivado (tiene historial de movimientos)', data: item });
    }
    await req.prisma.inventoryItem.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Insumo eliminado' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  MOVIMIENTOS DE STOCK (ledger)
// ════════════════════════════════════════════════════════════════

// GET /api/inventory/movements?itemId=&type=&limit= — historial de movimientos
router.get('/movements', ...adminOnly, async (req, res, next) => {
  try {
    const { itemId, type, limit = 100 } = req.query;
    const where = {};
    if (itemId) where.itemId = itemId;
    if (type) where.type = type;
    const movements = await req.prisma.stockMovement.findMany({
      where,
      include: {
        item: { select: { id: true, name: true, unit: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit) || 100, 500),
    });
    res.json({ success: true, data: movements });
  } catch (err) { next(err); }
});

// POST /api/inventory/movements — registrar un movimiento manual (entrada/ajuste/merma/devolución)
router.post('/movements', ...adminOnly, validateBody(movementSchema), async (req, res, next) => {
  try {
    const { itemId, type, quantity, reason, unitCostGs, supplierId } = req.validatedBody;
    const { item, movement } = await inventoryService.applyMovement(req.prisma, {
      itemId, type, quantity, reason, unitCostGs, supplierId, userId: req.user.id,
    });
    res.status(201).json({ success: true, data: { item, movement } });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
});

// ════════════════════════════════════════════════════════════════
//  PROVEEDORES
// ════════════════════════════════════════════════════════════════

router.get('/suppliers', ...adminOnly, async (req, res, next) => {
  try {
    const suppliers = await req.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: suppliers });
  } catch (err) { next(err); }
});

router.post('/suppliers', ...adminOnly, validateBody(supplierSchema), async (req, res, next) => {
  try {
    const supplier = await req.prisma.supplier.create({ data: req.validatedBody });
    res.status(201).json({ success: true, data: supplier });
  } catch (err) { next(err); }
});

router.put('/suppliers/:id', ...adminOnly, validateBody(supplierSchema.partial()), async (req, res, next) => {
  try {
    const supplier = await req.prisma.supplier.update({ where: { id: req.params.id }, data: req.validatedBody });
    res.json({ success: true, data: supplier });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Proveedor no encontrado' });
    next(err);
  }
});

router.delete('/suppliers/:id', ...adminOnly, async (req, res, next) => {
  try {
    // Desvincular items y desactivar (no romper FKs).
    await req.prisma.inventoryItem.updateMany({ where: { supplierId: req.params.id }, data: { supplierId: null } });
    await req.prisma.supplier.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Proveedor desactivado' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Proveedor no encontrado' });
    next(err);
  }
});

// ════════════════════════════════════════════════════════════════
//  RECETAS DE CONSUMO (BOM por servicio)
// ════════════════════════════════════════════════════════════════

// GET /api/inventory/recipes?serviceId= — recetas (con nombres de servicio e insumo)
router.get('/recipes', ...adminOnly, async (req, res, next) => {
  try {
    const where = {};
    if (req.query.serviceId) where.serviceId = req.query.serviceId;
    const recipes = await req.prisma.serviceConsumption.findMany({
      where,
      include: {
        service: { select: { id: true, name: true } },
        item: { select: { id: true, name: true, unit: true, currentStock: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: recipes });
  } catch (err) { next(err); }
});

// POST /api/inventory/recipes — crear/actualizar una línea de receta (upsert por servicio+item+tamaño)
router.post('/recipes', ...adminOnly, validateBody(recipeSchema), async (req, res, next) => {
  try {
    const { serviceId, itemId, vehicleSize = null, quantity } = req.validatedBody;
    const existing = await req.prisma.serviceConsumption.findFirst({
      where: { serviceId, itemId, vehicleSize: vehicleSize || null },
    });
    const recipe = existing
      ? await req.prisma.serviceConsumption.update({ where: { id: existing.id }, data: { quantity } })
      : await req.prisma.serviceConsumption.create({ data: { serviceId, itemId, vehicleSize: vehicleSize || null, quantity } });
    res.status(201).json({ success: true, data: recipe });
  } catch (err) { next(err); }
});

router.delete('/recipes/:id', ...adminOnly, async (req, res, next) => {
  try {
    await req.prisma.serviceConsumption.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Receta eliminada' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Receta no encontrada' });
    next(err);
  }
});

// ════════════════════════════════════════════════════════════════
//  RESUMEN / REPORTES
// ════════════════════════════════════════════════════════════════

// GET /api/inventory/summary — KPIs: valor total, bajo stock, por vencer, consumo del mes
router.get('/summary', ...adminOnly, async (req, res, next) => {
  try {
    const items = await req.prisma.inventoryItem.findMany({
      where: { isActive: true },
      select: { id: true, name: true, unit: true, currentStock: true, minStockAlert: true, maxStock: true, costPerUnit: true, expiresAt: true },
    });

    let inventoryValueGs = 0, lowStock = 0, outOfStock = 0;
    const lowStockItems = [];
    for (const it of items) {
      inventoryValueGs += (it.currentStock || 0) * (it.costPerUnit || 0);
      if (it.currentStock <= 0) { outOfStock += 1; lowStockItems.push(it); }
      else if (it.currentStock <= it.minStockAlert) { lowStock += 1; lowStockItems.push(it); }
    }

    // Por vencer en los próximos 30 días
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    const expiringSoon = items.filter((it) => it.expiresAt && new Date(it.expiresAt) <= in30);

    // Consumo del mes (movimientos CONSUMPTION)
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const consumedThisMonth = await req.prisma.stockMovement.count({
      where: { type: 'CONSUMPTION', createdAt: { gte: monthStart } },
    });

    res.json({
      success: true,
      data: {
        totalItems: items.length,
        inventoryValueGs,
        lowStock,
        outOfStock,
        lowStockItems,
        expiringSoon,
        consumedThisMonth,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
