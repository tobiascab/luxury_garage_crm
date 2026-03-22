import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap, Shield, Crown, ArrowRight, X, Star, Calendar, Droplets, CheckCircle2, Clock } from 'lucide-react';

interface PlanesProps {
  user: any;
}

const plans = [
  {
    id: 'basico',
    name: 'Plan Básico',
    priceGs: 250000,
    washes: '4 Lavados Express + 1 Interior',
    icon: 'shield',
    popular: false,
    dark: false,
    renewsOn: '01 May 2026',
    features: [
      { label: '4 Lavados Express al mes', included: true },
      { label: '1 Lavado Interior al mes', included: true },
      { label: 'Brillo de Llantas', included: true },
      { label: 'Lavados Exteriores Ilimitados', included: false },
      { label: 'Full Detailing', included: false },
      { label: 'Servicio a Domicilio', included: false },
      { label: 'Hasta 2 vehículos', included: false },
    ],
    desc: 'Ideal para mantener tu vehículo presentable con lavados regulares de calidad.',
  },
  {
    id: 'prima',
    name: 'Prima del Plan',
    priceGs: 450000,
    washes: 'Exteriores Ilimitados + 2 Full + Detailing',
    icon: 'zap',
    popular: true,
    dark: false,
    renewsOn: '01 May 2026',
    features: [
      { label: 'Lavados Exteriores Ilimitados', included: true },
      { label: '2 Lavados Full al mes', included: true },
      { label: 'Detailing Incluido', included: true },
      { label: 'Brillo de Llantas', included: true },
      { label: 'Limpieza Profunda de Interior', included: true },
      { label: 'Servicio a Domicilio', included: false },
      { label: 'Hasta 2 vehículos', included: false },
    ],
    desc: 'El plan favorito. Cobertura completa para un auto siempre impecable.',
  },
  {
    id: 'vip',
    name: 'Plan VIP',
    priceGs: 750000,
    washes: 'TODOS los servicios ILIMITADOS',
    icon: 'crown',
    popular: false,
    dark: true,
    renewsOn: '01 May 2026',
    features: [
      { label: 'TODOS los servicios ILIMITADOS', included: true },
      { label: 'Lavados Exteriores Ilimitados', included: true },
      { label: 'Full Detailing Ilimitado', included: true },
      { label: 'Servicio a Domicilio', included: true },
      { label: 'Hasta 2 vehículos', included: true },
      { label: 'Atención VIP prioritaria', included: true },
      { label: 'Tratamiento Cerámico mensual', included: true },
    ],
    desc: 'La experiencia definitiva. Sin límites, sin compromisos. El lujo máximo.',
  }
];

const formatGs = (n: number) => `₲ ${n.toLocaleString('es-PY')}`;


function PlanIcon({ icon, size = 18 }: { icon: string, size?: number }) {
  if (icon === 'crown') return <Crown size={size} className="text-secondary" />;
  if (icon === 'zap') return <Zap size={size} className="text-secondary" />;
  return <Shield size={size} className="text-slate-400 dark:text-slate-500" />;
}

export default function Planes({ user }: PlanesProps) {
  const [selectedPlan, setSelectedPlan] = useState<typeof plans[0] | null>(null);

  // Determine current plan from user role
  const currentPlanId = (() => {
    const role = (user?.role ?? '').toLowerCase();
    if (role.includes('vip') || role.includes('lujo')) return 'vip';
    if (role.includes('prima') || role.includes('gold')) return 'prima';
    if (role.includes('basico') || role.includes('basic') || role.includes('silver')) return 'basico';
    return 'prima';
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4 pb-24"
    >
      {/* Header */}
      <div className="text-center">
        <h1 className="font-headline text-2xl font-extrabold tracking-tight dark:text-white">Mis Membresías</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Planes mensuales para mantener tu vehículo siempre impecable.</p>
      </div>

      {/* Current Plan Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
        <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div>
          <p className="font-bold text-sm text-emerald-800 dark:text-emerald-200">
            Plan Activo: {plans.find(p => p.id === currentPlanId)?.name ?? currentPlanId}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400/70 flex items-center gap-1 mt-0.5">
            <Calendar size={11} /> Próxima renovación: 01 May 2026
          </p>
        </div>
      </div>

      {/* Plans list */}
      <div className="space-y-3">
        {plans.map((plan, i) => {
          const isCurrent = plan.id === currentPlanId;
          const isDarkCard = plan.dark;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`relative rounded-[1.5rem] p-5 border shadow-sm transition-all ${isDarkCard
                ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-800 dark:border-slate-700'
                : isCurrent
                  ? 'bg-primary/5 dark:bg-blue-500/10 border-primary/30 dark:border-blue-500/30'
                  : 'bg-white dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-4 bg-secondary text-slate-900 px-3 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase shadow-md">
                  MÁS POPULAR
                </div>
              )}

              {/* Current plan badge */}
              {isCurrent && (
                <div className={`absolute -top-3 right-4 flex items-center gap-1 px-3 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase ${isDarkCard ? 'bg-emerald-500 text-white' : 'bg-emerald-600 text-white'}`}>
                  <Star size={9} fill="currentColor" /> TU PLAN
                </div>
              )}

              {/* Plan header row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDarkCard ? 'bg-white/10' : 'bg-slate-50 dark:bg-slate-800'}`}>
                    <PlanIcon icon={plan.icon} />
                  </div>
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkCard ? 'text-white/50' : 'text-slate-400 dark:text-slate-500'}`}>{plan.name}</p>
                    <div className={`flex items-center gap-1 mt-0.5 text-xs font-bold ${isDarkCard ? 'text-white/70' : 'text-slate-600 dark:text-slate-300'}`}>
                      <Droplets size={11} />
                      {plan.washes}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex flex-col items-end">
                    <span className={`text-base font-black font-headline leading-tight ${!isDarkCard && 'dark:text-white'}`}>{formatGs(plan.priceGs)}</span>
                    <span className={`text-[10px] ${isDarkCard ? 'text-white/40' : 'text-slate-400 dark:text-slate-500'}`}>/mes</span>
                  </div>
                </div>
              </div>

              {/* Feature preview (top 3) */}
              <ul className="space-y-1.5 mb-4">
                {plan.features.slice(0, 3).map(f => (
                  <li key={f.label} className="flex items-center gap-2 text-xs">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${f.included
                      ? (isDarkCard ? 'bg-white/15' : 'bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-400')
                      : (isDarkCard ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600')
                      }`}>
                      <Check size={9} />
                    </div>
                    <span className={`${f.included
                      ? (isDarkCard ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400')
                      : (isDarkCard ? 'text-slate-600 line-through' : 'text-slate-300 dark:text-slate-600 line-through')}`}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedPlan(plan)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 border ${isDarkCard
                    ? 'border-white/20 text-white/70 hover:bg-white/10'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/30 dark:hover:border-blue-500/30 hover:text-primary dark:hover:text-blue-400'
                    }`}
                >
                  Ver Detalles
                </button>
                {!isCurrent && (
                  <button className={`flex-1 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center justify-center gap-1.5 ${isDarkCard
                    ? 'bg-white text-slate-900 hover:bg-slate-100'
                    : 'bg-primary dark:bg-blue-500 text-white shadow-md shadow-primary/20 dark:shadow-blue-500/20 hover:shadow-primary/30'
                    }`}>
                    Elegir Plan <ArrowRight size={12} />
                  </button>
                )}
                {isCurrent && (
                  <div className={`flex-1 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-1 ${isDarkCard ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'}`}>
                    <CheckCircle2 size={12} /> Activo
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Info compact */}
      <div className="bg-slate-50 dark:bg-slate-900/40 rounded-[1.5rem] p-4 border border-slate-100 dark:border-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
          Tu suscripción se renueva automáticamente cada mes. Podés cancelar en cualquier momento. Los lavados no utilizados no se acumulan.
        </p>
        <div className="flex gap-5">
          <div><span className="text-lg font-black text-primary dark:text-blue-400">100%</span><p className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-600">Garantía Brillo</p></div>
          <div className="w-px bg-slate-200 dark:bg-slate-800" />
          <div><span className="text-lg font-black text-primary dark:text-blue-400">24/7</span><p className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-600">Soporte VIP</p></div>
        </div>
      </div>

      {/* Plan Detail Modal */}
      <AnimatePresence>
        {selectedPlan && (
          <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlan(null)}
              className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className={`relative z-10 w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl ${selectedPlan.dark ? 'bg-slate-900 dark:bg-slate-800 text-white' : 'bg-white dark:bg-slate-900'}`}
            >
              {/* Modal Header */}
              <div className={`p-6 ${selectedPlan.dark ? 'bg-slate-800 dark:bg-slate-700' : 'bg-primary/5 dark:bg-blue-500/10'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedPlan.dark ? 'bg-white/10' : 'bg-white dark:bg-slate-800 shadow-sm'}`}>
                      <PlanIcon icon={selectedPlan.icon} size={20} />
                    </div>
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${selectedPlan.dark ? 'text-white/40' : 'text-slate-400 dark:text-slate-500'}`}>{selectedPlan.name}</p>
                      <p className={`font-black text-base leading-tight ${selectedPlan.dark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {formatGs(selectedPlan.priceGs)}
                        <span className={`text-xs font-normal ${selectedPlan.dark ? 'text-white/40' : 'text-slate-400 dark:text-slate-500'}`}>/mes</span>
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedPlan(null)} className={`p-1.5 rounded-full ${selectedPlan.dark ? 'text-white/40 hover:bg-white/10 text-white' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <X size={18} />
                  </button>
                </div>

                {selectedPlan.id === currentPlanId && (
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <Star size={10} fill="currentColor" /> Tu Plan Actual
                  </div>
                )}

                <p className={`text-xs mt-3 leading-relaxed ${selectedPlan.dark ? 'text-white/50' : 'text-slate-500 dark:text-slate-400'}`}>{selectedPlan.desc}</p>
              </div>

              {/* Stats row */}
              <div className={`grid grid-cols-3 divide-x border-b ${selectedPlan.dark ? 'divide-white/10 border-white/10' : 'divide-slate-100 dark:divide-slate-800 border-slate-100 dark:border-slate-800'}`}>
                <div className="p-3 text-center">
                  <Droplets size={14} className={`mx-auto mb-1 ${selectedPlan.dark ? 'text-white/40' : 'text-primary dark:text-blue-400'}`} />
                  <p className={`font-black text-[11px] ${selectedPlan.dark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {formatGs(selectedPlan.priceGs)}
                  </p>
                  <p className={`text-[9px] uppercase font-bold ${selectedPlan.dark ? 'text-white/30' : 'text-slate-400 dark:text-slate-600'}`}>Precio</p>
                </div>
                <div className="p-3 text-center">
                  <Calendar size={14} className={`mx-auto mb-1 ${selectedPlan.dark ? 'text-white/40' : 'text-primary dark:text-blue-400'}`} />
                  <p className={`font-black text-sm ${selectedPlan.dark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>01 May</p>
                  <p className={`text-[9px] uppercase font-bold ${selectedPlan.dark ? 'text-white/30' : 'text-slate-400 dark:text-slate-600'}`}>Renueva</p>
                </div>
                <div className="p-3 text-center">
                  <Clock size={14} className={`mx-auto mb-1 ${selectedPlan.dark ? 'text-white/40' : 'text-primary dark:text-blue-400'}`} />
                  <p className={`font-black text-sm ${selectedPlan.dark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>30 días</p>
                  <p className={`text-[9px] uppercase font-bold ${selectedPlan.dark ? 'text-white/30' : 'text-slate-400 dark:text-slate-600'}`}>Duración</p>
                </div>
              </div>

              {/* Full feature list */}
              <div className="p-5 space-y-2.5 max-h-52 overflow-y-auto">
                {selectedPlan.features.map(f => (
                  <div key={f.label} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${f.included
                      ? (selectedPlan.dark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400')
                      : (selectedPlan.dark ? 'bg-white/5 text-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600')
                      }`}>
                      <Check size={10} />
                    </div>
                    <span className={`text-xs ${f.included ? (selectedPlan.dark ? 'text-slate-200' : 'text-slate-700 dark:text-slate-300') : (selectedPlan.dark ? 'text-white/25 line-through' : 'text-slate-300 dark:text-slate-600 line-through')}`}>
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="p-4 pt-0">
                {selectedPlan.id !== currentPlanId ? (
                  <button className={`w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-95 transition-all ${selectedPlan.dark ? 'bg-white text-slate-900' : 'bg-primary dark:bg-blue-500 text-white shadow-lg shadow-primary/20 dark:shadow-blue-500/20'
                    }`}>
                    <ArrowRight size={15} /> Cambiar a Plan {selectedPlan.name}
                  </button>
                ) : (
                  <div className="text-center py-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-2">
                    <CheckCircle2 size={16} /> Este es tu plan activo
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
