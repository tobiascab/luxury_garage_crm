const router = require('express').Router();

// MasFacil fue reemplazado por Bancard. Este endpoint ya no procesa pagos.
router.all('*', (req, res) => {
  res.status(410).json({ success: false, message: 'Este endpoint fue reemplazado por Bancard' });
});

module.exports = router;
