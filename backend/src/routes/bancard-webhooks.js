const router = require('express').Router();
const bancardService = require('../services/bancardService');
const { materializeApprovedPayment } = require('../services/paymentReconciliation');

/**
 * POST /api/bancard/webhook/confirm
 * Bancard llama a este endpoint cuando finaliza un pago (single_buy o charge).
 * Debe responder HTTP 200 con { "status": "success" } en menos de 30 segundos.
 */
router.post('/confirm', async (req, res) => {
  // Bancard exige responder HTTP 200 dentro de 30s. La validación por el token del
  // webhook NO es confiable: la fórmula documentada md5(private_key + shop_process_id +
  // "confirm" + amount + currency) NO reproduce el token que vPOS realmente envía (verificado
  // contra el token real con la private_key correcta). Por eso NO confiamos en el payload:
  // respondemos 200 y verificamos el estado REAL de la transacción de forma SEGURA con
  // get_confirmation (consulta activa firmada con NUESTRA private_key). Así, aunque un
  // atacante POSTee una confirmación falsa, el estado siempre se deriva de la consulta
  // server-to-server, nunca de los datos del webhook.
  const shopProcessId = req.body?.operation?.shop_process_id;
  res.json({ status: 'success' });
  if (!shopProcessId) return;

  // Verificación + acreditación IDEMPOTENTE del valor (membresía/recarga/turno), derivada del
  // estado REAL de Bancard (get_confirmation), NO del payload del webhook. Es la red de seguridad
  // para que un pago aprobado entregue su valor aunque el frontend nunca llame al *-3ds-complete.
  // Usa el prisma singleton (req.prisma): NO instanciar un PrismaClient por webhook — los reintentos
  // de Bancard agotarían el pool de conexiones de Postgres.
  setImmediate(async () => {
    try {
      const r = await materializeApprovedPayment(req.prisma, shopProcessId);
      console.log(`[Bancard /confirm] shop_process_id=${shopProcessId} → ${r.status}${r.kind ? ' (' + r.kind + ')' : ''}${r.reason ? ' [' + r.reason + ']' : ''}`);
    } catch (err) {
      console.error('[Bancard /confirm] materialización:', err.message);
    }
  });
});

/**
 * POST /api/bancard/webhook/card-confirm
 * Callback después de catastro de tarjeta (si Bancard envía confirmación por webhook)
 */
router.post('/card-confirm', (req, res) => {
  // Solo confirmar recepción - el frontend maneja el resultado via iframe message
  res.json({ status: 'success' });
});

/**
 * GET /api/bancard/test-catastro
 * Página de catastro de prueba (STAGING). Genera un process_id DESDE NUESTRA
 * integración (cards/new) y monta el formulario de Bancard. Al catastrar una
 * tarjeta con éxito se marcan "Solicitud de catastro" y "Catastro de tarjeta".
 */
router.get('/test-catastro', async (req, res) => {
  try {
    const cardId = Math.floor(Math.random() * 900000) + 100000;
    const { processId } = await bancardService.registerCard({
      cardId,
      userId: 1,
      userEmail: 'test@luxurygarage.com',
      userPhone: '0981000000',
      returnUrl: 'https://luxurygarage.arizar-ia.cloud/api/bancard/test-catastro-result',
    });
    // El form de Bancard carga un script externo (vpos:8888) → quitamos el CSP de helmet para esta página.
    res.removeHeader('Content-Security-Policy');
    res.set('Content-Type', 'text/html').send(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Catastro Bancard — Luxury Garage</title>
<script src="${bancardService.jsLibUrl}"></script>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:24px auto;padding:0 16px;color:#0f172a}h2{color:#1d4ed8}code{background:#f1f5f9;padding:2px 6px;border-radius:6px}#cc{width:100%;min-height:540px;border:1px solid #e2e8f0;border-radius:12px;margin-top:12px}</style>
</head><body>
<h2>Catastrar tarjeta — prueba staging</h2>
<p>Cargá la tarjeta <b>Bancard 8601010000000013</b>, venc <b>08/26</b>, <b>sin CVC</b>, cédula <b>9661000</b>.</p>
<p style="font-size:12px;color:#64748b">process_id: <code>${processId}</code></p>
<div id="cc"></div>
<script>try{ Bancard.Cards.createForm('cc','${processId}'); }catch(e){ document.getElementById('cc').textContent='Error cargando el formulario: '+e.message; }</script>
</body></html>`);
  } catch (err) {
    res.status(500).send('Error iniciando catastro: ' + (err.message || 'desconocido'));
  }
});

// Resultado del catastro de prueba (return_url)
router.get('/test-catastro-result', (req, res) => {
  res.removeHeader('Content-Security-Policy');
  res.set('Content-Type', 'text/html').send('<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;text-align:center;color:#0f172a}</style></head><body><h2>✅ Operación finalizada</h2><p>Volvé al portal de Bancard y refrescá la <b>Lista de tests</b>. Ya podés cerrar esta pestaña.</p></body></html>');
});

/**
 * GET /api/bancard/test-pago
 * Página de PAGO OCASIONAL de prueba (STAGING). Genera un single_buy DESDE NUESTRA
 * integración y monta el checkout de Bancard. Al pagar con éxito se marcan
 * "Confirmamos correctamente al comercio" y "Recibimos pedido de confirmación".
 */
router.get('/test-pago', async (req, res) => {
  try {
    const monto = parseInt(req.query.monto, 10) || 1000; // staging: single_buy tiene tope bajo; 10000 da "EXCEDE IMPORTE MAXIMO"
    const shopProcessId = Date.now();
    const { processId } = await bancardService.singleBuy({
      shopProcessId,
      amount: monto,
      currency: 'PYG',
      description: 'Pago de prueba Luxury Garage',
      returnUrl: 'https://luxurygarage.arizar-ia.cloud/api/bancard/test-catastro-result',
      cancelUrl: 'https://luxurygarage.arizar-ia.cloud/api/bancard/test-catastro-result',
    });
    console.log('[Bancard test-pago] shop_process_id=' + shopProcessId + ' process_id=' + processId);
    lastTestPaymentSp = shopProcessId;
    res.removeHeader('Content-Security-Policy');
    res.set('Content-Type', 'text/html').send(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pago Bancard — Luxury Garage</title>
<script src="${bancardService.jsLibUrl}"></script>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:24px auto;padding:0 16px;color:#0f172a}h2{color:#1d4ed8}code{background:#f1f5f9;padding:2px 6px;border-radius:6px}#cc{width:100%;min-height:540px;border:1px solid #e2e8f0;border-radius:12px;margin-top:12px}</style>
</head><body>
<h2>Pago ocasional — prueba staging</h2>
<p>Monto: <b>Gs. ${monto.toLocaleString('es-PY')}</b>. El pago tiene que salir <b>APROBADO (code 00)</b>. Si da "denegada"/"excede límite", recargá esta URL agregando <code>?monto=5000</code> (o 1000, 2500, 3000) para probar montos chicos, y/o probá otra tarjeta.</p>
<p>Visa <b>4907860500000016</b> · 08/26 · CVC 570 — MC <b>5418630110000014</b> · 08/26 · CVC 277 — cédula <b>9661000</b>.</p>
<p style="font-size:12px;color:#64748b">shop_process_id: <code>${shopProcessId}</code></p>
<div id="cc"></div>
<script>try{ Bancard.Checkout.createForm('cc','${processId}'); }catch(e){ document.getElementById('cc').textContent='Error cargando el checkout: '+e.message; }</script>
</body></html>`);
  } catch (err) {
    res.status(500).send('Error iniciando pago: ' + (err.message || 'desconocido'));
  }
});

/**
 * GET /api/bancard/test-rollback-ultimo
 * Hace el rollback del último single_buy de /test-pago. Marca "Recibir rollback"
 * SOLO si la transacción fue APROBADA (code 00) y no está cuponada (mismo día).
 */
router.get('/test-rollback-ultimo', async (req, res) => {
  res.removeHeader('Content-Security-Policy');
  const page = (title, body) => res.set('Content-Type', 'text/html').send(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#0f172a}h2{color:#1d4ed8}code{background:#f1f5f9;padding:2px 6px;border-radius:6px;word-break:break-all}p{line-height:1.5}</style></head><body><h2>${title}</h2>${body}</body></html>`);

  if (!lastTestPaymentSp) {
    return page('Sin pago para revertir', '<p>Primero hacé un pago en <code>/api/bancard/test-pago</code> y volvé a esta página.</p>');
  }
  const sp = lastTestPaymentSp;
  let estado = '?', rollback = '?', aprobado = false;
  try {
    const conf = await bancardService.getConfirmation(sp);
    aprobado = conf?.response === 'S' && String(conf?.response_code) === '00';
    estado = `response=${conf?.response} · code=${conf?.response_code} · ${conf?.response_description || ''}`;
  } catch (e) { estado = 'no se pudo consultar (' + e.message + ')'; }
  try {
    const rb = await bancardService.rollback(sp);
    rollback = JSON.stringify(rb);
  } catch (e) { rollback = 'error: ' + e.message; }

  page('Rollback del último pago', `
    <p>shop_process_id: <code>${sp}</code></p>
    <p>Estado del pago: <code>${estado}</code></p>
    <p>Resultado del rollback: <code>${rollback}</code></p>
    <p style="color:#64748b">${aprobado
      ? 'El pago estaba APROBADO. Si el rollback dice success/RollbackSuccessful, volvé al portal y refrescá: "Recibir rollback" debería pintarse en verde. ✅'
      : '⚠️ El pago NO estaba aprobado (code distinto de 00). Volvé a /api/bancard/test-pago, probá otra tarjeta hasta que el pago salga APROBADO, y recién ahí volvé a esta página.'}</p>`);
});

module.exports = router;
