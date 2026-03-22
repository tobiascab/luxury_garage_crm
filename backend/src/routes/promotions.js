const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try { const promos = await req.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: promos });
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try { const promo = await req.prisma.promotion.create({ data: req.body });
    res.status(201).json({ success: true, data: promo });
  } catch (err) { next(err); }
});

router.post('/validate', authenticate, async (req, res, next) => {
  try { const { code } = req.body;
    const promo = await req.prisma.promotion.findUnique({ where: { code } });
    if (!promo || !promo.isActive) return res.status(404).json({ success: false, message: 'Código inválido' });
    if (new Date() > promo.validUntil) return res.status(400).json({ success: false, message: 'Código expirado' });
    if (promo.maxUses && promo.usesCount >= promo.maxUses) return res.status(400).json({ success: false, message: 'Código agotado' });
    res.json({ success: true, data: { type: promo.type, value: promo.value } });
  } catch (err) { next(err); }
});

module.exports = router;
