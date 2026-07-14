const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de ajustes conocidos del negocio.
// Define qué keys acepta el panel, su tipo y valor por defecto. Cualquier key
// fuera de este catálogo se rechaza en el PUT para evitar basura en la tabla.
// El modelo Setting.value es Json: guardamos el valor tipado (string/number/bool).
// ─────────────────────────────────────────────────────────────────────────────
const SETTING_SCHEMA = {
  business_name: { type: 'string', default: 'Luxury Garage' },
  business_address: { type: 'string', default: '' },
  business_phone: { type: 'string', default: '' },
  business_email: { type: 'string', default: '' },
  tax_id: { type: 'string', default: '' },
  currency: { type: 'enum', values: ['PYG', 'USD'], default: 'PYG' },
  timezone: { type: 'string', default: 'America/Asuncion' },
  opening_time: { type: 'string', default: '07:00' },
  closing_time: { type: 'string', default: '18:00' },
  working_days: { type: 'string', default: 'Lun-Sáb' },
  bays_count: { type: 'int', min: 1, max: 50, default: 2 },        // 2 lavados simultáneos máx (regla del negocio)
  slot_duration_minutes: { type: 'int', min: 10, max: 480, default: 30 }, // turnos cada 30 min → tope 4/hora
  email_notifications: { type: 'bool', default: true },
  whatsapp_notifications: { type: 'bool', default: true },
};

const KNOWN_KEYS = Object.keys(SETTING_SCHEMA);

// ─────────────────────────────────────────────────────────────────────────────
// Documentos legales editables por el admin y visibles para el cliente.
// Se guardan en la tabla `settings` (Setting.value es Json: admite texto largo).
// Keys: 'terms_and_conditions' y 'privacy_policy'. Guardamos un objeto
// { text, updatedAt } para poder mostrar "última actualización" en la app.
// ─────────────────────────────────────────────────────────────────────────────
const LEGAL_DOCS = {
  terms: { key: 'terms_and_conditions', label: 'Términos y Condiciones' },
  privacy: { key: 'privacy_policy', label: 'Política de Privacidad' },
};

const MAX_LEGAL_LENGTH = 100000;

/** Normaliza el valor crudo del Setting a { text, updatedAt }. */
function readLegalValue(raw) {
  if (raw == null) return { text: '', updatedAt: null };
  if (typeof raw === 'string') return { text: raw, updatedAt: null };
  if (typeof raw === 'object') {
    return {
      text: typeof raw.text === 'string' ? raw.text : '',
      updatedAt: raw.updatedAt || null,
    };
  }
  return { text: '', updatedAt: null };
}

/** Coacciona/valida un valor según el catálogo. Devuelve {value} o {error}. */
function coerceSetting(key, raw) {
  const spec = SETTING_SCHEMA[key];
  if (!spec) return { error: `Ajuste desconocido: ${key}` };

  switch (spec.type) {
    case 'string': {
      const v = raw == null ? '' : String(raw).trim();
      return { value: v };
    }
    case 'enum': {
      const v = String(raw);
      if (!spec.values.includes(v)) return { error: `Valor inválido para ${key}` };
      return { value: v };
    }
    case 'int': {
      const n = Math.trunc(Number(raw));
      if (!Number.isFinite(n)) return { error: `${key} debe ser un número` };
      if (spec.min != null && n < spec.min) return { error: `${key} debe ser >= ${spec.min}` };
      if (spec.max != null && n > spec.max) return { error: `${key} debe ser <= ${spec.max}` };
      return { value: n };
    }
    case 'bool': {
      const v = raw === true || raw === 'true' || raw === 1 || raw === '1';
      return { value: v };
    }
    default:
      return { error: `Tipo no soportado para ${key}` };
  }
}

// GET /api/settings — configuración del negocio (con defaults para keys faltantes)
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const rows = await req.prisma.setting.findMany();
    const stored = {};
    rows.forEach((r) => { stored[r.key] = r.value; });

    // Construir respuesta solo con keys conocidas, aplicando defaults.
    const config = {};
    for (const key of KNOWN_KEYS) {
      const spec = SETTING_SCHEMA[key];
      if (Object.prototype.hasOwnProperty.call(stored, key)) {
        const { value } = coerceSetting(key, stored[key]);
        config[key] = value;
      } else {
        config[key] = spec.default;
      }
    }
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
});

// PUT /api/settings — actualizar configuración del negocio (admin)
router.put('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const updates = req.body && typeof req.body === 'object' ? req.body : {};
    const entries = Object.entries(updates);

    if (entries.length === 0) {
      return res.status(400).json({ success: false, message: 'No se enviaron ajustes para guardar' });
    }

    // Validar todo antes de persistir (transacción lógica: o todo o nada).
    const toPersist = [];
    for (const [key, raw] of entries) {
      if (!KNOWN_KEYS.includes(key)) {
        return res.status(400).json({ success: false, message: `Ajuste no permitido: ${key}` });
      }
      const { value, error } = coerceSetting(key, raw);
      if (error) return res.status(400).json({ success: false, message: error });
      toPersist.push({ key, value });
    }

    await req.prisma.$transaction(
      toPersist.map(({ key, value }) =>
        req.prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );

    await req.prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_SETTINGS',
        entity: 'Setting',
        detailsJson: { keys: toPersist.map((p) => p.key) },
      },
    });

    // Devolver el estado completo y normalizado.
    const rows = await req.prisma.setting.findMany();
    const stored = {};
    rows.forEach((r) => { stored[r.key] = r.value; });
    const config = {};
    for (const key of KNOWN_KEYS) {
      const spec = SETTING_SCHEMA[key];
      config[key] = Object.prototype.hasOwnProperty.call(stored, key)
        ? coerceSetting(key, stored[key]).value
        : spec.default;
    }

    res.json({ success: true, data: config, message: 'Configuración actualizada' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTOS LEGALES (T&C + Política de Privacidad)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/settings/legal — público: el cliente ve T&C y privacidad (sin token).
router.get('/legal', async (req, res, next) => {
  try {
    const keys = Object.values(LEGAL_DOCS).map((d) => d.key);
    const rows = await req.prisma.setting.findMany({ where: { key: { in: keys } } });
    const byKey = {};
    rows.forEach((r) => { byKey[r.key] = r.value; });

    const data = {};
    for (const [name, doc] of Object.entries(LEGAL_DOCS)) {
      const { text, updatedAt } = readLegalValue(byKey[doc.key]);
      data[name] = { label: doc.label, text, updatedAt };
    }
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// PUT /api/settings/legal — admin: guarda el texto de T&C / privacidad.
// Body: { terms?: string, privacy?: string }. Persiste { text, updatedAt }.
router.put('/legal', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const toPersist = [];

    for (const [name, doc] of Object.entries(LEGAL_DOCS)) {
      if (!Object.prototype.hasOwnProperty.call(body, name)) continue;
      const raw = body[name];
      if (typeof raw !== 'string') {
        return res.status(400).json({ success: false, message: `${doc.label} debe ser texto` });
      }
      if (raw.length > MAX_LEGAL_LENGTH) {
        return res.status(400).json({ success: false, message: `${doc.label} es demasiado largo` });
      }
      toPersist.push({ key: doc.key, value: { text: raw.trim(), updatedAt: new Date().toISOString() } });
    }

    if (toPersist.length === 0) {
      return res.status(400).json({ success: false, message: 'No se enviaron documentos para guardar' });
    }

    await req.prisma.$transaction(
      toPersist.map(({ key, value }) =>
        req.prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );

    await req.prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_LEGAL',
        entity: 'Setting',
        detailsJson: { keys: toPersist.map((p) => p.key) },
      },
    });

    // Devolver el estado completo y normalizado de los documentos legales.
    const keys = Object.values(LEGAL_DOCS).map((d) => d.key);
    const rows = await req.prisma.setting.findMany({ where: { key: { in: keys } } });
    const byKey = {};
    rows.forEach((r) => { byKey[r.key] = r.value; });
    const data = {};
    for (const [name, doc] of Object.entries(LEGAL_DOCS)) {
      const { text, updatedAt } = readLegalValue(byKey[doc.key]);
      data[name] = { label: doc.label, text, updatedAt };
    }

    res.json({ success: true, data, message: 'Documentos legales actualizados' });
  } catch (err) { next(err); }
});

module.exports = router;
