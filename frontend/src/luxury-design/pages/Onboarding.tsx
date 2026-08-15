import React, { useEffect, useState, useCallback } from 'react';
import {
  CreditCard, Check, Shield, Crown, Zap, ArrowRight, Loader2, Lock,
  LogOut, Plus, X, ShieldCheck, CheckCircle2, Calendar, RefreshCw,
  FileText, ChevronDown,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { motion, AnimatePresence } from '../lib/motion';
import { loadBancardScript, runBancardPayment } from '../lib/bancardPayment';
import { useBancard3ds } from '../components/Bancard3dsModal';
import PaymentResultOverlay, { PayPhase } from '../components/PaymentResultOverlay';

/**
 * ALTA OBLIGATORIA DEL CLIENTE.
 *
 * Se muestra a pantalla completa (bloqueando el resto de la app) a todo CLIENT que no tenga
 * una membresía ACTIVA. Tres pasos, en orden:
 *   1. Cargar la tarjeta (catastro con el iframe seguro de Bancard).
 *   2. Elegir el plan (viene preseleccionado si el admin ya lo dejó asignado).
 *   3. Confirmar → se debita en el acto. Recién ahí la membresía queda ACTIVA.
 *
 * El cobro es SIEMPRE por adelantado: se paga el mes al asociarse y la renovación automática
 * vuelve a debitar la misma tarjeta al vencer el ciclo (cron diario de auto-renovación).
 *
 * La única salida sin completar el alta es cerrar sesión.
 */

const formatGs = (n: number) => `₲ ${Number(n || 0).toLocaleString('es-PY')}`;
const REGISTER_CONTAINER_ID = 'bancard-onboarding-card';

function PlanIcon({ name, size = 18 }: { name: string; size?: number }) {
  const n = (name || '').toLowerCase();
  if (n.includes('vip')) return <Crown size={size} className="text-secondary" />;
  if (n.includes('prem')) return <Zap size={size} className="text-secondary" />;
  return <Shield size={size} className="text-slate-400" />;
}

interface OnboardingProps {
  user: any;
  onDone: () => void;
  onLogout: () => void;
}

export default function Onboarding({ user, onDone, onLogout }: OnboardingProps) {
  const [plans, setPlans] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const [showCardForm, setShowCardForm] = useState(false);
  const [registering, setRegistering] = useState(false);
  const mountedFormRef = React.useRef(false);

  const [payPhase, setPayPhase] = useState<PayPhase>(null);
  const [payMsg, setPayMsg] = useState('');
  const { handlers: bancard3ds, modal: bancard3dsModal } = useBancard3ds();

  // Autorización de débito: sin leerla y aceptarla no se puede pagar.
  const [mandato, setMandato] = useState<any>(null);
  const [mandatoAbierto, setMandatoAbierto] = useState(false);
  const [mandatoLeido, setMandatoLeido] = useState(false);   // llegó al final del texto
  const [mandatoAceptado, setMandatoAceptado] = useState(false);
  const [cargandoMandato, setCargandoMandato] = useState(false);

  const hasCard = cards.length > 0;
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || null;

  const load = useCallback(async () => {
    try {
      const [plansRes, cardsRes] = await Promise.all([
        api.get('/plans', { _noCache: true } as any).catch(() => null),
        api.get('/payments/cards', { _noCache: true } as any).catch(() => null),
      ]);
      if (plansRes?.data?.success) {
        const list = (plansRes.data.data || []).filter((p: any) => p.isActive !== false);
        setPlans(list);
        // Preselección: el plan que el admin dejó asignado al crear la cuenta.
        setSelectedPlanId((prev) => prev ?? user?.pendingPlan?.id ?? null);
      }
      if (cardsRes?.data?.success) setCards(cardsRes.data.data || []);
    } finally {
      setLoading(false);
    }
  }, [user?.pendingPlan?.id]);

  useEffect(() => { load(); }, [load]);

  // El documento se pide para el plan elegido: el importe y el plan van dentro del texto.
  // Si cambia de plan, la aceptación anterior deja de valer y hay que volver a aceptar.
  useEffect(() => {
    if (!selectedPlanId) { setMandato(null); return; }
    let cancelado = false;
    setCargandoMandato(true);
    setMandatoAceptado(false);
    setMandatoLeido(false);
    api.get(`/contracts/preview?planId=${selectedPlanId}`, { _noCache: true } as any)
      .then((r) => { if (!cancelado) setMandato(r.data?.data || null); })
      .catch(() => { if (!cancelado) setMandato(null); })
      .finally(() => { if (!cancelado) setCargandoMandato(false); });
    return () => { cancelado = true; };
  }, [selectedPlanId]);

  // Marca el texto como leído cuando el usuario llega al final del panel.
  const alScrollearMandato = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setMandatoLeido(true);
  };

  // ── Paso 1: catastro de tarjeta con el iframe de Bancard ──
  const openCardForm = async () => {
    setRegistering(true);
    mountedFormRef.current = false;
    try {
      const res = await api.post('/payments/card/register');
      const { processId, jsLibUrl } = res.data?.data || {};
      if (!processId || !jsLibUrl) throw new Error('No se pudo iniciar el registro de la tarjeta.');
      setShowCardForm(true);
      const sdk = await loadBancardScript(jsLibUrl);
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      if (sdk.Cards && typeof sdk.Cards.createForm === 'function') {
        sdk.Cards.createForm(REGISTER_CONTAINER_ID, String(processId));
        mountedFormRef.current = true;
      } else {
        throw new Error('El SDK de Bancard no está disponible.');
      }
    } catch (err: any) {
      setShowCardForm(false);
      toast.error(err?.response?.data?.message || err?.message || 'No se pudo iniciar el registro.');
    } finally {
      setRegistering(false);
    }
  };

  const closeCardForm = async () => {
    const wasMounted = mountedFormRef.current;
    mountedFormRef.current = false;
    setShowCardForm(false);
    document.getElementById(REGISTER_CONTAINER_ID)?.replaceChildren();
    if (wasMounted) {
      try {
        const res = await api.post('/payments/card/sync');
        const list = res.data?.data || [];
        setCards(list);
        if (list.length === 0) toast('No se detectó ninguna tarjeta nueva. Probá de nuevo.', { icon: '💳' });
      } catch {
        await load();
      }
    }
  };

  // ── Paso 3: cobro inmediato del primer mes ──
  const handlePay = async () => {
    if (!selectedPlan || !hasCard || !mandatoAceptado) return;
    setPayPhase('processing');
    const r = await runBancardPayment(
      '/payments/charge-membership',
      { planId: selectedPlan.id, expectedAmountGs: selectedPlan.priceGs, mandateAccepted: true },
      '/payments/charge-3ds-complete',
      bancard3ds,
    );
    if (r.ok) {
      setPayPhase('success');
    } else {
      setPayMsg(r.message || 'No se pudo procesar el pago. Probá con otra tarjeta.');
      setPayPhase('error');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[300] overflow-y-auto overscroll-contain bg-slate-50 dark:bg-slate-950">
      <div className="min-h-full flex flex-col items-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-lg space-y-6">

          {/* Encabezado — distinto para el alta inicial y para quien vuelve sin plan vigente. */}
          <div className="text-center space-y-2">
            <img src="/logo.png" alt="Luxury Garage" className="w-16 h-16 mx-auto rounded-2xl" />
            <h1 className="font-headline text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {hasCard
                ? 'Activá tu membresía'
                : `¡Bienvenido${user?.firstName ? `, ${user.firstName}` : ''}!`}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
              {hasCard
                ? 'Elegí tu plan para volver a activar tu cuenta. Se cobra el mes por adelantado y se renueva automáticamente.'
                : 'Para activar tu cuenta necesitás registrar tu tarjeta y elegir tu plan. El primer mes se cobra ahora y se renueva automáticamente cada mes.'}
            </p>
          </div>

          {/* Progreso */}
          <div className="flex items-center justify-center gap-2">
            {[
              { n: 1, label: 'Tarjeta', done: hasCard },
              { n: 2, label: 'Plan', done: !!selectedPlanId },
              { n: 3, label: 'Pago', done: false },
            ].map((s, i) => (
              <React.Fragment key={s.n}>
                {i > 0 && <div className={`h-0.5 w-6 rounded-full ${s.done ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} />}
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${s.done
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                    {s.done ? <Check size={12} /> : s.n}
                  </div>
                  <span className={`text-[11px] font-bold ${s.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {s.label}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* ── PASO 1: tarjeta ── */}
          <section className="bg-white dark:bg-slate-900/60 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${hasCard ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 dark:bg-blue-500/15 text-primary dark:text-blue-400'}`}>
                {hasCard ? <Check size={16} /> : <CreditCard size={16} />}
              </div>
              <h2 className="font-black text-base text-slate-900 dark:text-white">1. Tu tarjeta</h2>
            </div>

            {hasCard ? (
              <div className="space-y-2">
                {cards.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-white p-4 shadow-lg">
                    <CreditCard size={20} className="shrink-0 opacity-90" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm uppercase tracking-wide">
                        {c.brand || 'Tarjeta'} •••• {(c.maskedNumber || '').replace(/\D/g, '').slice(-4) || '••••'}
                      </p>
                      {c.expirationDate && <p className="text-[11px] opacity-70 tabular-nums">Vence {c.expirationDate}</p>}
                    </div>
                    <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Se usa para el débito mensual. Los datos los procesa Bancard directamente —
                  nunca pasan por nuestros servidores.
                </p>
                <button
                  onClick={openCardForm}
                  disabled={registering}
                  className="w-full h-12 rounded-2xl bg-primary dark:bg-blue-500 text-white text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-60"
                >
                  {registering ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  {registering ? 'Iniciando…' : 'Registrar mi tarjeta'}
                </button>
              </>
            )}
          </section>

          {/* ── PASO 2: plan ── */}
          <section className={`bg-white dark:bg-slate-900/60 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 p-5 space-y-4 transition-opacity ${hasCard ? '' : 'opacity-50 pointer-events-none'}`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${selectedPlanId ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 dark:bg-blue-500/15 text-primary dark:text-blue-400'}`}>
                {selectedPlanId ? <Check size={16} /> : <Crown size={16} />}
              </div>
              <h2 className="font-black text-base text-slate-900 dark:text-white">2. Tu plan</h2>
            </div>

            {plans.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No hay planes disponibles.</p>
                <p className="text-xs text-slate-400 mt-1">Contactá al administrador para que los configure.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {plans.map((p) => {
                  const active = p.id === selectedPlanId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${active
                        ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-500/10'
                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          <PlanIcon name={p.name} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-sm text-slate-900 dark:text-white truncate">{p.name}</p>
                          {p.description && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{p.description}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-sm text-slate-900 dark:text-white tabular-nums">{formatGs(p.priceGs)}</p>
                          <p className="text-[10px] text-slate-400">/mes</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${active
                          ? 'border-primary dark:border-blue-500 bg-primary dark:bg-blue-500'
                          : 'border-slate-300 dark:border-slate-600'}`}>
                          {active && <Check size={11} className="text-white" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── PASO 3: confirmar y pagar ── */}
          <section className={`bg-white dark:bg-slate-900/60 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 p-5 space-y-4 transition-opacity ${hasCard && selectedPlan ? '' : 'opacity-50 pointer-events-none'}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 dark:bg-blue-500/15 text-primary dark:text-blue-400 flex items-center justify-center">
                <Lock size={16} />
              </div>
              <h2 className="font-black text-base text-slate-900 dark:text-white">3. Confirmar y activar</h2>
            </div>

            {selectedPlan && (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{selectedPlan.name} · primer mes</span>
                  <span className="font-black text-slate-900 dark:text-white tabular-nums">{formatGs(selectedPlan.priceGs)}</span>
                </div>
                <div className="h-px bg-slate-200 dark:bg-slate-700" />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-1.5">
                  <RefreshCw size={12} className="shrink-0 mt-0.5" />
                  Se debita hoy y se renueva automáticamente cada mes por el mismo monto.
                  Podés cancelar la renovación cuando quieras desde «Mis Membresías».
                </p>
              </div>
            )}

            {/* ── Autorización de débito automático ── */}
            {selectedPlan && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMandatoAbierto((v) => !v)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <FileText size={18} className="text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {mandato?.titulo || 'Autorización de débito automático'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                      {mandatoAbierto ? 'Leelo completo y aceptá abajo' : 'Tocá para leer el documento'}
                    </p>
                  </div>
                  {mandatoAceptado
                    ? <Check size={18} className="text-emerald-500 shrink-0" />
                    : <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${mandatoAbierto ? 'rotate-180' : ''}`} />}
                </button>

                <AnimatePresence initial={false}>
                  {mandatoAbierto && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <div
                        onScroll={alScrollearMandato}
                        className="max-h-72 overflow-y-auto overscroll-contain px-4 pb-3 border-t border-slate-100 dark:border-slate-800"
                      >
                        {cargandoMandato ? (
                          <div className="py-8 flex justify-center"><Loader2 size={20} className="animate-spin text-primary" /></div>
                        ) : (
                          <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300 pt-3">
                            {mandato?.texto || 'No se pudo cargar el documento. Reintentá en un momento.'}
                          </pre>
                        )}
                      </div>
                      {!mandatoLeido && mandato?.texto && (
                        <p className="px-4 pb-2 text-[11px] text-slate-400 text-center">Seguí bajando para leerlo completo</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <label className={`flex items-start gap-3 p-4 border-t border-slate-100 dark:border-slate-800 cursor-pointer select-none transition-colors ${mandatoAceptado ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''}`}>
                  <input
                    type="checkbox"
                    checked={mandatoAceptado}
                    disabled={!mandato?.texto}
                    onChange={(e) => {
                      // Para aceptar hay que haber abierto y recorrido el documento.
                      if (e.target.checked && !mandatoLeido) {
                        setMandatoAbierto(true);
                        toast('Leé el documento hasta el final para poder aceptarlo', { icon: '📄' });
                        return;
                      }
                      setMandatoAceptado(e.target.checked);
                    }}
                    className="mt-0.5 w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/30 shrink-0 disabled:opacity-40"
                  />
                  <span className="text-[12.5px] text-slate-700 dark:text-slate-200 leading-relaxed">
                    Leí y <strong>autorizo</strong> el débito automático de{' '}
                    <strong>{formatGs(selectedPlan.priceGs)}</strong> por mes a mi tarjeta, con renovación
                    automática, y sé que puedo cancelarlo cuando quiera.
                  </span>
                </label>
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={!hasCard || !selectedPlan || !mandatoAceptado || payPhase === 'processing'}
              className="w-full h-14 rounded-2xl bg-primary dark:bg-blue-500 text-white text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              {payPhase === 'processing'
                ? <><Loader2 size={18} className="animate-spin" /> Procesando…</>
                : <><CreditCard size={18} /> Pagar {selectedPlan ? formatGs(selectedPlan.priceGs) : ''} y activar</>}
            </button>

            {!mandatoAceptado && selectedPlan && hasCard && (
              <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 -mt-1">
                Aceptá la autorización para poder continuar
              </p>
            )}

            <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 flex items-center justify-center gap-1">
              <Shield size={10} /> Pago seguro procesado por Bancard
            </p>
          </section>

          {/* Salida */}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-2"
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </div>

      {/* Modal de catastro con el iframe seguro de Bancard */}
      <AnimatePresence>
        {showCardForm && (
          <motion.div
            className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={closeCardForm} />
            <motion.div
              className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto overscroll-contain"
              initial={{ y: '100%', opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-slate-900 dark:text-white">Registrar tarjeta</h4>
                <button onClick={closeCardForm} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cerrar">
                  <X size={20} />
                </button>
              </div>
              <div id={REGISTER_CONTAINER_ID} className="min-h-[420px] w-full rounded-2xl overflow-hidden" />
              <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                <ShieldCheck size={14} className="text-emerald-500" />
                Tus datos de tarjeta nunca tocan nuestros servidores.
              </div>
              <button
                onClick={closeCardForm}
                className="w-full h-12 rounded-2xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> Listo
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PaymentResultOverlay
        phase={payPhase}
        message={payMsg}
        successText="¡Tu membresía está activa!"
        onClose={() => {
          const wasSuccess = payPhase === 'success';
          setPayPhase(null);
          if (wasSuccess) {
            api.invalidate('/memberships', '/auth/me', '/luxury/profile/full');
            onDone();
          }
        }}
        onRetry={payPhase === 'error' ? handlePay : undefined}
      />

      {bancard3dsModal}
    </div>
  );
}
