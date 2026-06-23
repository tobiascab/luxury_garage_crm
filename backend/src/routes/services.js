const router = require('express').Router();
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

// Genera un slug estable a partir de un texto.
const slugify = (str) =>
  (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

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

// Asegura un slug único para el servicio (deriva de name; sufija -2, -3… si choca).
async function uniqueServiceSlug(prisma, name, ignoreId) {
  const base = slugify(name) || 'servicio';
  let candidate = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.service.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

// Validación de datos para crear/actualizar servicio
const serviceSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  basePriceGs: z.number().int().positive('Precio debe ser positivo'),
  durationMinutes: z.number().int().positive('Duración debe ser positiva'),
  category: z.string().optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  isAddon: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  pricingBySize: z.record(z.string(), z.number().int().nonnegative()).optional().nullable(),
  addons: z.array(z.object({
    key: z.string().min(1),
    name: z.string().min(1),
    priceGs: z.number().int().nonnegative(),
  })).optional().nullable(),
});

// GET / — público (cliente: solo activos). Admin con token: ?includeInactive=true ve todos.
router.get('/', async (req, res, next) => {
  try {
    const { category, addon, includeInactive } = req.query;
    const where = {};
    const wantsAll = includeInactive === 'true' && isAdmin(peekRole(req));
    if (!wantsAll) where.isActive = true;
    if (category) where.category = category;
    if (addon !== undefined) where.isAddon = addon === 'true';
    const services = await req.prisma.service.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
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
    const data = { ...req.validatedBody };
    data.slug = await uniqueServiceSlug(req.prisma, data.name);
    const service = await req.prisma.service.create({ data });
    res.status(201).json({ success: true, data: service });
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateBody(serviceSchema.partial()), async (req, res, next) => {
  try {
    const data = { ...req.validatedBody };
    // Si cambia el nombre regeneramos el slug para mantenerlo coherente y único.
    if (data.name) {
      data.slug = await uniqueServiceSlug(req.prisma, data.name, req.params.id);
    }
    const service = await req.prisma.service.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: service });
  } catch (err) { next(err); }
});

// DELETE — desactiva (soft delete). Solo SUPER_ADMIN.
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    await req.prisma.service.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Servicio desactivado' });
  } catch (err) { next(err); }
});

module.exports = router;
