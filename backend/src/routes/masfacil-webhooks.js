const router = require('express').Router();
const bcrypt = require('bcryptjs');
const masfacilService = require('../services/masfacilService');
const arizarService = require('../services/arizarService');
const ArizarSync = require('../services/arizarSync');

/**
 * MasFacil Webhook Handler
 * Recibe confirmaciones de pago y activa membresías
 */
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['x-masfacil-signature'] || req.headers['x-webhook-signature'];
    const body = req.body;

    // Verify signature
    if (!masfacilService.verifyWebhookSignature(signature, body)) {
      console.error('❌ MasFacil webhook firma inválida');
      return res.status(401).json({ success: false });
    }

    const { event, data, payment_id, status, metadata, reference } = body;
    console.log(`💳 MasFacil webhook: ${event || status}`, { payment_id, reference });

    // Log
    try {
      await req.prisma.auditLog.create({
        data: { entity: 'masfacil', action: event || status || 'webhook', entityId: payment_id || reference || 'unknown', details: { status, metadata, reference, amount: data?.amount } }
      });
    } catch (e) { /* silent */ }

    // Process paid events
    const isPaid = (event === 'payment.completed' || event === 'payment.success' || status === 'paid' || status === 'completed');

    if (isPaid && metadata) {
      const { userId, planId, planName } = metadata;

      if (userId && planId) {
        // 1. Activate membership
        const plan = await req.prisma.plan.findUnique({ where: { id: planId } });
        const user = await req.prisma.user.findUnique({ where: { id: userId } });

        if (plan && user) {
          // Cancel existing active membership
          await req.prisma.membership.updateMany({
            where: { userId: user.id, status: 'ACTIVE' },
            data: { status: 'REPLACED' }
          });

          // Create new
          const start = new Date();
          const end = new Date(); end.setMonth(end.getMonth() + 1);
          const membership = await req.prisma.membership.create({
            data: { userId: user.id, planId: plan.id, status: 'ACTIVE', startDate: start, endDate: end, autoRenew: true },
            include: { plan: true }
          });

          // 2. Create invoice in ARIZAR IA
          if (user.arizarContactId) {
            try {
              const invoiceResult = await arizarService.createInvoice({
                contactId: user.arizarContactId,
                name: `Membresía ${plan.name} - ${start.toLocaleDateString('es-PY')}`,
                items: [{ name: `Plan ${plan.name}`, amount: plan.priceGs || data?.amount, quantity: 1 }],
                currency: 'PYG',
              });

              const invoiceId = invoiceResult?.invoice?.id || invoiceResult?.id;
              if (invoiceId) {
                // Record payment
                await arizarService.recordPayment(invoiceId, {
                  amount: plan.priceGs || data?.amount,
                  mode: 'custom',
                  notes: `MasFacil - Ref: ${reference || payment_id}`,
                });

                // Send invoice
                await arizarService.sendInvoice(invoiceId);
                console.log(`🧾 Factura ARIZAR creada y enviada: ${invoiceId}`);
              }
            } catch (invErr) {
              console.error('Error creando factura ARIZAR:', invErr.message);
            }

            // 3. Update tags
            await arizarService.updateContactTags(user.arizarContactId, ['miembro-activo', `plan-${plan.slug}`]);
            await arizarService.removeContactTags(user.arizarContactId, ['miembro-inactivo', 'renovacion-pendiente']);

            // 4. WhatsApp notification
            await arizarService.sendWhatsApp(user.arizarContactId,
              `✅ ¡Pago confirmado, ${user.firstName}!\n\n` +
              `Tu membresía ${plan.name} está activa.\n` +
              `📅 Vigencia: ${start.toLocaleDateString('es-PY')} al ${end.toLocaleDateString('es-PY')}\n\n` +
              `Agendá tu próximo turno: https://luxurygarage.arizar-ia.cloud/client/book`
            );

            // 5. Add to welcome workflow
            const sync = new ArizarSync(req.prisma);
            await sync.syncMembershipActivated(user, membership);
          }

          console.log(`✅ Membresía ${plan.name} activada para ${user.email} (MasFacil: ${payment_id})`);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ MasFacil webhook error:', err.message);
    next(err);
  }
});

/**
 * POST /api/masfacil/create-payment
 * Genera link de pago para que el cliente pague su membresía
 */
router.post('/create-payment', async (req, res, next) => {
  try {
    // Can be called authenticated (from portal) or from bot
    const { userId, planId, email, name } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: 'planId requerido' });

    const plan = await req.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

    let user = null;
    if (userId) {
      user = await req.prisma.user.findUnique({ where: { id: userId } });
    }

    const paymentData = {
      userId: user?.id || userId || 'guest',
      email: user?.email || email || '',
      name: user ? `${user.firstName} ${user.lastName}` : (name || 'Cliente'),
      amount: plan.priceGs || 0,
      planName: plan.name,
      planId: plan.id,
      description: `Membresía ${plan.name} - Luxury Garage`,
    };

    const result = await masfacilService.generatePaymentLink(paymentData);

    if (!result) {
      return res.status(503).json({ success: false, message: 'Servicio de pago no disponible. Contactanos por WhatsApp.' });
    }

    // Log
    await req.prisma.auditLog.create({
      data: { entity: 'payment', action: 'link_created', entityId: result.paymentId || 'unknown', userId: user?.id, details: { plan: plan.name, amount: plan.priceGs, reference: result.reference } }
    });

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

module.exports = router;
