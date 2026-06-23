const router = require('express').Router();
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

// Lee el rol del token SIN exigirlo: permite que el admin vea inactivos.
function peekRole(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    return decoded.role || null;
  } catch {
    return null;
  }
}
const isAdmin = (role) => role === 'SUPER_ADMIN' || role === 'ADMIN';

// Validación de datos para crear/actualizar tamaño de vehículo
const vehicleSizeSchema = z.object({
  key: z.string().min(1, 'Clave requerida'),
  label: z.string().min(1, 'Etiqueta requerida'),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// GET / — PÚBLICO: la reserva del cliente consume los tamaños activos.
// Admin con token: ?includeInactive=true ve todos (para reactivarlos).
router.get('/', async (req, res, next) => {
  try {
    const wantsAll = req.query.includeInactive === 'true' && isAdmin(peekRole(req));
    const where = wantsAll ? {} : { isActive: true };
    const sizes = await req.prisma.vehicleSize.findMany({ where, orderBy: { sortOrder: 'asc' } });
    res.json({ success: true, data: sizes });
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateBody(vehicleSizeSchema), async (req, res, next) => {
  try {
    const size = await req.prisma.vehicleSize.create({ data: req.validatedBody });
    res.status(201).json({ success: true, data: size });
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateBody(vehicleSizeSchema.partial()), async (req, res, next) => {
  try {
    const size = await req.prisma.vehicleSize.update({ where: { id: req.params.id }, data: req.validatedBody });
    res.json({ success: true, data: size });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    await req.prisma.vehicleSize.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Tamaño desactivado' });
  } catch (err) { next(err); }
});

module.exports = router;
