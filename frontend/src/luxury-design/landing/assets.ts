/**
 * Assets de la landing — TODOS verificados (HTTP 200) por la flota de research.
 * VIDEOS: locales en /public (descargados, no hotlink; no entran al precache PWA).
 * IMÁGENES: Unsplash por hotlink (SW las cachea; licencia Unsplash, uso comercial).
 *
 * Foco: el SERVICIO de lavado/detailing EN ACCIÓN (espuma, lavado, pulido,
 * cerámico, agua perlando), no autos "de concesionaria".
 */

const ux = (slug: string, w = 2000) =>
  `https://images.unsplash.com/${slug}?w=${w}&q=80&auto=format&fit=crop`;

// Videos de detailing en acción (local /public).
export const VIDEO = {
  foam: '/wash-foam.mp4',         // aplicación de espuma / snow foam
  beading: '/wash-beading.mp4',   // enjuague auto negro, agua perlando (premium)
  pressure: '/wash-pressure.mp4', // lavado con agua a presión
  wheels: '/wash-wheels.mp4',     // detailing de llanta/rin (liviano)
  polish: '/wash-polish.mp4',     // pulido con pulidora orbital
  // Hero anterior (auto de noche) disponible como acento.
  night: '/hero.mp4',
  nightMobile: '/hero-mobile.mp4',
};

// Imágenes del servicio en acción.
export const IMG = {
  heroPoster: ux('photo-1607860108855-64acf2078ed9', 2400), // espuma sobre coupe oscuro
  foam: ux('photo-1607860108855-64acf2078ed9'),
  handWash: [
    ux('photo-1694678505383-676d78ea3b96'),
    ux('photo-1652898072202-5084dc85b850'),
    ux('photo-1704796141009-5ed5cc8ca5f3'),
    ux('photo-1527581849771-416a9d62308e'),
  ],
  ceramic: [
    ux('photo-1632823469850-2f77dd9c7f93'),
    ux('photo-1708805282706-f44730b7e527'),
  ],
  polishing: ux('photo-1632823469901-5d2cfff5ba50'),
  microfiber: [
    ux('photo-1761934658331-2e00b20dc6c6'),
    ux('photo-1761934658038-d0e6792378b1'),
    ux('photo-1761934657948-708146148588'),
  ],
  waterBeading: ux('photo-1611239179213-d972da54091a'),
  wheels: ux('photo-1565689876697-e467b6c54da2'),
  // Acentos de auto premium (uso secundario).
  carNight: ux('photo-1503376780353-7e6692767b70', 2400),
  carWhite: ux('photo-1544829099-b9a0c07fad1a'),

  // ── Alias legacy (compat con secciones existentes) → ahora apuntan a detailing ──
  get exterior() { return [this.foam, this.polishing, this.waterBeading, this.wheels, ...this.handWash]; },
  get detailing() { return [this.foam, ...this.ceramic]; },
  get interior() { return this.microfiber[0]; },
  get night() { return [this.waterBeading, this.carNight, ...this.microfiber]; },
};

// Lista plana para galerías parallax (todo detailing en acción).
export const GALLERY = [
  IMG.foam,
  IMG.polishing,
  IMG.waterBeading,
  ...IMG.handWash,
  ...IMG.microfiber,
  IMG.wheels,
  ...IMG.ceramic,
];
