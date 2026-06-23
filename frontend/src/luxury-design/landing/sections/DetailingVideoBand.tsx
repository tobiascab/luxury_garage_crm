/**
 * Banda full-bleed con VIDEO SCRUBBEADO POR SCROLL (el video avanza según el
 * scroll). Auto negro con agua perlando — encaja con la estética negro/dorado.
 */
import React from 'react';
import { Droplets } from 'lucide-react';
import { Reveal } from '../../lib/motion';
import { Eyebrow, cls } from '../ui';
import ScrollVideo from '../ScrollVideo';
import { VIDEO, IMG } from '../assets';

export default function DetailingVideoBand() {
  return (
    <ScrollVideo src={VIDEO.pressure} poster={IMG.handWash[0]} height="h-[260vh]">
      <Reveal onView><Eyebrow icon={Droplets}>El proceso</Eyebrow></Reveal>
      <Reveal onView delay={0.05}>
        <h2 className={`${cls.h2} text-4xl sm:text-6xl md:text-7xl mt-4`}>
          Detailing <span className="text-secondary">de verdad</span>
        </h2>
      </Reveal>
      <Reveal onView delay={0.1}>
        <p className="text-slate-200/90 text-base sm:text-xl max-w-xl mx-auto mt-5 font-light leading-relaxed">
          Espuma, enjuague y sellado, capa por capa. Mové el scroll y mirá el proceso en acción.
        </p>
      </Reveal>
      <Reveal onView delay={0.15}>
        <span className="mt-8 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/60">
          Scrolleá para reproducir ▾
        </span>
      </Reveal>
    </ScrollVideo>
  );
}
