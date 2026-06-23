/**
 * Video que SOLO se reproduce cuando está en viewport y se pausa al salir
 * (recomendación del skill ui-ux-pro-max: evitar autoplay loop de video pesado
 * todo el tiempo → ahorra datos/CPU/batería, clave con varios videos en la página).
 * Con prefers-reduced-motion no reproduce: muestra el poster como imagen.
 */
import React, { useEffect, useRef } from 'react';
import { useReduce } from '../lib/motion';

interface Source { src: string; media?: string }
interface Props {
  sources: Source[];
  poster?: string;
  className?: string;
}

export default function AutoVideo({ sources, poster, className = '' }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduce = useReduce();

  useEffect(() => {
    if (reduce) return;
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
          else v.pause();
        });
      },
      { threshold: 0.15 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [reduce]);

  if (reduce) {
    return poster ? <img src={poster} alt="" aria-hidden className={className} /> : null;
  }

  return (
    <video ref={ref} className={className} muted loop playsInline preload="none" poster={poster}>
      {sources.map((s, i) => <source key={i} src={s.src} media={s.media} type="video/mp4" />)}
    </video>
  );
}
