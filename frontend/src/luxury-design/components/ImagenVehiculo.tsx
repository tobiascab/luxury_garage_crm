import React, { useState } from 'react';
import SiluetaVehiculo from './SiluetaVehiculo';

/**
 * Imagen del vehículo del cliente, en tres niveles de preferencia:
 *
 *   1. La foto que subió el propio cliente (o la del expediente de recepción).
 *   2. La imagen del catálogo, si tenemos ese modelo.
 *   3. La silueta según el tipo de carrocería.
 *
 * Siempre muestra algo: un hueco vacío en la ficha del auto se ve como un error.
 */

const norm = (s = '') =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Ruta de la imagen del catálogo para ese modelo, si existe. */
export function imagenDeCatalogo(marca?: string, modelo?: string): string | null {
  if (!marca || !modelo) return null;
  return `/autos/${norm(marca)}-${norm(modelo)}.png`;
}

interface Props {
  marca?: string;
  modelo?: string;
  /** Foto propia del cliente; tiene prioridad sobre el catálogo. */
  fotoUrl?: string | null;
  className?: string;
}

export default function ImagenVehiculo({ marca, modelo, fotoUrl, className = '' }: Props) {
  const catalogo = imagenDeCatalogo(marca, modelo);
  const [src, setSrc] = useState<string | null>(fotoUrl || catalogo);
  const [falló, setFalló] = useState(false);

  // Si la del catálogo no existe (404), se cae a la silueta sin romper nada.
  const alFallar = () => {
    if (src === fotoUrl && catalogo) { setSrc(catalogo); return; }
    setFalló(true);
  };

  if (!src || falló) {
    return <SiluetaVehiculo marca={marca} modelo={modelo} className={className} />;
  }

  return (
    <img
      src={src}
      alt={`${marca || ''} ${modelo || ''}`.trim() || 'Vehículo'}
      onError={alFallar}
      loading="lazy"
      className={`object-contain ${className}`}
    />
  );
}
