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

// ─────────────────────────────────────────────────────────────────────────────
// REDES SOCIALES
// ─────────────────────────────────────────────────────────────────────────────
// Se guardan acá y no en el código para que el Garage pueda cambiarlas sin un
// despliegue, y para que la app no muestre íconos que no llevan a ningún lado: si una
// red no está cargada, sencillamente no aparece.

const REDES = {
  instagram: { label: 'Instagram', base: 'https://instagram.com/' },
  facebook: { label: 'Facebook', base: 'https://facebook.com/' },
  tiktok: { label: 'TikTok', base: 'https://tiktok.com/@' },
  whatsapp: { label: 'WhatsApp', base: 'https://wa.me/' },
};
const REDES_KEY = 'social_links';

/**
 * El admin va a pegar lo que tenga a mano: "@luxurygarage", "luxurygarage", la URL entera o
 * un número de teléfono con espacios y guiones. Todo eso se convierte acá en un enlace que
 * de verdad abre el perfil.
 */
function normalizarRed(red, valor) {
  const v = String(valor || '').trim();
  if (!v) return null;

  if (red === 'whatsapp') {
    const digitos = v.replace(/\D/g, '');
    if (digitos.length < 8) return null;
    // Paraguay: se acepta 0981..., 981... o con código de país; se guarda en formato internacional.
    const conPais = digitos.startsWith('595') ? digitos : `595${digitos.replace(/^0/, '')}`;
    return REDES.whatsapp.base + conPais;
  }

  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
    } catch { return null; }
  }

  const usuario = v.replace(/^@/, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9._-]{1,60}$/.test(usuario)) return null;
  return REDES[red].base + usuario;
}

// GET /api/settings/redes — público: lo usa la landing (sin sesión) y la app del cliente.
router.get('/redes', async (req, res, next) => {
  try {
    const row = await req.prisma.setting.findUnique({ where: { key: REDES_KEY } });
    const guardado = (row && typeof row.value === 'object' && row.value) || {};
    const data = {};
    for (const red of Object.keys(REDES)) {
      if (guardado[red]) data[red] = guardado[red];
    }
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// PUT /api/settings/redes — admin. Body: { instagram?, facebook?, tiktok?, whatsapp? }
// Un campo vacío BORRA esa red (es cómo se saca una del pie de página).
router.put('/redes', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const guardadas = {};
    const invalidas = [];

    for (const [red, cfg] of Object.entries(REDES)) {
      if (!Object.prototype.hasOwnProperty.call(body, red)) continue;
      const crudo = String(body[red] ?? '').trim();
      if (!crudo) continue; // vacío = se quita
      const url = normalizarRed(red, crudo);
      if (!url) { invalidas.push(cfg.label); continue; }
      guardadas[red] = url;
    }

    if (invalidas.length) {
      return res.status(400).json({
        success: false,
        message: `Revisá ${invalidas.join(' y ')}: poné el usuario (ej. @luxurygarage) o el enlace completo.`,
      });
    }

    await req.prisma.setting.upsert({
      where: { key: REDES_KEY },
      update: { value: guardadas },
      create: { key: REDES_KEY, value: guardadas },
    });

    res.json({ success: true, data: guardadas, message: 'Redes actualizadas' });
  } catch (err) { next(err); }
});

module.exports = router;
