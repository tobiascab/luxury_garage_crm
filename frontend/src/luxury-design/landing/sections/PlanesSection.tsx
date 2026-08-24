/**
 * Sección de PLANES — datos REALES del backend (GET /api/plans, público).
 * Lo que el admin edita en el panel se refleja acá. Sin planes → estado vacío
 * (no se inventan precios). Comprar requiere sesión → CTA lleva a
 * /login?next=/planes?plan=<slug> y continúa la suscripción ya logueado.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Zap, Shield, Check, ArrowRight, Lock, CreditCard } from 'lucide-react';
import api from '../../../services/api';
import { motion, Reveal, StaggerList, StaggerItem, AnimatedNumber, Pressable, useReduce } from '../../lib/motion';
import { SectionShell, SectionHeading, cls } from '../ui';

interface Plan {
  id: string; name: string; slug?: string; description?: string | null;
  priceGs: number; billingPeriod?: string; features?: string[] | null; discountPercent?: number;
}

const iconFor = (name: string) => {
  const n = (name || '').toLowerCase();
  if (n.includes('vip')) return Crown;
  if (n.includes('prima') || n.includes('premium')) return Zap;
  return Shield;
};
const isPopular = (name: string) => /(prima|premium)/i.test(name || '');
const periodLabel = (bp?: string) => (bp === 'yearly' ? '/año' : bp === 'quarterly' ? '/trimestre' : '/mes');

export default function PlanesSection({ onCrearCuenta }: { onCrearCuenta?: (slug?: string) => void }) {
  const navigate = useNavigate();
  const reduce = useReduce();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/plans');
        const data = res.data?.data ?? res.data;
        if (alive) setPlans(Array.isArray(data) ? data : []);
      } catch { if (alive) setPlans([]); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const subscribe = (p: Plan) => {
    const slug = p.slug || p.id;
    // La landing manda al alta con el plan ya elegido. Sin ese handler (otra
    // pantalla reusando la sección), cae al camino de quien ya tiene cuenta.
    if (onCrearCuenta) {
      onCrearCuenta(slug);
      return;
    }
    navigate(`/login?next=${encodeURIComponent(`/planes?plan=${slug}`)}`);
  };

  return (
    <SectionShell id="planes" className="scroll-mt-20">
      <SectionHeading
        eyebrow="Membresías"
        title="Elegí tu plan"
        subtitle="Planes mensuales para mantener tu vehículo siempre impecable. Cancelás cuando quieras."
      />

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${cls.card} p-7 animate-pulse`}>
              <div className="w-12 h-12 rounded-2xl bg-white/10 mb-5" />
              <div className="w-28 h-4 rounded bg-white/10 mb-3" />
              <div className="w-36 h-8 rounded bg-white/10 mb-6" />
              <div className="space-y-3">{Array.from({ length: 4 }).map((__, j) => <div key={j} className="w-full h-3 rounded bg-white/10" />)}</div>
              <div className="w-full h-12 rounded-2xl bg-white/10 mt-7" />
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Reveal onView className={`${cls.card} text-center max-w-md mx-auto p-12`}>
          <CreditCard size={40} className="text-secondary/60 mx-auto mb-4" />
          <p className="font-headline text-xl font-black text-white mb-2">Planes en camino</p>
          <p className="text-slate-400 text-sm mb-6">Estamos preparando las membresías. Creá tu cuenta y te avisamos apenas estén disponibles.</p>
          <Pressable onClick={() => navigate('/register')} className={`${cls.btnGold} text-xs px-6 py-3`}>Crear mi cuenta</Pressable>
        </Reveal>
      ) : (
        <StaggerList onView className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {plans.map((p) => {
            const Icon = iconFor(p.name);
            const popular = isPopular(p.name);
            const feats = (p.features || []).filter(Boolean);
            const discount = p.discountPercent || 0;
            return (
              <StaggerItem key={p.id} className="h-full">
                <PlanCard popular={popular} reduce={reduce}>
                  {popular && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-secondary text-black px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg whitespace-nowrap">
                      ★ Más elegido
                    </span>
                  )}
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${popular ? 'bg-secondary/20 border border-secondary/30' : 'bg-white/5 border border-white/10'}`}>
                      <Icon size={22} className="text-secondary" />
                    </div>
                    {discount > 0 && (
                      <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2.5 py-1 rounded-full">-{discount}%</span>
                    )}
                  </div>
                  <h3 className="font-headline text-xl font-black text-white">{p.name}</h3>
                  {p.description && <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">{p.description}</p>}
                  <div className="flex items-baseline gap-1 mt-5 mb-6">
                    <AnimatedNumber value={p.priceGs} prefix="₲ " currency className="font-headline text-3xl sm:text-4xl font-black text-white" />
                    <span className="text-slate-500 text-sm font-bold">{periodLabel(p.billingPeriod)}</span>
                  </div>
                  {feats.length > 0 && (
                    <ul className="space-y-3 mb-7 flex-1">
                      {feats.map((f, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                          <span className="w-5 h-5 rounded-full bg-secondary/15 flex items-center justify-center shrink-0 mt-0.5"><Check size={12} className="text-secondary" /></span>
                          <span className="leading-snug">{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Pressable
                    onClick={() => subscribe(p)}
                    className={`mt-auto w-full text-xs py-4 ${popular ? cls.btnGold : 'inline-flex items-center justify-center gap-2 bg-white/10 border border-white/15 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-white/15 transition-colors'}`}
                  >
                    Suscribirme <ArrowRight size={15} />
                  </Pressable>
                </PlanCard>
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}

      <Reveal onView delay={0.1}>
        <p className="text-center text-slate-500 text-xs mt-8 flex items-center justify-center gap-2">
          <Lock size={12} /> Pagos protegidos con Bancard · Suscripción cancelable en cualquier momento
        </p>
      </Reveal>
    </SectionShell>
  );
}

// Card con leve realce al hover (envuelve cada plan).
function PlanCard({ popular, reduce, children }: { popular: boolean; reduce: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      className={`relative h-full flex flex-col p-7 backdrop-blur-sm transition-colors rounded-3xl ${
        popular
          ? 'bg-gradient-to-b from-secondary/[0.12] to-white/[0.02] border-2 border-secondary/60 shadow-2xl shadow-secondary/10'
          : 'bg-white/[0.03] border border-white/10 hover:border-white/25'
      }`}
    >
      {children}
    </motion.div>
  );
}
