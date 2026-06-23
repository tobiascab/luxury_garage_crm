/**
 * Servicios — datos REALES y editables desde el panel (GET /api/services, público).
 * Comunica claramente el SERVICIO de lavado/detailing con imágenes en acción.
 * Reservar requiere sesión → CTA lleva a /login. Sin servicios → estado vacío.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplets, Sparkles, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import api from '../../../services/api';
import { Reveal, StaggerList, StaggerItem, Pressable, useReduce } from '../../lib/motion';
import { SectionShell, SectionHeading, cls, Tilt } from '../ui';
import { IMG } from '../assets';

interface Service {
  id: string; name: string; description?: string | null;
  basePriceGs?: number; durationMinutes?: number; category?: string; isAddon?: boolean;
}

const CARD_IMG = [IMG.foam, IMG.polishing, IMG.ceramic[0], IMG.waterBeading, IMG.wheels, IMG.handWash[0]];
const fmt = (n?: number) => (typeof n === 'number' ? `₲ ${n.toLocaleString('es-PY')}` : null);
const iconFor = (s: Service) => (/(cer[aá]mic|sella)/i.test(s.name + (s.category || '')) ? ShieldCheck
  : /(pulid|brillo|cera)/i.test(s.name) ? Sparkles : Droplets);

export default function ServiciosSection() {
  const navigate = useNavigate();
  const reduce = useReduce();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/services?addon=false');
        const data = res.data?.data ?? res.data;
        if (alive) setServices(Array.isArray(data) ? data.filter((s: Service) => !s.isAddon) : []);
      } catch { if (alive) setServices([]); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <SectionShell id="servicios">
      <SectionHeading
        eyebrow="Servicios"
        title={<>Lo que hacemos por <span className="text-secondary">tu auto</span></>}
        subtitle="Lavado premium, detailing y protección de pintura. Cada servicio, con productos de alta gama y acabado impecable."
      />

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${cls.card} overflow-hidden animate-pulse`}>
              <div className="h-44 bg-white/10" />
              <div className="p-6 space-y-3">
                <div className="h-4 w-28 bg-white/10 rounded" />
                <div className="h-3 w-full bg-white/10 rounded" />
                <div className="h-3 w-2/3 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : services.length === 0 ? (
        <Reveal onView className={`${cls.card} text-center max-w-md mx-auto p-12`}>
          <Droplets size={40} className="text-secondary/60 mx-auto mb-4" />
          <p className="font-headline text-xl font-black text-white mb-2">Servicios en preparación</p>
          <p className="text-slate-400 text-sm mb-6">Iniciá sesión para ver y reservar los servicios disponibles.</p>
          <Pressable onClick={() => navigate('/login')} className={`${cls.btnGold} text-xs px-6 py-3`}>Iniciar sesión</Pressable>
        </Reveal>
      ) : (
        <StaggerList onView className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s, i) => {
            const Icon = iconFor(s);
            const price = fmt(s.basePriceGs);
            return (
              <StaggerItem key={s.id} className="h-full">
                <Tilt max={6} className="h-full">
                  <div className={`${cls.card} ${cls.cardHover} h-full overflow-hidden flex flex-col`}>
                    <div className="relative h-44 overflow-hidden">
                      <img src={CARD_IMG[i % CARD_IMG.length]} alt={s.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0d] via-transparent to-transparent" />
                      <div className="absolute top-3 left-3 w-10 h-10 rounded-xl bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center">
                        <Icon size={18} className="text-secondary" />
                      </div>
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="font-headline text-lg font-black text-white">{s.name}</h3>
                      {s.description && <p className="text-slate-400 text-sm mt-1.5 leading-relaxed line-clamp-3">{s.description}</p>}
                      <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
                        {price && <span className="text-secondary font-black">Desde {price}</span>}
                        {s.durationMinutes ? <span className="inline-flex items-center gap-1"><Clock size={12} /> {s.durationMinutes} min</span> : null}
                      </div>
                      <Pressable
                        onClick={() => navigate('/login')}
                        className={`mt-5 w-full text-[11px] py-3 inline-flex items-center justify-center gap-2 bg-white/8 border border-white/15 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-white/15 transition-colors`}
                      >
                        Reservar <ArrowRight size={14} />
                      </Pressable>
                    </div>
                  </div>
                </Tilt>
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}
    </SectionShell>
  );
}
