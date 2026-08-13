const axios = require('axios');

/**
 * Correo transaccional con Resend (https://resend.com).
 *
 * Se habla directo con su API REST en vez de usar el SDK: el backend es CommonJS y esto
 * evita sumar una dependencia para un solo POST. El contrato es idéntico al del SDK
 * (`from`, `to`, `subject`, `html`).
 *
 * REGLA: enviar un correo NUNCA puede romper una operación de negocio. Todos los métodos
 * son best-effort — si falla el envío se loguea y se sigue. Un cobro exitoso no se
 * revierte porque no salió el mail de confirmación.
 *
 * ⚠️ Remitente: para escribirle a los clientes, EMAIL_FROM debe usar un dominio verificado
 * en Resend. Con `onboarding@resend.dev` (el default de prueba) Resend SOLO entrega al
 * correo dueño de la cuenta; a cualquier otro destinatario responde 403.
 */

const API_URL = 'https://api.resend.com/emails';
const APP_URL = process.env.APP_URL || process.env.FRONTEND_URL || 'https://luxurygarage.arizar-ia.cloud';

function isConfigured() {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Envía un correo. Devuelve { ok, id? , error? } y NUNCA lanza.
 * @param {{to:string, subject:string, html:string, replyTo?:string}} opts
 */
async function send({ to, subject, html, replyTo } = {}) {
  if (!isConfigured()) {
    console.warn('[email] RESEND_API_KEY no configurada; se omite el envío:', subject);
    return { ok: false, error: 'not_configured' };
  }
  if (!to || !subject || !html) {
    console.warn('[email] faltan destinatario, asunto o cuerpo; se omite el envío');
    return { ok: false, error: 'bad_request' };
  }
  try {
    const { data } = await axios.post(
      API_URL,
      {
        from: process.env.EMAIL_FROM || 'Luxury Garage <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
        // Casilla de respuesta: varios correos invitan a responder. Si no está configurada,
        // se omite y las respuestas irían al remitente no-reply.
        ...((replyTo || process.env.EMAIL_REPLY_TO) ? { reply_to: replyTo || process.env.EMAIL_REPLY_TO } : {}),
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    console.log(`📧 Email enviado a ${redact(to)}: ${subject}`);
    return { ok: true, id: data?.id };
  } catch (err) {
    const detail = err.response?.data?.message || err.message;
    console.error(`❌ [email] no se pudo enviar "${subject}" a ${redact(to)}: ${detail}`);
    return { ok: false, error: detail };
  }
}

/** Oculta el correo en los logs (no dejamos direcciones completas en texto plano). */
function redact(email) {
  const s = String(email || '');
  const [u, d] = s.split('@');
  if (!d) return '***';
  return `${u.slice(0, 2)}***@${d}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Plantilla base — el escudo dorado sobre negro del logo, llevado al correo.
//
//  Restricciones del medio, que explican por qué está escrito así:
//   • Tablas y estilos en línea: es lo único que respetan Gmail, Outlook y Yahoo.
//   • 600 px de ancho, el estándar que entra en el panel de lectura de Outlook.
//   • El logo va por URL absoluta pública: Gmail bloquea las imágenes en data URI.
//   • El botón se arma con una tabla (no un <a> con padding) para que Outlook lo
//     renderice completo y no solo el texto.
//   • El preheader lleva relleno invisible para que el cliente no complete la
//     vista previa con el principio del cuerpo.
// ─────────────────────────────────────────────────────────────────────────────
const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const MONO = `ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,monospace`;
const GOLD = '#C9A227';
const GOLD_DEEP = '#A8811A';
const INK = '#12100E';
const TEXT = '#3A352E';
const MUTED = '#8A8175';
const FAINT = '#ADA294';
const LINE = '#E8E3D9';
const PAPER = '#F5F3EE';

// ── Escala tipográfica y ritmo vertical ──────────────────────────────────────
// Una sola escala para todos los correos: cada tamaño tiene un rol y no se repite
// con otro parecido. El espaciado va en múltiplos de 4 para que las piezas apilen
// parejo sin importar cuáles se combinen.
const T = {
  title: '27px',   // encabezado del correo, uno solo por pieza
  intro: '17px',   // bajada bajo el título
  body: '16px',    // párrafos
  data: '15px',    // valores en fichas
  label: '11px',   // rótulos en versalitas
  meta: '13px',    // notas al pie y ayudas
  amount: '32px',  // el monto de un cobro
};
const PAD_X = 48;  // margen lateral del contenido (24 en móvil, ver <style>)

const LOGO_URL = `${APP_URL}/pwa-192x192.png`;
// Relleno invisible: sin esto, la bandeja de entrada muestra el preheader seguido
// del arranque del HTML del cuerpo.
const PREHEADER_PAD = '&nbsp;&zwnj;'.repeat(90);

/** Botón sólido, dorado sobre negro. Se construye con tabla por compatibilidad con Outlook. */
function button(url, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr><td align="center" bgcolor="${GOLD}" style="border-radius:8px;background:${GOLD};">
      <a href="${url}" target="_blank" style="display:inline-block;padding:16px 38px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:${INK};text-decoration:none;letter-spacing:.01em;line-height:1;border-radius:8px;">${label}</a>
    </td></tr>
  </table>`;
}

function layout({ preheader = '', heading, intro, body = '', cta, footNote }) {
  return `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${heading}</title>
<style>
  /* Solo lo que los clientes de correo aceptan en <style>; todo lo crítico va en línea. */
  @media only screen and (max-width:620px) {
    .sp   { padding-left:26px !important; padding-right:26px !important; }
    .h1   { font-size:23px !important; }
    .lead { font-size:16px !important; }
  }
  a { color:${GOLD_DEEP}; }
</style>
</head>
<body style="margin:0;padding:0;width:100%;background:${PAPER};-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:${PAPER};">${preheader}${PREHEADER_PAD}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
    <tr><td align="center" style="padding:40px 12px 48px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid ${LINE};">

        <!-- Cabecera: el escudo sobre negro -->
        <tr><td align="center" bgcolor="${INK}" style="background:${INK};padding:40px 24px 34px;">
          <img src="${LOGO_URL}" width="56" height="56" alt="Luxury Garage"
               style="display:block;width:56px;height:56px;border:0;outline:none;text-decoration:none;border-radius:13px;margin:0 auto 16px;">
          <div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.3em;text-transform:uppercase;color:${GOLD};line-height:1;">Luxury&nbsp;Garage</div>
        </td></tr>
        <!-- Filete dorado -->
        <tr><td style="height:3px;line-height:3px;font-size:0;background:${GOLD};">&nbsp;</td></tr>

        <!-- Contenido -->
        <tr><td class="sp" style="padding:44px ${PAD_X}px 0;">
          <h1 class="h1" style="margin:0;font-family:${FONT};font-size:${T.title};line-height:1.22;font-weight:700;color:${INK};letter-spacing:-.021em;">${heading}</h1>
          ${intro ? `<p class="lead" style="margin:12px 0 0;font-family:${FONT};font-size:${T.intro};line-height:1.55;color:${MUTED};">${intro}</p>` : ''}
        </td></tr>
        ${body ? `<tr><td class="sp" style="padding:28px ${PAD_X}px 0;">${body}</td></tr>` : ''}

        ${cta ? `<tr><td class="sp" style="padding:32px ${PAD_X}px 0;">${button(cta.url, cta.label)}</td></tr>
        ${cta.hint ? `<tr><td class="sp" style="padding:20px ${PAD_X}px 0;">
          <p style="margin:0;font-family:${FONT};font-size:${T.meta};line-height:1.6;color:${MUTED};text-align:center;">${cta.hint}</p>
        </td></tr>` : ''}` : ''}

        <tr><td class="sp" style="padding:40px ${PAD_X}px 0;"><div style="height:1px;line-height:1px;font-size:0;background:${LINE};">&nbsp;</div></td></tr>
        <tr><td class="sp" style="padding:24px ${PAD_X}px 40px;">
          <p style="margin:0;font-family:${FONT};font-size:${T.meta};line-height:1.65;color:${MUTED};">${footNote || 'Este es un correo automático de Luxury Garage.'}</p>
        </td></tr>
      </table>

      <!-- Pie -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr><td align="center" style="padding:28px 24px 0;">
          <p style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:1.5;">
            <a href="${APP_URL}" style="color:${MUTED};text-decoration:none;font-weight:600;letter-spacing:.01em;">luxurygarage.arizar-ia.cloud</a>
          </p>
          <p style="margin:0;font-family:${FONT};font-size:11px;line-height:1.6;color:${FAINT};">
            Recibís este correo porque tenés una cuenta en Luxury&nbsp;Garage · Paraguay
          </p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body></html>`;
}

const p = (text) => `<p style="margin:0 0 16px;font-family:${FONT};font-size:${T.body};line-height:1.65;color:${TEXT};">${text}</p>`;
const money = (gs) => `₲ ${Number(gs || 0).toLocaleString('es-PY')}`;

/** Recuadro destacado para un dato que el lector tiene que copiar o leer de un vistazo. */
function highlight({ label, value, mono = false }) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;background:${PAPER};border:1px solid ${LINE};border-radius:10px;">
    <tr><td style="padding:16px 20px;">
      <div style="font-family:${FONT};font-size:${T.label};font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};line-height:1;margin-bottom:8px;">${label}</div>
      <div style="font-family:${mono ? MONO : FONT};font-size:${mono ? '20px' : '17px'};font-weight:700;color:${INK};letter-spacing:${mono ? '.06em' : '-.005em'};line-height:1.35;word-break:break-word;">${value}</div>
    </td></tr>
  </table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Correos del sistema
// ─────────────────────────────────────────────────────────────────────────────

/** Recuperación de contraseña — el enlace vence en 1 hora y sirve una sola vez. */
async function sendPasswordReset(user, resetUrl) {
  return send({
    to: user.email,
    subject: 'Restablecé tu contraseña — Luxury Garage',
    html: layout({
      preheader: 'Creá una contraseña nueva. El enlace vence en 1 hora.',
      heading: 'Restablecé tu contraseña',
      intro: `Hola ${escapeHtml(user.firstName || '')}, recibimos un pedido para cambiar la contraseña de tu cuenta.`,
      body: p('Tocá el botón para crear una nueva. El enlace vence en <strong style="color:' + INK + ';">1 hora</strong> y se puede usar una sola vez.'),
      cta: {
        url: resetUrl,
        label: 'Crear contraseña nueva',
        hint: `¿No te funciona el botón? Copiá y pegá este enlace en tu navegador:<br><span style="color:${GOLD_DEEP};word-break:break-all;">${resetUrl}</span>`,
      },
      footNote: '<strong style="color:' + TEXT + ';">¿No pediste este cambio?</strong> Ignorá este correo: tu contraseña actual sigue funcionando y nadie puede entrar a tu cuenta con este enlace.',
    }),
  });
}

/** Bienvenida con credenciales — reemplaza al WhatsApp cuando el CRM no está activo. */
async function sendWelcome(user, tempPassword, planName) {
  return send({
    to: user.email,
    subject: 'Tu cuenta de Luxury Garage está lista',
    html: layout({
      preheader: 'Estos son tus datos de acceso para entrar y activar tu membresía.',
      heading: `¡Bienvenido, ${escapeHtml(user.firstName || '')}!`,
      intro: 'Ya tenés tu cuenta en el portal de Luxury Garage. Estos son tus datos para entrar.',
      body:
        highlight({ label: 'Tu correo', value: escapeHtml(user.email) }) +
        highlight({ label: 'Contraseña temporal', value: escapeHtml(tempPassword), mono: true }) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
          <tr><td style="padding:0 0 16px;">
            <div style="font-family:${FONT};font-size:${T.label};font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};line-height:1;">Al entrar, en 3 pasos</div>
          </td></tr>
          ${[
            ['1', 'Registrás tu tarjeta', 'De forma segura, con el formulario del banco.'],
            ['2', `Confirmás tu plan${planName ? ` ${escapeHtml(planName)}` : ''}`, 'Ya lo dejamos elegido para vos.'],
            ['3', 'Se cobra el primer mes', 'Y desde ahí se renueva solo, todos los meses.'],
          ].map(([n, t, d], i, arr) => `<tr><td style="padding:0 0 ${i === arr.length - 1 ? '0' : '18px'};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="28" valign="top" style="width:28px;">
                <div style="width:26px;height:26px;background:${INK};border-radius:13px;color:${GOLD};font-family:${FONT};font-size:12px;font-weight:700;text-align:center;line-height:26px;">${n}</div>
              </td>
              <td valign="top" style="padding-left:14px;">
                <div style="font-family:${FONT};font-size:${T.data};font-weight:700;color:${INK};line-height:1.45;">${t}</div>
                <div style="font-family:${FONT};font-size:${T.meta};color:${MUTED};line-height:1.5;margin-top:2px;">${d}</div>
              </td>
            </tr></table>
          </td></tr>`).join('')}
        </table>`,
      cta: { url: `${APP_URL}/login`, label: 'Entrar y activar mi cuenta' },
      footNote: 'Por seguridad, cambiá la contraseña temporal desde tu perfil apenas ingreses.',
    }),
  });
}

/** Verificación del correo cargado en el alta. */
async function sendEmailVerification(user, verifyUrl) {
  return send({
    to: user.email,
    subject: 'Confirmá tu correo — Luxury Garage',
    html: layout({
      preheader: 'Un toque para confirmar que esta dirección es tuya.',
      heading: 'Confirmá tu correo',
      intro: `Hola ${escapeHtml(user.firstName || '')}, confirmanos que esta dirección es tuya.`,
      body: p('Es por donde te avisamos de tus cobros y tus turnos, y por donde vas a poder recuperar tu contraseña si alguna vez te la olvidás.'),
      cta: { url: verifyUrl, label: 'Confirmar mi correo', hint: 'El enlace vence en 7 días.' },
    }),
  });
}

/** Renovación cobrada con éxito. */
async function sendRenewalOk(user, { planName, amountGs, endDate, cardLast4 }) {
  return send({
    to: user.email,
    subject: `Renovamos tu ${planName} — Luxury Garage`,
    html: layout({
      preheader: `Cobramos ${money(amountGs)}. Tu plan sigue activo con el cupo completo.`,
      heading: '¡Tu membresía se renovó!',
      intro: `Hola ${escapeHtml(user.firstName || '')}, arrancás un mes nuevo con el cupo completo.`,
      // El monto va destacado: es el dato por el que se abre este correo.
      body:
        amountBox(amountGs, 'Cobrado a tu tarjeta') +
        summaryTable([
          ['Plan', escapeHtml(planName)],
          ...(cardLast4 ? [['Tarjeta', `•••• ${escapeHtml(cardLast4)}`]] : []),
          ['Válido hasta', endDate ? new Date(endDate).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'],
        ]),
      cta: { url: `${APP_URL}/booking`, label: 'Agendar mi turno' },
      footNote: 'Guardá este correo como comprobante del cobro.',
    }),
  });
}

/** No se pudo cobrar la renovación. */
async function sendRenewalFailed(user, { planName, noCard }) {
  return send({
    to: user.email,
    subject: 'No pudimos renovar tu membresía — Luxury Garage',
    html: layout({
      preheader: noCard
        ? 'No tenemos una tarjeta registrada para cobrarte.'
        : 'El cobro a tu tarjeta no fue aprobado.',
      heading: 'No pudimos renovar tu membresía',
      intro: `Hola ${escapeHtml(user.firstName || '')}, hoy vencía tu ${escapeHtml(planName)} y el cobro no salió.`,
      body:
        alertBox(noCard
          ? 'No encontramos una tarjeta registrada en tu cuenta.'
          : 'El banco no aprobó el cobro a tu tarjeta. Puede ser por falta de saldo, por el límite de la tarjeta, o porque venció.') +
        p('Entrá y regularizalo para no perder tus beneficios. Es un minuto.'),
      cta: { url: `${APP_URL}/planes`, label: noCard ? 'Cargar mi tarjeta' : 'Reactivar mi plan' },
      footNote: '¿Necesitás ayuda? Respondé este correo y te damos una mano.',
    }),
  });
}

/** Aviso de vencimiento próximo. */
async function sendExpiringSoon(user, { planName, endDate, days }) {
  const cuando = days === 1 ? 'mañana' : `en ${days} días`;
  return send({
    to: user.email,
    subject: days === 1 ? 'Tu membresía vence mañana' : `Tu membresía vence ${cuando}`,
    html: layout({
      preheader: `Tu ${planName} vence ${cuando}. Si tenés la renovación automática, no hacés nada.`,
      heading: `Tu membresía vence ${cuando}`,
      intro: `Hola ${escapeHtml(user.firstName || '')}, te avisamos con tiempo.`,
      body:
        summaryTable([
          ['Plan', escapeHtml(planName)],
          ['Vence', endDate ? new Date(endDate).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'],
        ]) +
        p('Si tenés la renovación automática activa, ese día lo cobramos a tu tarjeta y seguís sin hacer nada. Si la cancelaste, entrá y reactivala para no quedarte sin tus lavados.'),
      cta: { url: `${APP_URL}/planes`, label: 'Ver mi membresía' },
    }),
  });
}

/** Recordatorio del turno del día siguiente. */
async function sendAppointmentReminder(user, { serviceName, when, vehicle }) {
  return send({
    to: user.email,
    subject: 'Recordatorio: tenés turno mañana — Luxury Garage',
    html: layout({
      preheader: `${serviceName} · ${when}`,
      heading: 'Te esperamos mañana',
      intro: `Hola ${escapeHtml(user.firstName || '')}, te recordamos tu turno.`,
      body:
        summaryTable([
          ['Servicio', escapeHtml(serviceName)],
          ['Cuándo', escapeHtml(when)],
          ...(vehicle ? [['Vehículo', escapeHtml(vehicle)]] : []),
        ]) +
        p('Al llegar, mostrale tu carnet digital al operario: con eso queda registrado tu lavado.'),
      cta: { url: `${APP_URL}/qr`, label: 'Ver mi carnet' },
    }),
  });
}

/** Ficha de datos: una fila por dato, con línea divisoria. Se lee mejor que un párrafo. */
function summaryTable(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;background:${PAPER};border:1px solid ${LINE};border-radius:10px;">
    <tr><td style="padding:4px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows.map(([k, v], i) => {
          const borde = i < rows.length - 1 ? `border-bottom:1px solid ${LINE};` : '';
          return `<tr>
          <td style="padding:14px 12px 14px 0;${borde}font-family:${FONT};font-size:${T.meta};line-height:1.4;color:${MUTED};white-space:nowrap;vertical-align:top;">${k}</td>
          <td align="right" style="padding:14px 0;${borde}font-family:${FONT};font-size:${T.data};line-height:1.4;font-weight:700;color:${INK};vertical-align:top;">${v}</td>
        </tr>`;
        }).join('')}
      </table>
    </td></tr>
  </table>`;
}

/** El monto, en grande. Es el dato por el que se abre un correo de cobro. */
function amountBox(gs, label) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
    <tr><td align="center" bgcolor="${INK}" style="background:${INK};border-radius:12px;padding:28px 24px;">
      <div style="font-family:${FONT};font-size:${T.label};font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${GOLD};line-height:1;margin-bottom:12px;">${label}</div>
      <div style="font-family:${FONT};font-size:${T.amount};font-weight:700;color:#FFFFFF;letter-spacing:-.022em;line-height:1.05;">${money(gs)}</div>
    </td></tr>
  </table>`;
}

/** Aviso destacado para lo que salió mal — ámbar, no rojo: es accionable, no una catástrofe. */
function alertBox(text) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;background:#FDF6E7;border:1px solid #F0DFB4;border-radius:10px;">
    <tr><td style="padding:18px 20px;">
      <div style="font-family:${FONT};font-size:${T.body};line-height:1.6;color:#6B5312;">${text}</div>
    </td></tr>
  </table>`;
}

/** Escapa lo que venga del usuario antes de meterlo en el HTML del correo. */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

module.exports = {
  isConfigured,
  send,
  sendPasswordReset,
  sendWelcome,
  sendEmailVerification,
  sendRenewalOk,
  sendRenewalFailed,
  sendExpiringSoon,
  sendAppointmentReminder,
};
