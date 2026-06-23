/**
 * Smooth scroll global (Lenis) para la landing.
 * - Lenis suaviza el scroll nativo; framer-motion (useScroll) lee el mismo
 *   window.scrollY, así que componen sin pelear por el RAF (un solo loop).
 * - Respeta prefers-reduced-motion: si está activo, NO monta Lenis (scroll nativo).
 * Solo se usa dentro de la landing (chunk lazy); no afecta a la app/Capacitor.
 */
import React from 'react';
import { ReactLenis } from 'lenis/react';
import { useReduce } from '../lib/motion';

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduce = useReduce();
  if (reduce) return <>{children}</>;
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.09,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.5,
        // syncTouch off: en iOS el smooth-touch pelea con el scroll nativo (laggy).
        syncTouch: false,
      }}
    >
      {children}
    </ReactLenis>
  );
}
