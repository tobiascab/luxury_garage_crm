/**
 * Primitivos UI compartidos de la landing. TODAS las secciones deben usar esto
 * para verse coherentes (mismo dark theme negro/dorado, mismo ritmo vertical).
 */
import React, { useRef } from 'react';
import { Reveal, useReduce } from '../lib/motion';

export const GOLD = '#feb700';

// Clases compartidas — reusar para coherencia visual.
export const cls = {
  card: 'rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-sm',
  cardHover: 'transition-colors hover:border-secondary/40',
  btnGold:
    'inline-flex items-center justify-center gap-2.5 bg-secondary text-black font-black uppercase tracking-widest rounded-full shadow-xl shadow-secondary/25 hover:shadow-secondary/50 transition-shadow',
  btnGhost:
    'inline-flex items-center justify-center gap-2.5 bg-white/5 backdrop-blur-md border border-white/20 text-white font-bold uppercase tracking-widest rounded-full hover:bg-white/10 transition-colors',
  h2: 'font-headline font-black tracking-tight text-white leading-[1.05]',
};

export function Eyebrow({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-secondary/90">
      {Icon ? <Icon size={14} /> : <span className="w-6 h-px bg-secondary/50" />}
      {children}
    </span>
  );
}

export function SectionShell({
  id, children, className = '', alt = false, bgImage,
}: { id?: string; children: React.ReactNode; className?: string; alt?: boolean; bgImage?: string }) {
  return (
    <section id={id} className={`relative isolate px-5 py-24 sm:py-28 ${alt ? 'bg-white/[0.015]' : ''} ${className}`}>
      {bgImage && (
        <>
          {/* Imagen de fondo tenue (detailing) para romper el negro plano */}
          <img src={bgImage} alt="" aria-hidden loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-[0.10] -z-10" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#070708] via-[#070708]/80 to-[#070708]" />
        </>
      )}
      <div className="max-w-6xl mx-auto">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow, title, subtitle, center = true,
}: { eyebrow: string; title: React.ReactNode; subtitle?: string; center?: boolean }) {
  return (
    <div className={`max-w-2xl ${center ? 'mx-auto text-center' : ''} mb-14`}>
      <Reveal onView><Eyebrow>{eyebrow}</Eyebrow></Reveal>
      <Reveal onView delay={0.05}>
        <h2 className={`${cls.h2} text-3xl sm:text-4xl md:text-5xl mt-4`}>{title}</h2>
      </Reveal>
      {subtitle && (
        <Reveal onView delay={0.1}>
          <p className="text-slate-400 text-base sm:text-lg mt-4 leading-relaxed font-light">{subtitle}</p>
        </Reveal>
      )}
    </div>
  );
}

// Tilt 3D liviano (sin librerías): sigue el mouse con perspectiva. Respeta reduce-motion.
export function Tilt({ children, className = '', max = 10 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReduce();
  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(900px) rotateY(${px * max}deg) rotateX(${-py * max}deg)`;
  };
  const reset = () => { if (ref.current) ref.current.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg)'; };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={`transition-transform duration-200 will-change-transform ${className}`}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  );
}
