const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const arizarService = require('../services/arizarService');

/**
 * Invoices from ARIZAR IA
 * Las facturas se crean y viven en ARIZAR. Este endpoint las sirve al frontend.
 */

// GET /api/invoices-crm/mine — Client gets their invoices from ARIZAR
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.arizarContactId) {
      return res.json({ success: true, data: [], message: 'No hay facturas disponibles' });
    }

    const invoices = await arizarService.getContactInvoices(user.arizarContactId);
    res.json({ success: true, data: invoices });
  } catch (err) { next(err); }
});

// GET /api/invoices-crm/all — Admin gets all invoices
router.get('/all', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const invoices = await arizarService._safe(async () => {
      const response = await arizarService.client.get('/invoices/', {
        params: { locationId: arizarService.locationId, limit: 100 }
      });
      return response.data?.invoices || response.data?.data || [];
    }, []);

    res.json({ success: true, data: invoices });
  } catch (err) { next(err); }
});

// GET /api/invoices-crm/user/:userId — Admin gets invoices for a specific user
router.get('/user/:userId', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const user = await req.prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!user?.arizarContactId) {
      return res.json({ success: true, data: [] });
    }
    const invoices = await arizarService.getContactInvoices(user.arizarContactId);
    res.json({ success: true, data: invoices });
  } catch (err) { next(err); }
});

// POST /api/invoices-crm/create — Admin creates invoice manually
router.post('/create', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const { userId, name, items } = req.body;
    const user = await req.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.arizarContactId) {
      return res.status(400).json({ success: false, message: 'Usuario no vinculado al CRM' });
    }

    const invoice = await arizarService.createInvoice({
      contactId: user.arizarContactId, name, items, currency: 'PYG'
    });

    if (invoice) {
      const invoiceId = invoice?.invoice?.id || invoice?.id;
      if (invoiceId) await arizarService.sendInvoice(invoiceId);
    }

    res.json({ success: true, data: invoice, message: 'Factura creada y enviada' });
  } catch (err) { next(err); }
});

module.exports = router;
