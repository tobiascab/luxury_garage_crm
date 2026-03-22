const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

// POST /api/uploads — subir archivo
router.post('/', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No se envió un archivo' });

  const type = req.query.type || 'services';
  const url = `/uploads/${type}/${req.file.filename}`;

  res.json({ success: true, data: { url, filename: req.file.filename, size: req.file.size } });
});

// POST /api/uploads/multiple — subir múltiples archivos
router.post('/multiple', authenticate, upload.array('files', 10), (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ success: false, message: 'No se enviaron archivos' });

  const type = req.query.type || 'services';
  const urls = req.files.map(f => ({ url: `/uploads/${type}/${f.filename}`, filename: f.filename, size: f.size }));

  res.json({ success: true, data: urls });
});

module.exports = router;
