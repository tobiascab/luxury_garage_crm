const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
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
router.get('/all', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const vehicles = await req.prisma.vehicle.findMany({
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: vehicles });
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

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const vehicle = await req.prisma.vehicle.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
    const updated = await req.prisma.vehicle.update({ where: { id: req.params.id }, data: req.body });
    // ── ARIZAR SYNC
    await syncVehiclesToArizar(req.prisma, req.user.id);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.put('/:id/primary', authenticate, async (req, res, next) => {
  try {
    await req.prisma.vehicle.updateMany({ where: { userId: req.user.id }, data: { isPrimary: false } });
    const vehicle = await req.prisma.vehicle.update({ where: { id: req.params.id }, data: { isPrimary: true } });
    // ── ARIZAR SYNC
    await syncVehiclesToArizar(req.prisma, req.user.id);
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
