import React, { useState, useEffect } from 'react';
import { Check, Zap, Shield, Crown, ArrowRight, X, Star, Calendar, Droplets, CheckCircle2, Clock, CreditCard, AlertCircle, Loader2, Lock } from 'lucide-react';
import { API_URL } from '../config';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import {
  motion,
  AnimatePresence,
  Reveal,
  StaggerList,
  StaggerItem,
  Pressable,
  AnimatedNumber,
  Skeleton,
  SkeletonText,
  scaleIn,
  popIn,
  springPop,
  useInteraction,
  hoverable,
  tapOnly,
} from '../lib/motion';
import { runBancardPayment } from '../lib/bancardPayment';
import { useBancard3ds } from '../components/Bancard3dsModal';
import PaymentResultOverlay, { PayPhase } from '../components/PaymentResultOverlay';
import useScrollLock from '../../hooks/useScrollLock';

interface PlanesProps {
  user: any;
  onUpdate?: () => void;
}

const formatGs = (n: number) => `₲ ${n.toLocaleString('es-PY')}`;

function PlanIcon({ icon, size = 18 }: { icon: string, size?: number }) {
  if (icon === 'crown') return <Crown size={size} className="text-secondary" />;
  if (icon === 'zap') return <Zap size={size} className="text-secondary" />;
  return <Shield size={size} className="text-slate-400 dark:text-slate-500" />;
}

export default function Planes({ user, onUpdate }: PlanesProps) {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState<any>(null);
  const [payPhase, setPayPhase] = useState<PayPhase>(null);
  const [payMsg, setPayMsg] = useState('');
  // Modal + handlers para el desafío 3DS de Bancard (si el cobro lo requiere).
  const { handlers: bancard3ds, modal: bancard3dsModal } = useBancard3ds();
  const [membership, setMembership] = useState<any>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const token = localStorage.getItem('luxury_token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Scroll-lock para los overlays inline (detalle de plan + confirmación de pago).
  // El overlay de resultado (PaymentResultOverlay) ya bloquea por su cuenta.
  useScrollLock(!!selectedPlan || !!showPayment || showCancelConfirm);

  useEffect(() => {
    loadData();
  }, []);

  // Si venimos de la landing con ?plan=slug, abrimos el detalle de ese plan
  // para continuar la suscripción ya logueado.
  useEffect(() => {
    if (loading || plans.length === 0) return;
    const slug = new URLSearchParams(window.location.search).get('plan');
    if (!slug) return;
    const match = plans.find((p) => p.slug === slug || p.id === slug);
    if (match) setSelectedPlan(match);
  }, [loading, plans]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, memberRes] = await Promise.all([
        api.get('/plans'),
        api.get('/memberships/me').catch(() => ({ data: null })),
      ]);

      const plansData = plansRes.data;
      if (plansData.success && plansData.data) {
        const mapped = plansData.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug || p.name.toLowerCase().replace(/\s+/g, '-'),
          priceGs: p.priceGs || p.price || 0,
          washes: p.description || '',
          icon: p.name.toLowerCase().includes('vip') ? 'crown' : p.name.toLowerCase().includes('prima') ? 'zap' : 'shield',
          popular: p.name.toLowerCase().includes('prima'),
          dark: p.name.toLowerCase().includes('vip'),
          features: (p.features || []).map((f: any) => ({
            label: typeof f === 'string' ? f : f.label || f.name || '',
            included: typeof f === 'string' ? true : f.included !== false,
          })),
          desc: p.longDescription || p.description || '',
          maxVehicles: p.maxVehicles || 1,
        }));
        setPlans(mapped);
      }

      if (memberRes && memberRes.data) {
        const memberData = memberRes.data;
        if (memberData.success && memberData.data) {
          setMembership(memberData.data);
        }
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  // Fallback plans if API returns empty
  const displayPlans = plans.length > 0 ? plans : [
    {
      id: 'basico', name: 'Plan Básico', priceGs: 250000,
      washes: '4 Lavados Express + 1 Interior', icon: 'shield', popular: false, dark: false,
      features: [
        { label: '4 Lavados Express al mes', included: true },
        { label: '1 Lavado Interior al mes', included: true },
        { label: 'Brillo de Llantas', included: true },
      ],
      desc: 'Ideal para mantener tu vehículo presentable.', maxVehicles: 1,
    },
    {
      id: 'prima', name: 'Prima del Plan', priceGs: 450000,
      washes: 'Exteriores Ilimitados + 2 Full + Detailing', icon: 'zap', popular: true, dark: false,
      features: [
        { label: 'Lavados Exteriores Ilimitados', included: true },
        { label: '2 Lavados Full al mes', included: true },
        { label: 'Detailing Incluido', included: true },
      ],
      desc: 'El plan favorito. Cobertura completa.', maxVehicles: 1,
    },
    {
      id: 'vip', name: 'Plan VIP', priceGs: 750000,
      washes: 'TODOS los servicios ILIMITADOS', icon: 'crown', popular: false, dark: true,
      features: [
        { label: 'TODOS los servicios ILIMITADOS', included: true },
        { label: 'Servicio a Domicilio', included: true },
        { label: 'Hasta 2 vehículos', included: true },
      ],
      desc: 'La experiencia definitiva. Sin límites.', maxVehicles: 2,
    },
  ];

  const currentPlanId = membership?.planId || membership?.plan?.id || null;

  // Regla de negocio: no se puede bajar de plan (a uno más barato) salvo
  // que el admin lo haya habilitado explícitamente (membership.downgradeAllowed).
  const currentPrice =
    membership?.plan?.priceGs ??
    displayPlans.find(p => p.id === currentPlanId)?.priceGs ??
    0;
  const downgradeAllowed = !!membership?.downgradeAllowed;
  const isDowngrade = (plan: any) =>
    !!currentPlanId && plan.id !== currentPlanId && (plan.priceGs ?? 0) < currentPrice;
  const isBlockedDowngrade = (plan: any) => isDowngrade(plan) && !downgradeAllowed;

  const handleSelectPlan = (plan: any) => {
    if (plan.id === currentPlanId) return;
    if (isBlockedDowngrade(plan)) return; // baja de plan bloqueada por el admin
    setShowPayment(plan);
  };

  const handleCancelMembership = async () => {
    setCancelling(true);
    try {
      await api.post('/memberships/cancel');
      setShowCancelConfirm(false);
      toast.success('Tu plan no se renovará. Seguirá activo hasta el vencimiento.');
      await loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'No se pudo cancelar el plan. Intentá de nuevo.');
    } finally {
      setCancelling(false);
    }
  };

  const handlePay = async () => {
    if (!showPayment) return;
    setPayPhase('processing');
    const r = await runBancardPayment(
      '/payments/charge-membership',
      { planId: showPayment.id },
      '/payments/charge-3ds-complete',
      bancard3ds,
    );
    if (r.ok) {
      setPayPhase('success');
    } else {
      setPayMsg(r.code === 'NO_CARD'
        ? 'No tenés una tarjeta guardada. Agregala en Perfil → Mis Tarjetas.'
        : (r.message || 'No se pudo procesar el pago.'));
      setPayPhase('error');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <div className="flex flex-col items-center gap-2 pt-2">
          <Skeleton className="w-44 h-7 rounded-xl" />
          <Skeleton className="w-64 h-3.5 rounded-md" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-[1.5rem] p-5 border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="w-20 h-2.5 rounded-md" />
                    <Skeleton className="w-32 h-3.5 rounded-md" />
                  </div>
                </div>
                <Skeleton className="w-20 h-6 rounded-md" />
              </div>
              <SkeletonText lines={3} />
              <div className="flex gap-2 mt-4">
                <Skeleton className="flex-1 h-10 rounded-xl" />
                <Skeleton className="flex-1 h-10 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <Reveal className="text-center">
        <h1 className="font-headline text-2xl font-extrabold tracking-tight dark:text-white">Mis Membresías</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Planes mensuales para mantener tu vehículo siempre impecable.</p>
      </Reveal>

      {/* Current Plan Banner */}
      {currentPlanId && (
        <motion.div
          variants={scaleIn}
          initial="hidden"
          animate="show"
          className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3"
        >
          <motion.span variants={popIn} initial="hidden" animate="show" transition={springPop} className="shrink-0">
            <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
          </motion.span>
          <div className="min-w-0">
            <p className="font-bold text-sm text-emerald-800 dark:text-emerald-200">
              Plan Activo: {membership?.plan?.name || displayPlans.find(p => p.id === currentPlanId)?.name || 'Plan Activo'}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400/70 flex items-center gap-1 mt-0.5">
              <Calendar size={11} />
              {membership?.endDate
                ? `Vence: ${new Date(membership.endDate).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}`
                : 'Renovación automática'}
            </p>
            {membership?.autoRenew === false && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">Cancelado · no se renovará al vencer</p>
            )}
          </div>
          {membership?.autoRenew !== false && (
            <Pressable
              tapOnly
              onClick={() => setShowCancelConfirm(true)}
              className="ml-auto shrink-0 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              Cancelar plan
            </Pressable>
          )}
        </motion.div>
      )}

      {/* Cancelar membresía — confirmación */}
      <AnimatePresence>
        {showCancelConfirm && (
          <div className="fixed inset-0 z-[250] flex items-end md:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !cancelling && setShowCancelConfirm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.97 }}
              className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6"
            >
              <h3 className="font-black text-lg text-slate-900 dark:text-white">¿Cancelar tu plan?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Tu <strong>{membership?.plan?.name || 'plan'}</strong> seguirá activo
                {membership?.endDate
                  ? ` hasta el ${new Date(membership.endDate).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })}`
                  : ' hasta el fin del período'} y no se renovará automáticamente. Podés volver a activarlo cuando quieras.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCancelConfirm(false)} disabled={cancelling}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Mantener plan
                </button>
                <button
                  onClick={handleCancelMembership} disabled={cancelling}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-60"
                >
                  {cancelling ? 'Cancelando…' : 'Sí, cancelar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Plans list */}
      <StaggerList className="space-y-3">
        {displayPlans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isDarkCard = plan.dark;
          const blockedDowngrade = isBlockedDowngrade(plan);
          const allowedDowngrade = isDowngrade(plan) && downgradeAllowed;

          return (
            <StaggerItem key={plan.id}>
              <motion.div
                {...useInteraction(hoverable)}
                className={`relative rounded-[1.5rem] p-5 border shadow-sm transition-colors ${isDarkCard
                  ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-800 dark:border-slate-700'
                  : isCurrent
                    ? 'bg-primary/5 dark:bg-blue-500/10 border-primary/30 dark:border-blue-500/30'
                    : 'bg-white dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                  }`}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <motion.div
                    variants={popIn}
                    initial="hidden"
                    animate="show"
                    transition={springPop}
                    className="absolute -top-3 left-4 bg-secondary text-slate-900 px-3 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase shadow-md"
                  >
                    MÁS POPULAR
                  </motion.div>
                )}

                {/* Current plan badge */}
                {isCurrent && (
                  <motion.div
                    variants={popIn}
                    initial="hidden"
                    animate="show"
                    transition={springPop}
                    className={`absolute -top-3 right-4 flex items-center gap-1 px-3 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase ${isDarkCard ? 'bg-emerald-500 text-white' : 'bg-emerald-600 text-white'}`}
                  >
                    <Star size={9} fill="currentColor" /> TU PLAN
                  </motion.div>
                )}

                {/* Downgrade habilitado por el admin */}
                {allowedDowngrade && (
                  <motion.div
                    variants={popIn}
                    initial="hidden"
                    animate="show"
                    transition={springPop}
                    className={`absolute -top-3 right-4 flex items-center gap-1 px-3 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase ${isDarkCard ? 'bg-amber-500 text-white' : 'bg-amber-500 text-white'}`}
                  >
                    <Check size={9} /> Baja habilitada
                  </motion.div>
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
                      <AnimatedNumber
                        value={plan.priceGs}
                        prefix="₲ "
                        currency
                        className={`text-base font-black font-headline leading-tight ${!isDarkCard && 'dark:text-white'}`}
                      />
                      <span className={`text-[10px] ${isDarkCard ? 'text-white/40' : 'text-slate-400 dark:text-slate-500'}`}>/mes</span>
                    </div>
                  </div>
                </div>

                {/* Feature preview (top 3) */}
                <ul className="space-y-1.5 mb-4">
                  {(plan.features || []).slice(0, 3).map((f: any) => (
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
                  <motion.button
                    {...useInteraction(tapOnly)}
                    onClick={() => setSelectedPlan(plan)}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors border ${isDarkCard
                      ? 'border-white/20 text-white/70 hover:bg-white/10'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/30 dark:hover:border-blue-500/30 hover:text-primary dark:hover:text-blue-400'
                      }`}
                  >
                    Ver Detalles
                  </motion.button>
                  {!isCurrent && blockedDowngrade && (
                    <div className="flex-1">
                      <button
                        type="button"
                        disabled
                        title="Pedí autorización al administrador"
                        className={`w-full py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-1.5 cursor-not-allowed ${isDarkCard
                          ? 'bg-white/5 text-white/40 border border-white/10'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                          }`}
                      >
                        <Lock size={12} /> Bajar de plan
                      </button>
                      <p className={`text-[9px] leading-tight text-center mt-1 ${isDarkCard ? 'text-white/40' : 'text-slate-400 dark:text-slate-500'}`}>
                        Pedí autorización al administrador
                      </p>
                    </div>
                  )}
                  {!isCurrent && !blockedDowngrade && (
                    <motion.button
                      {...useInteraction(tapOnly)}
                      onClick={() => handleSelectPlan(plan)}
                      className={`flex-1 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors flex items-center justify-center gap-1.5 ${isDarkCard
                        ? 'bg-white text-slate-900 hover:bg-slate-100'
                        : 'bg-primary dark:bg-blue-500 text-white shadow-md shadow-primary/20 dark:shadow-blue-500/20 hover:shadow-primary/30'
                        }`}
                    >
                      Elegir Plan <ArrowRight size={12} />
                    </motion.button>
                  )}
                  {isCurrent && (
                    <div className={`flex-1 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-1 ${isDarkCard ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'}`}>
                      <CheckCircle2 size={12} /> Activo
                    </div>
                  )}
                </div>
              </motion.div>
            </StaggerItem>
          );
        })}
      </StaggerList>

      {/* Info compact */}
      <Reveal onView className="bg-slate-50 dark:bg-slate-900/40 rounded-[1.5rem] p-4 border border-slate-100 dark:border-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
          Tu suscripción se renueva automáticamente cada mes. Podés cancelar en cualquier momento. Los lavados no utilizados no se acumulan.
        </p>
        <div className="flex gap-5">
          <div><span className="text-lg font-black text-primary dark:text-blue-400">100%</span><p className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-600">Garantía Brillo</p></div>
          <div className="w-px bg-slate-200 dark:bg-slate-800" />
          <div><span className="text-lg font-black text-primary dark:text-blue-400">24/7</span><p className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-600">Soporte VIP</p></div>
        </div>
      </Reveal>

      {/* Plan Detail Modal */}
      <AnimatePresence>
        {selectedPlan && !showPayment && (
          <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlan(null)}
              className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              variants={scaleIn}
              initial="hidden"
              animate="show"
              exit="exit"
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
                      <p className={`font-black text-base leading-tight flex items-baseline ${selectedPlan.dark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        <AnimatedNumber value={selectedPlan.priceGs} prefix="₲ " currency duration={0.6} />
                        <span className={`text-xs font-normal ${selectedPlan.dark ? 'text-white/40' : 'text-slate-400 dark:text-slate-500'}`}>/mes</span>
                      </p>
                    </div>
                  </div>
                  <Pressable tapOnly onClick={() => setSelectedPlan(null)} className={`p-1.5 rounded-full ${selectedPlan.dark ? 'text-white/40 hover:bg-white/10 text-white' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <X size={18} />
                  </Pressable>
                </div>

                {selectedPlan.id === currentPlanId && (
                  <motion.div variants={popIn} initial="hidden" animate="show" transition={springPop} className="inline-flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <Star size={10} fill="currentColor" /> Tu Plan Actual
                  </motion.div>
                )}

                <p className={`text-xs mt-3 leading-relaxed ${selectedPlan.dark ? 'text-white/50' : 'text-slate-500 dark:text-slate-400'}`}>{selectedPlan.desc}</p>
              </div>

              {/* Stats row */}
              <div className={`grid grid-cols-3 divide-x border-b ${selectedPlan.dark ? 'divide-white/10 border-white/10' : 'divide-slate-100 dark:divide-slate-800 border-slate-100 dark:border-slate-800'}`}>
                <div className="p-3 text-center">
                  <Droplets size={14} className={`mx-auto mb-1 ${selectedPlan.dark ? 'text-white/40' : 'text-primary dark:text-blue-400'}`} />
                  <AnimatedNumber value={selectedPlan.priceGs} prefix="₲ " currency duration={0.6} className={`font-black text-[11px] block ${selectedPlan.dark ? 'text-white' : 'text-slate-900 dark:text-white'}`} />
                  <p className={`text-[9px] uppercase font-bold ${selectedPlan.dark ? 'text-white/30' : 'text-slate-400 dark:text-slate-600'}`}>Precio</p>
                </div>
                <div className="p-3 text-center">
                  <Calendar size={14} className={`mx-auto mb-1 ${selectedPlan.dark ? 'text-white/40' : 'text-primary dark:text-blue-400'}`} />
                  <p className={`font-black text-sm ${selectedPlan.dark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>Mensual</p>
                  <p className={`text-[9px] uppercase font-bold ${selectedPlan.dark ? 'text-white/30' : 'text-slate-400 dark:text-slate-600'}`}>Renueva</p>
                </div>
                <div className="p-3 text-center">
                  <Clock size={14} className={`mx-auto mb-1 ${selectedPlan.dark ? 'text-white/40' : 'text-primary dark:text-blue-400'}`} />
                  <p className={`font-black text-sm ${selectedPlan.dark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>30 días</p>
                  <p className={`text-[9px] uppercase font-bold ${selectedPlan.dark ? 'text-white/30' : 'text-slate-400 dark:text-slate-600'}`}>Duración</p>
                </div>
              </div>

              {/* Full feature list */}
              <div className="p-5 space-y-2.5 max-h-52 overflow-y-auto overscroll-contain">
                {(selectedPlan.features || []).map((f: any) => (
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
                {selectedPlan.id === currentPlanId ? (
                  <div className="text-center py-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-2">
                    <CheckCircle2 size={16} /> Este es tu plan activo
                  </div>
                ) : isBlockedDowngrade(selectedPlan) ? (
                  <>
                    <button
                      type="button"
                      disabled
                      title="Pedí autorización al administrador"
                      className={`w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-not-allowed ${selectedPlan.dark ? 'bg-white/5 text-white/40 border border-white/10' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'}`}
                    >
                      <Lock size={15} /> Bajar de plan
                    </button>
                    <p className={`text-center text-[11px] mt-2 ${selectedPlan.dark ? 'text-white/40' : 'text-slate-400 dark:text-slate-500'}`}>
                      No podés bajar a un plan más económico. Pedí autorización al administrador.
                    </p>
                  </>
                ) : (
                  <button
                    onClick={() => { setSelectedPlan(null); handleSelectPlan(selectedPlan); }}
                    className={`w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-95 transition-all ${selectedPlan.dark ? 'bg-white text-slate-900' : 'bg-primary dark:bg-blue-500 text-white shadow-lg shadow-primary/20 dark:shadow-blue-500/20'}`}
                  >
                    <CreditCard size={15} /> Pagar {formatGs(selectedPlan.priceGs)}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPayment && (
          <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (payPhase !== 'processing') setShowPayment(null); }}
              className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative z-10 w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl bg-white dark:bg-slate-900"
            >
              {/* Payment Header */}
              <div className="p-6 bg-primary/5 dark:bg-blue-500/10 border-b border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-headline text-lg font-black text-slate-900 dark:text-white">Confirmar Pago</h3>
                  <button
                    onClick={() => { if (payPhase !== 'processing') setShowPayment(null); }}
                    className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Plan summary */}
                <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl p-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center">
                    <PlanIcon icon={showPayment.icon} size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{showPayment.name}</p>
                    <p className="text-[11px] text-slate-400">Membresía mensual</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-base text-slate-900 dark:text-white">{formatGs(showPayment.priceGs)}</p>
                    <p className="text-[10px] text-slate-400">/mes</p>
                  </div>
                </div>
              </div>

              {/* In-app card payment info */}
              <div className="p-5">
                <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <CreditCard size={28} className="text-primary dark:text-blue-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                    Vamos a cobrar a tu tarjeta guardada.
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    El pago se procesa de forma segura, sin salir de la app.
                  </p>
                </div>
              </div>

              {/* CTA */}
              <div className="p-4 pt-0">
                <button
                  onClick={handlePay}
                  disabled={payPhase === 'processing'}
                  className="w-full py-3.5 rounded-xl bg-primary dark:bg-blue-500 text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20 dark:shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none"
                >
                  <CreditCard size={15} />
                  Pagar {formatGs(showPayment.priceGs)}
                </button>

                <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-3 flex items-center justify-center gap-1">
                  <Shield size={10} /> Pago seguro
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PaymentResultOverlay
        phase={payPhase}
        message={payMsg}
        successText="¡Membresía activada!"
        onClose={() => {
          const wasSuccess = payPhase === 'success';
          setPayPhase(null);
          if (wasSuccess) { setShowPayment(null); loadData(); }
        }}
        onRetry={payPhase === 'error' ? handlePay : undefined}
      />

      {/* Iframe 3DS de Bancard (se muestra solo si el cobro lo requiere) */}
      {bancard3dsModal}
    </div>
  );
}
