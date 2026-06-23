/**
 * Sección "Experiencia premium" con la pieza 3D (R3F).
 * El Canvas 3D (three) se carga lazy y SOLO se monta si: no hay reduce-motion,
 * es desktop con ≥4 cores y hay WebGL, y además entró al viewport. En cualquier
 * otro caso muestra una imagen premium (fallback). Así three no afecta el LCP ni
 * castiga móviles de gama baja.
 */
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { Reveal, useReduce } from '../../lib/motion';
import { SectionShell, Eyebrow, cls } from '../ui';
import { IMG } from '../assets';

const Scene3D = lazy(() => import('../Scene3D'));

function canRender3D(): boolean {
  if (typeof window === 'undefined') return false;
  const desktop = window.matchMedia('(min-width: 1024px)').matches;
  const cores = (navigator.hardwareConcurrency || 2) >= 4;
  let webgl = false;
  try {
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { webgl = false; }
  return desktop && cores && webgl;
}

export default function Showcase3D() {
  const reduce = useReduce();
  const ref = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState(false);
  const [enabled] = useState(() => !reduce && canRender3D());

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setMount(true); io.disconnect(); } },
      { rootMargin: '200px' },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [enabled]);

  return (
    <SectionShell alt>
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <Reveal onView>
          <Eyebrow icon={Sparkles}>Experiencia premium</Eyebrow>
          <h2 className={`${cls.h2} text-3xl sm:text-4xl md:text-5xl mt-4`}>
            Cada detalle, <span className="text-secondary">pulido a la perfección</span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg mt-5 leading-relaxed font-light">
            Productos de alta gama, procesos cuidados y acabado impecable. En Luxury Garage
            tratamos tu vehículo como la pieza de ingeniería que es.
          </p>
          <ul className="space-y-3 mt-7">
            {['Lavado y encerado profesional', 'Sellador cerámico de larga duración', 'Inventario y procesos controlados'].map((t) => (
              <li key={t} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="w-5 h-5 rounded-full bg-secondary/15 flex items-center justify-center shrink-0">
                  <Check size={12} className="text-secondary" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <div ref={ref} className="relative aspect-square rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_45%,rgba(254,183,0,0.16),transparent_70%)]" />
          {enabled && mount ? (
            <Suspense fallback={<img src={IMG.heroAlt} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />}>
              <Scene3D />
            </Suspense>
          ) : (
            <img src={IMG.heroAlt} alt="Detalle premium de Luxury Garage" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          )}
          <div className={`absolute bottom-4 left-4 ${cls.card} px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-secondary`}>
            Acabado premium
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
