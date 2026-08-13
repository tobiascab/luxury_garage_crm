const crypto = require('crypto');

/**
 * Tokens firmados para enlaces por correo, SIN tabla nueva en la base.
 *
 * El token es `<userId>.<emitidoEn>.<firma>`, donde la firma es un HMAC que incluye el
 * **hash actual de la contraseña** del usuario y el **propósito** del enlace. Eso da tres
 * garantías sin persistir nada:
 *
 *   • Un solo uso (en el reset) — al cambiar la contraseña cambia su hash, así que el token
 *     con el que se hizo el cambio deja de validar automáticamente.
 *   • Vencimiento — el instante de emisión viaja firmado dentro del token.
 *   • Separación por propósito — un enlace de "confirmá tu correo" NO sirve para restablecer
 *     la contraseña, ni al revés. Sin esto, el enlace de confirmación (que se manda en el
 *     alta y vive 7 días) permitiría tomar la cuenta: alcanzaba con pegarlo en la pantalla
 *     de restablecer. Cada propósito produce una firma distinta.
 *
 * Se evita así una migración de schema, que en este proyecto es delicada
 * (ver el comentario de `bancardShopProcessId` en schema.prisma).
 */

const TTL_MS = 60 * 60 * 1000; // 1 hora — el default, para restablecer contraseña
const SECRET = process.env.JWT_SECRET || 'luxury-reset-fallback-secret';

/** Propósitos válidos. Cualquier otro valor se rechaza al firmar y al verificar. */
const PURPOSES = ['reset', 'verify-email'];

function sign(userId, issuedAt, passwordHash, purpose) {
  return crypto
    .createHmac('sha256', SECRET)
    .update(`${purpose}.${userId}.${issuedAt}.${passwordHash}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Crea el token para un usuario y un propósito.
 * @param {{id:string, passwordHash:string}} user
 * @param {'reset'|'verify-email'} purpose
 */
function create(user, purpose) {
  if (!PURPOSES.includes(purpose)) throw new Error(`Propósito de token inválido: ${purpose}`);
  const issuedAt = Date.now();
  return `${user.id}.${issuedAt}.${sign(user.id, issuedAt, user.passwordHash, purpose)}`;
}

/** Extrae el userId sin validar la firma (para poder buscar al usuario y su hash). */
function peekUserId(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 3) return null;
  return parts.slice(0, -2).join('.') || null;
}

/**
 * Verifica el token contra el usuario Y el propósito con el que fue emitido.
 * @param {string} token
 * @param {{id:string, passwordHash:string}} user
 * @param {'reset'|'verify-email'} purpose  debe coincidir con el usado al crearlo
 * @param {number} [ttlMs=TTL_MS]  ventana de validez; la verificación de correo usa 7 días
 * @returns {{ok:true} | {ok:false, reason:'format'|'expired'|'signature'}}
 */
function verify(token, user, purpose, ttlMs = TTL_MS) {
  if (!PURPOSES.includes(purpose)) return { ok: false, reason: 'signature' };
  if (typeof token !== 'string' || !user?.passwordHash) return { ok: false, reason: 'format' };
  const parts = token.split('.');
  if (parts.length < 3) return { ok: false, reason: 'format' };

  const firma = parts.pop();
  const issuedAt = Number(parts.pop());
  const userId = parts.join('.');
  if (!userId || userId !== user.id || !Number.isFinite(issuedAt)) return { ok: false, reason: 'format' };

  const esperada = sign(user.id, issuedAt, user.passwordHash, purpose);
  const a = Buffer.from(firma, 'utf8');
  const b = Buffer.from(esperada, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'signature' };

  // Emitido "en el futuro" (reloj manipulado) o ya vencido.
  if (issuedAt > Date.now() + 60_000) return { ok: false, reason: 'expired' };
  if (Date.now() - issuedAt > ttlMs) return { ok: false, reason: 'expired' };

  return { ok: true };
}

module.exports = { create, verify, peekUserId, TTL_MS, PURPOSES };
