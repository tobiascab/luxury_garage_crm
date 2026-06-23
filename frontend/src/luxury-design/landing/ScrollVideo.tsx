/**
 * Video "scrubbeado" por scroll: el avance del video sigue el progreso de scroll.
 *
 * CLAVE de fluidez: el video se DESCARGA COMPLETO a memoria (fetch → Blob →
 * objectURL) al cargar la página. Así el scrub setea currentTime sobre un archivo
 * 100% local → seeks instantáneos, SIN pedir rangos al servidor por cada frame
 * (que era lo que causaba el stuttering). Mientras descarga, se muestra el poster.
 *
 * Respeta prefers-reduced-motion: cae a sección normal con poster (sin scrub).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useScroll, useMotionValueEvent } from 'framer-motion';
import { useReduce } from '../lib/motion';

interface Props {
  src: string;
  poster?: string;
  /** Altura de la zona de scroll (más alto = scrub más lento). */
  height?: string;
  /** Contenido overlay (sticky, centrado sobre el video). */
  children?: React.ReactNode;
}

export default function ScrollVideo({ src, poster, height = 'h-[260vh]', children }: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduce = useReduce();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Descarga completa a memoria → scrub local e instantáneo.
  useEffect(() => {
    if (reduce) return;
    let objUrl: string | null = null;
    let cancelled = false;
    fetch(src)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('video fetch failed'))))
      .then((blob) => {
        if (cancelled) return;
        objUrl = URL.createObjectURL(blob);
        setBlobUrl(objUrl);
      })
      .catch(() => { /* si falla, queda el poster */ });
    return () => { cancelled = true; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [src, reduce]);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration;
    if (!d || isNaN(d) || !isFinite(d)) return;
    const t = Math.min(d - 0.05, Math.max(0, p * d));
    if (Math.abs(v.currentTime - t) > 0.03) v.currentTime = t;
  });

  if (reduce) {
    return (
      <section className="relative isolate min-h-[60vh] overflow-hidden bg-black">
        {poster && <img src={poster} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-70 -z-10" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/40 to-[#070708]" />
        <div className="relative z-10 max-w-4xl mx-auto px-5 min-h-[60vh] flex flex-col items-center justify-center text-center py-20">
          {children}
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className={`relative ${height}`}>
      <div className="sticky top-0 h-screen w-full overflow-hidden isolate">
        {/* Poster mientras el video se descarga a memoria */}
        {poster && (
          <img
            src={poster}
            alt=""
            aria-hidden
            className={`absolute inset-0 w-full h-full object-cover -z-10 transition-opacity duration-700 ${blobUrl ? 'opacity-0' : 'opacity-100'}`}
          />
        )}
        {blobUrl && (
          <video
            ref={videoRef}
            src={blobUrl}
            className="absolute inset-0 w-full h-full object-cover -z-10"
            muted
            playsInline
            preload="auto"
          />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/50 via-black/10 to-black/75" />
        <div className="relative z-10 h-full max-w-4xl mx-auto px-5 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      </div>
    </section>
  );
}
