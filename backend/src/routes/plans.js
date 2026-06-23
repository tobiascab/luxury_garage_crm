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

// Asegura un slug único para el plan (deriva de name; sufija -2, -3… si choca).
async function uniquePlanSlug(prisma, name, ignoreId) {
  const base = slugify(name) || 'plan';
  let candidate = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.plan.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

// Validación de datos para crear/actualizar plan.
// El slug se genera en el backend a partir del nombre (no lo manda el cliente).
const planSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional().nullable(),
  priceGs: z.number().int().positive('Precio debe ser positivo'),
  billingPeriod: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
  // Cobertura granular: qué servicios cubre el plan, con cupo y qué adicionales incluye.
  // quota: -1 = ilimitado. includedAddons: 'all' | [keys de adicionales] | null (ninguno).
  servicesIncluded: z.array(z.object({
    slug: z.string().min(1),
    quota: z.number().int(),
    includedAddons: z.union([z.literal('all'), z.array(z.string())]).optional().nullable(),
  })).optional().nullable(),
  limitsJson: z.record(z.any()).optional().nullable(),
  discountPercent: z.number().int().min(0).max(100).default(0),
  features: z.array(z.string()).optional().nullable(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// GET /api/plans — público (cliente: solo activos). Admin con token: ?includeInactive=true ve todos.
router.get('/', async (req, res, next) => {
  try {
    const wantsAll = req.query.includeInactive === 'true' && isAdmin(peekRole(req));
    const where = wantsAll ? {} : { isActive: true };
    const plans = await req.prisma.plan.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { priceGs: 'asc' }],
    });
    res.json({ success: true, data: plans });
  } catch (err) { next(err); }
});

// GET /api/plans/:id
router.get('/:id', async (req, res, next) => {
  try {
    const plan = await req.prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// POST /api/plans — admin
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateBody(planSchema), async (req, res, next) => {
  try {
    const data = { ...req.validatedBody };
    data.slug = await uniquePlanSlug(req.prisma, data.name);
    const plan = await req.prisma.plan.create({ data });
    res.status(201).json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// PUT /api/plans/:id — admin
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateBody(planSchema.partial()), async (req, res, next) => {
  try {
    const data = { ...req.validatedBody };
    if (data.name) {
      data.slug = await uniquePlanSlug(req.prisma, data.name, req.params.id);
    }
    const plan = await req.prisma.plan.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// DELETE /api/plans/:id — soft delete (desactiva). Solo SUPER_ADMIN.
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    await req.prisma.plan.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Plan desactivado' });
  } catch (err) { next(err); }
});

module.exports = router;
