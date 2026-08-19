/**
 * Hero cinematográfico: video de fondo real (auto de noche, calles mojadas) con
 * parallax al scroll, overlays oscuros + brillo dorado de marca, wordmark y CTAs.
 * El video cae a imagen (poster) en reduce-motion / si no carga.
 */
import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScroll, useTransform } from 'framer-motion';
import { LogIn, ArrowRight, Sparkles, ChevronDown, Crown } from 'lucide-react';
import { motion, StaggerList, StaggerItem, Pressable, useReduce } from '../../lib/motion';
import { cls } from '../ui';
import { VIDEO, IMG } from '../assets';
import AutoVideo from '../AutoVideo';

export default function Hero({ onRequestMembership }: { onRequestMembership?: () => void }) {
  const navigate = useNavigate();
  const reduce = useReduce();
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '22%']);
  const scale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.18]);
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, reduce ? 1 : 0]);

  const scrollToPlans = () =>
    document.getElementById('planes')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });

  return (
    <section ref={ref} className="relative isolate min-h-[100svh] flex items-center justify-center overflow-hidden">
      {/* Capa de media (parallax): video de espuma/lavado que reproduce solo en viewport */}
      <motion.div style={{ y, scale }} className="absolute inset-0 -z-10">
        <AutoVideo
          sources={[{ src: VIDEO.foam }]}
          poster={IMG.heroPoster}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlays: legibilidad + tinte dorado/azul de marca */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/45 to-[#070708]" />
        <div className="absolute inset-0 bg-[radial-gradient(75%_55%_at_50%_0%,rgba(254,183,0,0.16),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_85%_95%,rgba(15,43,128,0.4),transparent_60%)]" />
      </motion.div>

      <motion.div style={{ opacity: fade }} className="relative z-10 max-w-4xl mx-auto px-5 text-center pt-20 sm:pt-24 pb-24 sm:pb-32">
        <StaggerList>
          <StaggerItem>
            <span className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/15 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] sm:tracking-[0.25em] text-secondary mb-5 sm:mb-7">
              <Sparkles size={14} /> Club de detailing premium
            </span>
          </StaggerItem>
          <StaggerItem>
            <h1 className="brand-wordmark text-[2.75rem] sm:text-7xl md:text-8xl leading-[0.92] mb-3 sm:mb-4">LUXURY GARAGE</h1>
          </StaggerItem>
          <StaggerItem>
            <p className="font-headline text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tight mb-4 sm:mb-5">
              Tu auto, siempre impecable.
            </p>
          </StaggerItem>
          <StaggerItem>
            <p className="text-slate-200/90 text-[15px] sm:text-lg max-w-xl mx-auto font-light leading-relaxed mb-7 sm:mb-9">
              Membresías de lavado y detailing con reservas, pagos y tu garage digital en una sola app.
              La experiencia de cuidado automotor que tu vehículo merece.
            </p>
          </StaggerItem>
          <StaggerItem>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
              <Pressable
                onClick={onRequestMembership ?? scrollToPlans}
                className={`${cls.btnGold} w-full sm:w-auto text-sm px-7 sm:px-8 py-3.5 sm:py-4`}
              >
                <Crown size={18} /> Solicitar membresía
              </Pressable>
              <Pressable onClick={() => navigate('/login')} className={`${cls.btnGhost} w-full sm:w-auto text-sm px-7 sm:px-8 py-3.5 sm:py-4`}>
                <LogIn size={18} /> Iniciar sesión
              </Pressable>
              <Pressable onClick={scrollToPlans} className={`${cls.btnGhost} w-full sm:w-auto text-sm px-7 sm:px-8 py-3.5 sm:py-4`}>
                Ver planes <ArrowRight size={18} />
              </Pressable>
            </div>
          </StaggerItem>
        </StaggerList>
      </motion.div>

      {!reduce && (
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-white/50"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown size={26} />
        </motion.div>
      )}
    </section>
  );
}
