import React from 'react';

/**
 * AnimatedNumber — muestra un número con formato (sin animación).
 *
 * NOTA: antes "contaba" de 0 al valor objetivo al entrar en viewport. Esa
 * animación de conteo se quitó a pedido (se sentía molesta al abrir cada
 * módulo). Ahora renderiza el valor final al instante. Se conserva el nombre,
 * la API y el formateo para no tener que tocar los módulos que lo usan.
 *
 * Props:
 *  - value     {number}   valor a mostrar (acepta undefined/null/NaN → 0)
 *  - format    {'gs'|'int'|'percent'|'decimal'}  formato de salida (default 'int')
 *  - prefix    {string}   texto antes del número (se antepone al prefijo de 'gs')
 *  - suffix    {string}   texto después del número
 *  - decimals  {number}   decimales (para 'decimal'/'percent'; default 0, 'decimal' usa 1 si no se indica)
 *  - className {string}   clases del <span>
 *  - duration  {number}   ignorado (compatibilidad)
 */

function formatValue(num, format, decimals) {
  const n = Number.isFinite(num) ? num : 0;
  switch (format) {
    case 'gs':
      return '₲ ' + Math.round(n).toLocaleString('es-PY');
    case 'percent':
      return n.toLocaleString('es-PY', {
        minimumFractionDigits: decimals ?? 0,
        maximumFractionDigits: decimals ?? 0,
      }) + '%';
    case 'decimal':
      return n.toLocaleString('es-PY', {
        minimumFractionDigits: decimals ?? 1,
        maximumFractionDigits: decimals ?? 1,
      });
    case 'int':
    default:
      return Math.round(n).toLocaleString('es-PY');
  }
}

export default function AnimatedNumber({
  value,
  format = 'int',
  prefix = '',
  suffix = '',
  decimals,
  className = '',
}) {
  const target = Number.isFinite(Number(value)) ? Number(value) : 0;
  return (
    <span className={className}>
      {prefix}
      {formatValue(target, format, decimals)}
      {suffix}
    </span>
  );
}
