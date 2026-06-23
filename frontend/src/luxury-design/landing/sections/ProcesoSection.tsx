/**
 * "El proceso" — timeline de detailing. Filas alternadas imagen/texto que
 * ENTRAN CON EL SCROLL (reveal lateral). Comunica el servicio paso a paso.
 */
import React from 'react';
import { SprayCan, Droplets, Hand, Wind, ShieldCheck } from 'lucide-react';
import { Reveal } from '../../lib/motion';
import { SectionShell, SectionHeading, cls } from '../ui';
import { IMG } from '../assets';

const fromLeft = { hidden: { opacity: 0, x: -48 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } };
const fromRight = { hidden: { opacity: 0, x: 48 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } };

const STEPS = [
  { n: '01', Icon: Droplets, title: 'Prelavado', desc: 'Enjuague inicial a presión para retirar tierra y suciedad suelta sin rayar la pintura.', img: IMG.foam },
  { n: '02', Icon: SprayCan, title: 'Espuma activa', desc: 'Snow foam que envuelve la carrocería y disuelve la grasa antes del contacto.', img: IMG.handWash[0] },
  { n: '03', Icon: Hand, title: 'Lavado a mano', desc: 'Técnica de dos baldes y guante de microfibra para un lavado seguro, sin remolinos.', img: IMG.handWash[1] },
  { n: '04', Icon: Wind, title: 'Secado premium', desc: 'Secado con microfibra de alta absorción para un acabado sin marcas de agua.', img: IMG.microfiber[0] },
  { n: '05', Icon: ShieldCheck, title: 'Sellado y cerámico', desc: 'Capa de protección que realza el brillo y repele agua y suciedad por más tiempo.', img: IMG.ceramic[0] },
];

export default function ProcesoSection() {
  return (
    <SectionShell alt>
      <SectionHeading
        eyebrow="El proceso"
        title={<>Cinco pasos para un <span className="text-secondary">acabado impecable</span></>}
        subtitle="Cada vehículo pasa por un proceso cuidado, con productos de alta gama y manos expertas."
      />

      <div className="space-y-10 sm:space-y-16">
        {STEPS.map((s, i) => {
          const flip = i % 2 === 1;
          return (
            <div key={s.n} className={`grid lg:grid-cols-2 gap-6 lg:gap-12 items-center ${flip ? 'lg:[direction:rtl]' : ''}`}>
              <Reveal onView variant={flip ? fromRight : fromLeft} className="[direction:ltr]">
                <div className="relative rounded-3xl overflow-hidden border border-white/10 aspect-[16/10]">
                  <img src={s.img} alt={s.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <span className="absolute top-4 left-4 font-headline text-5xl font-black text-secondary/80 drop-shadow-lg">{s.n}</span>
                </div>
              </Reveal>
              <Reveal onView variant={flip ? fromLeft : fromRight} className="[direction:ltr]">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-11 h-11 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                    <s.Icon size={20} className="text-secondary" />
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">Paso {s.n}</span>
                </div>
                <h3 className={`${cls.h2} text-2xl sm:text-3xl`}>{s.title}</h3>
                <p className="text-slate-400 text-base sm:text-lg mt-3 leading-relaxed font-light">{s.desc}</p>
              </Reveal>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
