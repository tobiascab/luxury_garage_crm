/**
 * Ilustraciones de producto para el catálogo.
 *
 * Se dibujan acá en vez de bajar fotos de internet: las búsquedas de imágenes devuelven fotos
 * de contexto —una mesa de evento con botellas, una lámpara encendida— con encuadres distintos
 * en cada tarjeta, y la grilla queda improvisada. Dibujadas, todas comparten proporción,
 * encuadre y estilo.
 *
 * Sin gradientes ni `url(#id)` a propósito: colores planos y reflejos explícitos, para que la
 * ilustración se vea igual en el navegador y en cualquier renderer (lo que además permite
 * revisarlas sin abrir la app).
 */

const FONDO = '#eef2f8';
const piso = `
  <rect y="470" width="800" height="130" fill="#e2e8f0"/>
  <ellipse cx="400" cy="514" rx="152" ry="18" fill="#94a3b8" opacity="0.35"/>`;

// Volumen del envase: un reflejo claro a la izquierda y una sombra propia a la derecha.
const volumen = (x, y, w, h, r = 0) => `
  <rect x="${x}" y="${y}" width="${w * 0.18}" height="${h}" rx="${r}" fill="#ffffff" opacity="0.22"/>
  <rect x="${x + w * 0.80}" y="${y}" width="${w * 0.20}" height="${h}" rx="${r}" fill="#0f172a" opacity="0.12"/>`;

const titulo = (t, y, fill = '#ffffff', size = 30) =>
  `<text x="400" y="${y}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="${size}" font-weight="700" fill="${fill}">${t}</text>`;
const subtitulo = (t, y, fill = '#ffffff') => t
  ? `<text x="400" y="${y}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="15" fill="${fill}" opacity="0.9" letter-spacing="2.2">${String(t).toUpperCase()}</text>`
  : '';

const D = {
  botella: ({ color, texto, marca, liquido }) => `
  <path d="M352 120 h96 v28 q0 18 11 33 l17 24 q15 21 15 48 v217 q0 22 -22 22 h-138 q-22 0 -22 -22 v-217 q0 -27 15 -48 l17 -24 q11 -15 11 -33 z" fill="${liquido}"/>
  ${volumen(342, 190, 116, 272)}
  <rect x="350" y="86" width="100" height="38" rx="8" fill="${color}"/>
  <rect x="350" y="86" width="18" height="38" rx="8" fill="#ffffff" opacity="0.25"/>
  <rect x="292" y="272" width="216" height="130" fill="${color}"/>
  ${volumen(292, 272, 216, 130)}
  ${titulo(texto, 328)}${subtitulo(marca, 362)}`,

  agua: ({ color, texto, marca }) => `
  <path d="M356 132 h88 v26 q0 16 10 30 l15 21 q14 20 14 45 v208 q0 21 -21 21 h-124 q-21 0 -21 -21 v-208 q0 -25 14 -45 l15 -21 q10 -14 10 -30 z" fill="#cfe4f5"/>
  ${volumen(338, 196, 124, 261)}
  <rect x="354" y="98" width="92" height="36" rx="8" fill="${color}"/>
  <rect x="300" y="286" width="200" height="112" fill="${color}"/>
  ${volumen(300, 286, 200, 112)}
  ${titulo(texto, 338)}${subtitulo(marca, 372)}`,

  lata: ({ color, texto, marca }) => `
  <rect x="298" y="128" width="204" height="360" rx="28" fill="${color}"/>
  ${volumen(298, 156, 204, 304)}
  <rect x="298" y="128" width="204" height="30" rx="15" fill="#c3ccd8"/>
  <ellipse cx="400" cy="141" rx="102" ry="16" fill="#dbe2ea"/>
  <ellipse cx="400" cy="141" rx="34" ry="7" fill="#aab6c4"/>
  <rect x="298" y="462" width="204" height="26" rx="13" fill="#c3ccd8"/>
  ${titulo(texto, 316)}${subtitulo(marca, 350)}`,

  deportiva: ({ color, texto, marca }) => `
  <path d="M326 178 q0 -36 32 -36 h84 q32 0 32 36 v276 q0 34 -32 34 h-84 q-32 0 -32 -34 z" fill="${color}"/>
  ${volumen(326, 178, 148, 310)}
  <rect x="362" y="92" width="76" height="54" rx="11" fill="#f97316"/>
  <rect x="352" y="82" width="96" height="20" rx="9" fill="#fb923c"/>
  <rect x="326" y="272" width="148" height="104" fill="#ffffff"/>
  ${titulo(texto, 318, color, 27)}${subtitulo(marca, 350, color)}`,

  carton: ({ color, texto, marca }) => `
  <path d="M306 176 h188 v312 h-188 z" fill="${color}"/>
  ${volumen(306, 176, 188, 312)}
  <path d="M306 176 l94 -58 l94 58 z" fill="#0f172a" opacity="0.18"/>
  <rect x="376" y="102" width="48" height="34" rx="6" fill="#334155"/>
  <circle cx="400" cy="286" r="54" fill="#ffffff"/>
  <circle cx="400" cy="286" r="41" fill="#fb923c"/>
  <path d="M400 245 v82 M359 286 h82" stroke="#ffffff" stroke-width="4" opacity="0.5"/>
  ${titulo(texto, 392)}${subtitulo(marca, 426)}`,

  taza: () => `
  <ellipse cx="400" cy="474" rx="156" ry="28" fill="#cbd5e1"/>
  <ellipse cx="400" cy="464" rx="156" ry="28" fill="#f8fafc"/>
  <path d="M496 262 q60 0 60 48 q0 48 -60 48" fill="none" stroke="#f1f5f9" stroke-width="24" stroke-linecap="round"/>
  <path d="M496 262 q60 0 60 48 q0 48 -60 48" fill="none" stroke="#cbd5e1" stroke-width="8" stroke-linecap="round" opacity="0.5"/>
  <path d="M288 236 h224 v116 q0 96 -112 96 q-112 0 -112 -96 z" fill="#ffffff"/>
  <path d="M288 236 h40 v116 q0 60 30 82 q-70 -14 -70 -82 z" fill="#e2e8f0" opacity="0.55"/>
  <ellipse cx="400" cy="238" rx="112" ry="27" fill="#f1f5f9"/>
  <ellipse cx="400" cy="240" rx="95" ry="20" fill="#4b2e1c"/>
  <ellipse cx="400" cy="236" rx="72" ry="13" fill="#b5824e"/>
  <path d="M366 194 q-15 -26 2 -50 M400 188 q-15 -30 2 -54 M434 194 q-15 -26 2 -50"
        fill="none" stroke="#cbd5e1" stroke-width="7" stroke-linecap="round"/>`,

  bolsa: ({ color, texto, marca }) => `
  <path d="M282 148 h236 l-18 34 v268 l18 38 h-236 l18 -38 v-268 z" fill="${color}"/>
  ${volumen(300, 182, 200, 268)}
  <path d="M282 148 h236 l-18 34 h-200 z" fill="#0f172a" opacity="0.24"/>
  <path d="M300 450 h200 l18 38 h-236 z" fill="#0f172a" opacity="0.24"/>
  <ellipse cx="400" cy="308" rx="92" ry="66" fill="#ffffff"/>
  ${titulo(texto, 302, color)}${subtitulo(marca, 336, color)}`,

  paquete: ({ color, texto, marca }) => `
  <rect x="266" y="190" width="268" height="266" rx="18" fill="${color}"/>
  ${volumen(266, 190, 268, 266, 18)}
  <path d="M266 218 h268 M266 428 h268" stroke="#ffffff" stroke-width="3" opacity="0.3"/>
  <circle cx="352" cy="322" r="50" fill="#1f2937"/><circle cx="352" cy="322" r="31" fill="#f8fafc"/>
  <circle cx="450" cy="344" r="43" fill="#111827"/><circle cx="450" cy="344" r="26" fill="#f8fafc"/>
  ${titulo(texto, 258)}${subtitulo(marca, 418)}`,

  tableta: ({ color, texto, marca }) => {
    const c = [];
    for (let f = 0; f < 4; f++) for (let k = 0; k < 3; k++)
      c.push(`<rect x="${306 + k * 64}" y="${262 + f * 46}" width="56" height="38" rx="6" fill="#8a5626" opacity="${0.55 + f * 0.07}"/>`);
    return `
  <rect x="282" y="168" width="236" height="300" rx="16" fill="${color}"/>
  ${volumen(282, 168, 236, 300, 16)}
  <rect x="296" y="248" width="208" height="204" rx="10" fill="#a9703c"/>
  ${c.join('')}
  ${titulo(texto, 224)}${subtitulo(marca, 462)}`;
  },

  arbolito: ({ color, texto }) => `
  <rect x="396" y="126" width="8" height="44" fill="#94a3b8"/>
  <circle cx="400" cy="120" r="10" fill="none" stroke="#94a3b8" stroke-width="6"/>
  <path d="M400 162 l56 78 h-32 l45 72 h-36 l47 78 h-160 l47 -78 h-36 l45 -72 h-32 z" fill="${color}"/>
  <path d="M400 162 l56 78 h-32 l45 72 h-36 l47 78 h-80 z" fill="#0f172a" opacity="0.12"/>
  <rect x="376" y="390" width="48" height="60" rx="6" fill="#7c4a1e"/>
  ${titulo(texto, 330, '#ffffff', 21)}`,

  pano: ({ color, texto }) => `
  <rect x="244" y="238" width="312" height="228" rx="20" fill="${color}" opacity="0.45"/>
  <rect x="262" y="212" width="276" height="226" rx="18" fill="${color}" opacity="0.72"/>
  <rect x="280" y="184" width="240" height="222" rx="16" fill="${color}"/>
  ${volumen(280, 184, 240, 222, 16)}
  <g stroke="#ffffff" stroke-width="2" opacity="0.3">
    ${Array.from({ length: 7 }, (_, i) => `<path d="M${296 + i * 32} 196 v198"/>`).join('')}
    ${Array.from({ length: 6 }, (_, i) => `<path d="M290 ${206 + i * 33} h220"/>`).join('')}
  </g>
  ${titulo(texto, 302, '#ffffff', 23)}`,
};

/** SVG de 800×600 con el producto siempre en el mismo encuadre. */
function ilustracion(tipo, o = {}) {
  const dibujo = D[tipo];
  if (!dibujo) throw new Error(`Ilustración desconocida: ${tipo}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" role="img" aria-label="${o.texto || tipo}">
  <rect width="800" height="600" fill="${FONDO}"/>
  ${piso}
  ${dibujo(o)}
</svg>`;
}

module.exports = { ilustracion, TIPOS: Object.keys(D) };
