const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

// Validación de datos para crear/actualizar servicio
const serviceSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  basePriceGs: z.number().positive('Precio debe ser positivo'),
  durationMinutes: z.number().int().positive('Duración debe ser positiva'),
  category: z.string().optional(),
  description: z.string().optional(),
  isAddon: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

router.get('/', async (req, res, next) => {
  try {
    const { category, addon } = req.query;
    const where = { isActive: true };
    if (category) where.category = category;
    if (addon !== undefined) where.isAddon = addon === 'true';
    const services = await req.prisma.service.findMany({ where, orderBy: { sortOrder: 'asc' } });
    res.json({ success: true, data: services });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const service = await req.prisma.service.findUnique({ where: { id: req.params.id } });
    if (!service) return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
    res.json({ success: true, data: service });
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateBody(serviceSchema), async (req, res, next) => {
  try {
    const service = await req.prisma.service.create({ data: req.validatedBody });
    res.status(201).json({ success: true, data: service });
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateBody(serviceSchema.partial()), async (req, res, next) => {
  try {
    const service = await req.prisma.service.update({ where: { id: req.params.id }, data: req.validatedBody });
    res.json({ success: true, data: service });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    await req.prisma.service.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Servicio desactivado' });
  } catch (err) { next(err); }
});

module.exports = router;
