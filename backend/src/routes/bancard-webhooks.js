const router = require('express').Router();
const bancardService = require('../services/bancardService');

/**
 * POST /api/bancard/webhook/confirm
 * Bancard llama a este endpoint cuando finaliza un pago (single_buy o charge).
 * Debe responder HTTP 200 con { "status": "success" } en menos de 30 segundos.
 */
router.post('/confirm', async (req, res) => {
  try {
    const { operation } = req.body;
    if (!operation) {
      return res.status(400).json({ status: 'error' });
    }

    const {
      shop_process_id,
      response,
      response_code,
      amount,
      currency,
      token,
      authorization_number,
      ticket_number,
    } = operation;

    // 1. Verificar el token del webhook
    const isValid = bancardService.verifyWebhookToken({
      shopProcessId: shop_process_id,
      amount: amount,
      currency: currency || 'PYG',
      token: token,
    });

    if (!isValid) {
      console.error('❌ Bancard webhook: token inválido para shop_process_id', shop_process_id);
      return res.status(401).json({ status: 'error' });
    }

    // 2. Siempre responder 200 inmediatamente a Bancard
    // El procesamiento real se hace de forma asíncrona
    res.json({ status: 'success' });

    // 3. Procesar en background (después de responder)
    setImmediate(async () => {
      try {
        // Necesitamos acceder a prisma - lo importamos aquí
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        const approved = response === 'S' && response_code === '00';

        // Buscar la operación pendiente
        const operation_record = await prisma.bancardOperation.findUnique({
          where: { shopProcessId: parseInt(shop_process_id) },
        });

        if (!operation_record) {
          console.warn('⚠️ Bancard webhook: operación no encontrada para shop_process_id', shop_process_id);
          await prisma.$disconnect();
          return;
        }

        // Actualizar estado de la operación
        await prisma.bancardOperation.update({
          where: { shopProcessId: parseInt(shop_process_id) },
          data: {
            status: approved ? 'COMPLETED' : 'FAILED',
          },
        });

        if (approved && operation_record.type === 'charge') {
          // Actualizar el payment record con los datos de Bancard
          await prisma.payment.updateMany({
            where: { bancardShopProcessId: parseInt(shop_process_id) },
            data: {
              status: 'COMPLETED',
              bancardTicketNumber: ticket_number?.toString(),
              bancardAuthNumber: authorization_number?.toString(),
            },
          });

          console.log(`✅ Bancard webhook: pago aprobado shop_process_id=${shop_process_id} ticket=${ticket_number}`);
        } else if (!approved) {
          // Marcar payment como fallido
          await prisma.payment.updateMany({
            where: { bancardShopProcessId: parseInt(shop_process_id) },
            data: { status: 'FAILED' },
          });
          console.warn(`⚠️ Bancard webhook: pago rechazado shop_process_id=${shop_process_id} code=${response_code}`);
        }

        await prisma.$disconnect();
      } catch (err) {
        console.error('❌ Bancard webhook procesamiento:', err.message);
      }
    });

  } catch (err) {
    console.error('❌ Bancard webhook error:', err.message);
    // Siempre responder 200 para que Bancard no reintente
    res.json({ status: 'success' });
  }
});

/**
 * POST /api/bancard/webhook/card-confirm
 * Callback después de catastro de tarjeta (si Bancard envía confirmación por webhook)
 */
router.post('/card-confirm', (req, res) => {
  // Solo confirmar recepción - el frontend maneja el resultado via iframe message
  res.json({ status: 'success' });
});

module.exports = router;
