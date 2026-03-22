const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/settings — obtener configuración del lavadero
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const settings = await req.prisma.setting.findMany({ orderBy: { key: 'asc' } });
    // Convert array to object for easy access
    const config = {};
    settings.forEach(s => { config[s.key] = s.value; });
    res.json({ success: true, data: config });
  } catch (err) { next(err); }
});

// PUT /api/settings — actualizar configuración (solo super_admin)
router.put('/', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const updates = req.body; // { key: value, key2: value2, ... }
    const results = [];

    for (const [key, value] of Object.entries(updates)) {
      const setting = await req.prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
      results.push(setting);
    }

    // Log the action
    await req.prisma.auditLog.create({
      data: { userId: req.user.id, action: 'UPDATE_SETTINGS', entity: 'Setting', details: updates },
    });

    res.json({ success: true, data: results, message: 'Configuración actualizada' });
  } catch (err) { next(err); }
});

module.exports = router;
