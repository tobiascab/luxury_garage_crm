const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const contractService = require('../services/contractService');

const adminOnly = [authenticate, authorize('SUPER_ADMIN', 'ADMIN')];

/** Datos del cliente que van al documento. */
function clienteSnapshot(user) {
  return {
    nombre: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    documento: user.documentNumber || '',
    email: user.email || '',
    telefono: user.phone || '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  CLIENTE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/contracts/preview?planId=...
 * El texto EXACTO que el cliente va a aceptar, ya con sus datos resueltos. Se muestra
 * antes de pagar; al aceptar se guarda este mismo texto (ver payments.js).
 */
router.get('/preview', authenticate, async (req, res, next) => {
  try {
    const { planId } = req.query;
    if (!planId) return res.status(400).json({ success: false, message: 'planId requerido' });

    const [plan, user, config, comercio] = await Promise.all([
      req.prisma.plan.findUnique({ where: { id: String(planId) } }),
      req.prisma.user.findUnique({ where: { id: req.user.id }, include: { paymentCards: true } }),
      contractService.obtenerConfig(req.prisma),
      contractService.datosComercio(req.prisma),
    ]);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

    const card = user.paymentCards?.find((c) => c.isPrimary) || user.paymentCards?.[0] || null;
    const texto = contractService.componerTexto({
      plantilla: config.plantilla,
      numero: '(se asigna al confirmar)',
      cliente: clienteSnapshot(user),
      comercio,
      plan: plan.name,
      montoGs: plan.priceGs,
      tarjeta: {
        marca: card?.brand || 'la tarjeta registrada',
        ultimos4: (card?.maskedNumber || '').replace(/\D/g, '').slice(-4) || '····',
      },
      fecha: new Date(),
      ip: '(se registra al confirmar)',
      userAgent: '(se registra al confirmar)',
    });

    res.json({
      success: true,
      data: { titulo: config.titulo, resumen: config.resumen, version: config.version, texto },
    });
  } catch (err) { next(err); }
});

/** GET /api/contracts/me — contratos del cliente autenticado. */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [rows] = [await req.prisma.$queryRaw`
      SELECT id, numero, plan_nombre, monto_gs, periodicidad, tarjeta_marca, tarjeta_ultimos4,
             texto_version, aceptado_en, estado
      FROM contracts WHERE user_id = ${req.user.id} ORDER BY created_at DESC`];
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

/** GET /api/contracts/me/:id — un contrato propio, con su texto completo. */
router.get('/me/:id', authenticate, async (req, res, next) => {
  try {
    const rows = await req.prisma.$queryRaw`
      SELECT * FROM contracts WHERE id = ${req.params.id} AND user_id = ${req.user.id} LIMIT 1`;
    if (!rows.length) return res.status(404).json({ success: false, message: 'Documento no encontrado' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/contracts — listado con búsqueda y filtro por estado. */
router.get('/', ...adminOnly, async (req, res, next) => {
  try {
    const { search, estado, page = 1, limit = 20 } = req.query;
    const take = Math.min(parseInt(limit) || 20, 100);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;
    const q = search ? `%${String(search).trim().slice(0, 80)}%` : null;
    const est = ['VIGENTE', 'CANCELADO'].includes(estado) ? estado : null;

    const rows = await req.prisma.$queryRaw`
      SELECT c.id, c.numero, c.plan_nombre, c.monto_gs, c.periodicidad,
             c.tarjeta_marca, c.tarjeta_ultimos4, c.aceptado_en, c.estado, c.texto_version,
             c.cliente_snapshot, u.email AS user_email, u.id AS user_id
      FROM contracts c JOIN users u ON u.id = c.user_id
      WHERE (${q}::text IS NULL OR u.email ILIKE ${q} OR c.numero ILIKE ${q}
             OR (c.cliente_snapshot->>'nombre') ILIKE ${q}
             OR (c.cliente_snapshot->>'documento') ILIKE ${q})
        AND (${est}::text IS NULL OR c.estado = ${est})
      ORDER BY c.created_at DESC LIMIT ${take} OFFSET ${skip}`;

    const [{ total }] = await req.prisma.$queryRaw`
      SELECT count(*)::int AS total FROM contracts c JOIN users u ON u.id = c.user_id
      WHERE (${q}::text IS NULL OR u.email ILIKE ${q} OR c.numero ILIKE ${q}
             OR (c.cliente_snapshot->>'nombre') ILIKE ${q}
             OR (c.cliente_snapshot->>'documento') ILIKE ${q})
        AND (${est}::text IS NULL OR c.estado = ${est})`;

    res.json({ success: true, data: rows, pagination: { total, page: parseInt(page), limit: take, pages: Math.ceil(total / take) } });
  } catch (err) { next(err); }
});

/** GET /api/contracts/stats — resumen para las tarjetas del panel. */
router.get('/stats', ...adminOnly, async (req, res, next) => {
  try {
    const [r] = await req.prisma.$queryRaw`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE estado = 'VIGENTE')::int AS vigentes,
             count(*) FILTER (WHERE estado = 'CANCELADO')::int AS cancelados,
             coalesce(sum(monto_gs) FILTER (WHERE estado = 'VIGENTE'), 0)::int AS comprometido_mensual
      FROM contracts`;
    const comercio = await contractService.datosComercio(req.prisma);
    res.json({ success: true, data: { ...r, faltanDatosComercio: contractService.faltantesComercio(comercio) } });
  } catch (err) { next(err); }
});

/** GET /api/contracts/:id — detalle completo (admin). */
router.get('/:id', ...adminOnly, async (req, res, next) => {
  try {
    const rows = await req.prisma.$queryRaw`
      SELECT c.*, u.email AS user_email FROM contracts c JOIN users u ON u.id = c.user_id
      WHERE c.id = ${req.params.id} LIMIT 1`;
    if (!rows.length) return res.status(404).json({ success: false, message: 'Contrato no encontrado' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── Condiciones (plantilla editable) ────────────────────────────────────────

/** GET /api/contracts/config/mandate — plantilla vigente + variables + datos del comercio. */
router.get('/config/mandate', ...adminOnly, async (req, res, next) => {
  try {
    const [config, comercio] = await Promise.all([
      contractService.obtenerConfig(req.prisma),
      contractService.datosComercio(req.prisma),
    ]);
    res.json({
      success: true,
      data: {
        ...config,
        variables: contractService.VARIABLES,
        comercio,
        faltanDatosComercio: contractService.faltantesComercio(comercio),
        plantillaPorDefecto: contractService.PLANTILLA_POR_DEFECTO,
      },
    });
  } catch (err) { next(err); }
});

/**
 * PUT /api/contracts/config/mandate — editar las condiciones.
 * Los contratos ya firmados NO se tocan: cada uno guarda su propio texto.
 */
router.put('/config/mandate', ...adminOnly, async (req, res, next) => {
  try {
    const { plantilla, titulo, resumen, version } = req.body || {};
    if (!plantilla || String(plantilla).trim().length < 100) {
      return res.status(400).json({ success: false, message: 'El texto del documento es demasiado corto' });
    }
    const actual = await contractService.obtenerConfig(req.prisma);
    const value = {
      plantilla: String(plantilla),
      titulo: String(titulo || actual.titulo).slice(0, 120),
      resumen: String(resumen || actual.resumen).slice(0, 400),
      version: String(version || actual.version).slice(0, 20),
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: req.user.email,
    };
    await req.prisma.setting.upsert({
      where: { key: 'debit_mandate' },
      update: { value },
      create: { key: 'debit_mandate', value },
    });
    await req.prisma.auditLog.create({
      data: { entity: 'contract_config', action: 'update', entityId: 'debit_mandate', userId: req.user.id, detailsJson: { by: req.user.email, version: value.version } },
    }).catch(() => {});
    res.json({ success: true, data: value, message: 'Condiciones actualizadas. Los contratos ya firmados no cambian.' });
  } catch (err) { next(err); }
});

/**
 * POST /api/contracts/config/preview — previsualizar con datos de muestra.
 * Permite ver el documento terminado mientras se edita, sin guardar nada.
 */
router.post('/config/preview', ...adminOnly, async (req, res, next) => {
  try {
    const { plantilla } = req.body || {};
    const [comercio, plan] = await Promise.all([
      contractService.datosComercio(req.prisma),
      req.prisma.plan.findFirst({ orderBy: { priceGs: 'asc' } }),
    ]);
    const texto = contractService.componerTexto({
      plantilla: plantilla || (await contractService.obtenerConfig(req.prisma)).plantilla,
      numero: `LG-${new Date().getFullYear()}-0001`,
      cliente: { nombre: 'Nombre del Cliente', documento: '1.234.567', email: 'cliente@correo.com' },
      comercio,
      plan: plan?.name || 'Plan',
      montoGs: plan?.priceGs || 0,
      tarjeta: { marca: 'Visa', ultimos4: '4242' },
      fecha: new Date(),
      ip: '186.16.0.1',
      userAgent: 'Chrome en Android',
    });
    res.json({ success: true, data: { texto, faltanDatosComercio: contractService.faltantesComercio(comercio) } });
  } catch (err) { next(err); }
});

module.exports = router;
