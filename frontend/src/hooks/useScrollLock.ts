import { useEffect } from 'react';

// Contador global → soporta modales/sheets anidados: bloquea con el primero
// y solo restaura el scroll con el último que se cierra.
let lockCount = 0;
let savedScrollY = 0;

/**
 * Bloquea el scroll del fondo mientras un modal / bottom sheet está abierto.
 *
 * Usa `position: fixed` en <body> + restauración del scrollY al cerrar, en vez de
 * `overflow: hidden` (que NO frena el touch scroll en iOS Safari → el fondo se
 * "desliza" detrás del modal, el bug clásico de scroll chaining).
 *
 * Llamalo SIEMPRE en el cuerpo del componente (regla de hooks); el flag `active`
 * controla cuándo se aplica el bloqueo.
 *
 * @example
 *   useScrollLock(isOpen);
 */
export default function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      body.style.position = 'fixed';
      body.style.top = `-${savedScrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
    }
    lockCount += 1;
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.right = '';
        body.style.width = '';
        body.style.overflow = '';
        body.style.overscrollBehavior = '';
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [active]);
}
