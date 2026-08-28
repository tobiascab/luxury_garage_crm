#!/usr/bin/env node
/**
 * Borra de dist/assets los archivos que ya no usa la versión publicada y que además son
 * viejos.
 *
 * Va de la mano con `emptyOutDir: false`: los chunks de builds anteriores se conservan a
 * propósito, para que a quien tenga la app abierta no se le caiga la navegación. Pero no
 * pueden acumularse para siempre — esto saca los que ya nadie va a pedir.
 *
 *   npm run limpiar-assets           → muestra qué borraría
 *   npm run limpiar-assets --aplicar → los borra
 */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const ASSETS = path.join(DIST, 'assets');
const DIAS_GRACIA = 7;
const aplicar = process.argv.includes('--aplicar');

// Todo lo que la versión actual referencia (index.html + los propios chunks + el service worker).
const referencias = new Set();
const escanear = (archivo) => {
  const txt = fs.readFileSync(archivo, 'utf8');
  for (const m of txt.matchAll(/[A-Za-z0-9_.-]+\.(?:js|css|woff2?|png|jpe?g|svg|webp|mp4)/g)) referencias.add(m[0]);
};
escanear(path.join(DIST, 'index.html'));
for (const f of ['sw.js', 'manifest.webmanifest']) {
  const p = path.join(DIST, f);
  if (fs.existsSync(p)) escanear(p);
}
for (const f of fs.readdirSync(ASSETS)) {
  if (f.endsWith('.js') || f.endsWith('.css')) escanear(path.join(ASSETS, f));
}

const corte = Date.now() - DIAS_GRACIA * 24 * 60 * 60 * 1000;
let borrados = 0, bytes = 0, conservados = 0;
for (const f of fs.readdirSync(ASSETS)) {
  const p = path.join(ASSETS, f);
  const st = fs.statSync(p);
  if (referencias.has(f)) { conservados++; continue; }
  if (st.mtimeMs > corte) { conservados++; continue; } // todavía en período de gracia
  borrados++; bytes += st.size;
  if (aplicar) fs.unlinkSync(p);
  else console.log(`   ${f} (${(st.size / 1024).toFixed(0)} KB, ${Math.round((Date.now() - st.mtimeMs) / 86400000)} días)`);
}
console.log(`\n  ${aplicar ? 'Borrados' : 'Se borrarían'}: ${borrados} archivo(s) · ${(bytes / 1048576).toFixed(1)} MB · se conservan ${conservados}`);
if (!aplicar && borrados) console.log('  Para borrarlos: npm run limpiar-assets --aplicar');
