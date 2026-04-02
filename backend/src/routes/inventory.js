const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

// Validación de datos para crear/actualizar insumo
const inventoryItemSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  category: z.string().default('GENERAL'),
  unit: z.string().default('unidad'),
  currentStock: z.number().int().nonnegative('Stock no puede ser negativo'),
  minStockAlert: z.number().int().nonnegative('Alerta debe ser >= 0'),
  costPerUnit: z.number().nonnegative('Costo debe ser >= 0'),
  supplier: z.string().optional(),
});

// GET /api/inventory — listar insumos
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
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
      success: true, data: items,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
});

// GET /api/inventory/alerts — insumos con stock bajo
router.get('/alerts', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const alerts = await req.prisma.$queryRaw`
      SELECT * FROM "InventoryItem" WHERE "currentStock" <= "minStockAlert" ORDER BY "currentStock" ASC
    `;
    res.json({ success: true, data: alerts });
  } catch (err) { next(err); }
});

// POST /api/inventory — crear insumo
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateBody(inventoryItemSchema), async (req, res, next) => {
  try {
    const item = await req.prisma.inventoryItem.create({ data: req.validatedBody });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
});

// PUT /api/inventory/:id — actualizar insumo
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateBody(inventoryItemSchema.partial()), async (req, res, next) => {
  try {
    const item = await req.prisma.inventoryItem.update({ where: { id: req.params.id }, data: req.validatedBody });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
});

// DELETE /api/inventory/:id — eliminar insumo
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    await req.prisma.inventoryItem.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Insumo eliminado' });
  } catch (err) { next(err); }
});

module.exports = router;
