import React from 'react';

/**
 * Silueta del vehículo según su tipo de carrocería.
 *
 * Se usa cuando no hay foto del modelo: es preferible una silueta propia y coherente
 * que un espacio vacío o un ícono genérico repetido en toda la app. Van en el dorado
 * de la marca y comparten proporción, así la grilla se ve pareja.
 */

type Tipo = 'sedan' | 'suv' | 'pickup' | 'hatchback' | 'van';

/** Deduce la carrocería por el nombre del modelo. Sin acertar el 100%, acierta lo común. */
export function tipoDeVehiculo(marca = '', modelo = ''): Tipo {
  const t = `${marca} ${modelo}`.toLowerCase();
  if (/hilux|ranger|amarok|frontier|l200|d-max|s10|strada|saveiro|toro|oroch|maverick|poer|wingle|navara|triton/.test(t)) return 'pickup';
  if (/rav4|cr-v|crv|tucson|sportage|x-trail|xtrail|outlander|forester|creta|tracker|t-cross|ecosport|duster|renegade|compass|jimny|vitara|pajero|montero|fortuner|land cruiser|prado|santa fe|sorento|kicks|hr-v|asx|tiggo|jolion|h6|cx-5|seltos|corolla cross|territory|2008|captur/.test(t)) return 'suv';
  if (/hiace|sprinter|ducato|master|kangoo|partner|berlingo|transit|delica|noah|voxy|serena|spin|van|combi/.test(t)) return 'van';
  if (/march|note|vitz|fit|yaris|gol|onix|polo|swift|kwid|picanto|ka|fiesta|corsa|uno|mobi|palio|sandero|208|argo|celta|up|i10|i20|hb20|demio|probox|alto|celerio/.test(t)) return 'hatchback';
  return 'sedan';
}

const TRAZOS: Record<Tipo, string> = {
  // Perfiles de un solo trazo, a la misma escala (200×80) para que no bailen entre sí.
  sedan: 'M14 56 L22 44 Q26 38 34 36 L62 30 Q72 28 82 30 L118 38 Q130 41 140 46 L168 54 Q180 57 182 62 L183 66 Q183 70 178 70 L18 70 Q13 70 13 66 Z',
  hatchback: 'M16 56 L24 42 Q28 36 36 34 L64 28 Q74 26 84 29 L116 40 Q128 44 138 48 L156 56 Q166 60 167 65 L167 67 Q167 70 162 70 L20 70 Q15 70 15 66 Z',
  suv: 'M14 52 L20 36 Q24 28 34 26 L74 22 Q88 21 100 24 L134 34 Q148 38 160 44 L178 52 Q186 56 186 62 L186 66 Q186 70 181 70 L18 70 Q13 70 13 65 Z',
  pickup: 'M12 54 L18 38 Q22 30 32 28 L68 24 Q78 23 86 26 L104 36 L104 44 L176 44 Q186 45 186 52 L186 66 Q186 70 181 70 L16 70 Q11 70 11 65 Z',
  van: 'M14 50 L18 30 Q21 22 32 21 L140 20 Q156 20 166 28 L182 44 Q188 50 188 58 L188 66 Q188 70 183 70 L18 70 Q13 70 13 65 Z',
};

interface Props { marca?: string; modelo?: string; tipo?: Tipo; className?: string; }

export default function SiluetaVehiculo({ marca, modelo, tipo, className = '' }: Props) {
  const t = tipo || tipoDeVehiculo(marca, modelo);
  return (
    <svg viewBox="0 0 200 80" className={className} role="img" aria-label={`Silueta de ${t}`} fill="none">
      <defs>
        <linearGradient id={`lg-${t}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E3C05A" />
          <stop offset="55%" stopColor="#C9A227" />
          <stop offset="100%" stopColor="#A8811A" />
        </linearGradient>
      </defs>
      <path d={TRAZOS[t]} fill={`url(#lg-${t})`} opacity="0.9" />
      {/* Ruedas: dan la lectura inmediata de "vehículo" */}
      <circle cx="54" cy="69" r="11" fill="#1A1815" />
      <circle cx="54" cy="69" r="4.5" fill="#8A8175" />
      <circle cx="150" cy="69" r="11" fill="#1A1815" />
      <circle cx="150" cy="69" r="4.5" fill="#8A8175" />
    </svg>
  );
}
