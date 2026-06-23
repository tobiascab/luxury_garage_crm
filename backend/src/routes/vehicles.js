const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const ArizarSync = require('../services/arizarSync');

// Helper to sync vehicles to ARIZAR after any mutation
async function syncVehiclesToArizar(prisma, userId) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.arizarContactId) {
      const sync = new ArizarSync(prisma);
      await sync.syncProfileUpdate(user);
    }
  } catch (e) { console.error('ARIZAR vehicle sync error:', e.message); }
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const vehicles = await req.prisma.vehicle.findMany({ where: { userId: req.user.id }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] });
    res.json({ success: true, data: vehicles });
  } catch (err) { next(err); }
});

// Admin: Get all vehicles for the hangar manager
const { authorize } = require('../middleware/auth');
const { z } = require('zod');

router.get('/all', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = {};
    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { brand: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { licensePlate: { contains: q, mode: 'insensitive' } },
        { color: { contains: q, mode: 'insensitive' } },
        { user: { firstName: { contains: q, mode: 'insensitive' } } },
        { user: { lastName: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const vehicles = await req.prisma.vehicle.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: vehicles });
  } catch (err) { next(err); }
});

// Admin: edita el vehículo de cualquier cliente
const adminVehicleSchema = z.object({
  brand: z.string().trim().min(1, 'Marca requerida'),
  model: z.string().trim().min(1, 'Modelo requerido'),
  licensePlate: z.string().trim().min(1, 'Placa requerida'),
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  color: z.string().trim().optional().nullable(),
  size: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

router.put('/admin/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateBody(adminVehicleSchema), async (req, res, next) => {
  try {
    const vehicle = await req.prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
    const { brand, model, licensePlate, year, color, size, notes } = req.validatedBody;
    const updated = await req.prisma.vehicle.update({
      where: { id: req.params.id },
      data: {
        brand, model, licensePlate,
        year: year ?? null,
        color: color || null,
        size: size || null,
        notes: notes || null,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
    });
    // ── ARIZAR SYNC sobre el dueño real del vehículo
    await syncVehiclesToArizar(req.prisma, vehicle.userId);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/admin/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const vehicle = await req.prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
    await req.prisma.vehicle.delete({ where: { id: req.params.id } });
    // ── ARIZAR SYNC sobre el dueño real del vehículo
    await syncVehiclesToArizar(req.prisma, vehicle.userId);
    res.json({ success: true, message: 'Vehículo eliminado' });
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { brand, model, year, color, licensePlate, notes } = req.body;
    if (!brand || !model || !licensePlate) return res.status(400).json({ success: false, message: 'Marca, modelo y placa son requeridos' });
    const count = await req.prisma.vehicle.count({ where: { userId: req.user.id } });
    const vehicle = await req.prisma.vehicle.create({
      data: { userId: req.user.id, brand, model, year: year || null, color: color || null, licensePlate, notes: notes || null, isPrimary: count === 0 }
    });
    // ── ARIZAR SYNC: actualiza vehicle1/vehicle2 en el contacto CRM
    await syncVehiclesToArizar(req.prisma, req.user.id);
    res.status(201).json({ success: true, data: vehicle });
  } catch (err) { next(err); }
});

const isVehicleAdmin = (role) => role === 'SUPER_ADMIN' || role === 'ADMIN';

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const admin = isVehicleAdmin(req.user.role);
    // Ownership: el vehículo debe ser del usuario actual (salvo admin).
    const where = admin ? { id: req.params.id } : { id: req.params.id, userId: req.user.id };
    const vehicle = await req.prisma.vehicle.findFirst({ where });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehículo no encontrado' });

    // Whitelist: solo campos editables. Nunca userId/id/createdAt para evitar mass-assignment.
    const data = {};
    if (req.body.brand !== undefined) data.brand = req.body.brand;
    if (req.body.model !== undefined) data.model = req.body.model;
    if (req.body.year !== undefined) data.year = req.body.year || null;
    if (req.body.color !== undefined) data.color = req.body.color || null;
    if (req.body.licensePlate !== undefined) data.licensePlate = req.body.licensePlate;
    if (req.body.size !== undefined) data.size = req.body.size || null;
    if (req.body.notes !== undefined) data.notes = req.body.notes || null;
    if (req.body.isPrimary !== undefined) data.isPrimary = Boolean(req.body.isPrimary);

    const updated = await req.prisma.vehicle.update({ where: { id: req.params.id }, data });
    // ── ARIZAR SYNC sobre el dueño real del vehículo
    await syncVehiclesToArizar(req.prisma, vehicle.userId);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.put('/:id/primary', authenticate, async (req, res, next) => {
  try {
    const admin = isVehicleAdmin(req.user.role);
    // Ownership: el vehículo debe ser del usuario actual (salvo admin).
    const where = admin ? { id: req.params.id } : { id: req.params.id, userId: req.user.id };
    const target = await req.prisma.vehicle.findFirst({ where });
    if (!target) return res.status(404).json({ success: false, message: 'Vehículo no encontrado' });

    // Atómico: desmarcar primary + marcar el nuevo deben ocurrir juntos.
    // Si no, un fallo del segundo update dejaría al usuario sin vehículo primario.
    const [, vehicle] = await req.prisma.$transaction([
      req.prisma.vehicle.updateMany({ where: { userId: target.userId }, data: { isPrimary: false } }),
      req.prisma.vehicle.update({ where: { id: req.params.id }, data: { isPrimary: true } }),
    ]);
    // ── ARIZAR SYNC sobre el dueño real del vehículo
    await syncVehiclesToArizar(req.prisma, target.userId);
    res.json({ success: true, data: vehicle });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const vehicle = await req.prisma.vehicle.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
    await req.prisma.vehicle.delete({ where: { id: req.params.id } });
    // ── ARIZAR SYNC
    await syncVehiclesToArizar(req.prisma, req.user.id);
    res.json({ success: true, message: 'Vehículo eliminado' });
  } catch (err) { next(err); }
});

module.exports = router;
