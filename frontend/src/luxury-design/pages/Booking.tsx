import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, Clock, CheckCircle2, Sparkles, History, ChevronRight,
  ChevronLeft, Loader2, X, AlertCircle, Timer, Tag, Car, Wallet, Plus
} from 'lucide-react';
import api from '../../services/api';
import BottomSheet from '../components/BottomSheet';
import PaymentResultOverlay, { PayPhase } from '../components/PaymentResultOverlay';
import { useBancard3ds } from '../components/Bancard3dsModal';
import { loadBancardScript } from '../lib/bancardPayment';
import useScrollLock from '../../hooks/useScrollLock';
import { computeServicePrice, formatGs as fmtGs } from '../../constants/pricing';
import {
  motion,
  AnimatePresence,
  StaggerList,
  StaggerItem,
  Pressable,
  AnimatedNumber,
  Skeleton,
  scaleIn,
  popIn,
  springSoft,
  springPop,
  useInteraction,
  tapOnly,
} from '../lib/motion';

interface BookingProps {
  user: any;
  onBookingComplete: () => void;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

const formatGs = (n: number) =>
  n ? `₲ ${Number(n).toLocaleString('es-PY')}` : '';

type ModalState = { type: 'success' | 'error'; title: string; message: string } | null;

// ── Service Carousel ─────────────────────────────────────────────────────────
function ServiceCarousel({
  services,
  selectedId,
  onSelect,
}: {
  services: any[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedIdx = services.findIndex(s => s.id === selectedId);

  const scroll = (dir: 'prev' | 'next') => {
    const next = dir === 'next'
      ? Math.min(selectedIdx + 1, services.length - 1)
      : Math.max(selectedIdx - 1, 0);
    onSelect(services[next].id);
    scrollRef.current
      ?.children[next]
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  // Scroll into view when selection changes
  useEffect(() => {
    const el = scrollRef.current?.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedIdx]);

  const selected = services[selectedIdx];

  return (
    <div className="space-y-3">
      {/* Big highlighted card of selected */}
      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={springSoft}
            className="relative bg-primary dark:bg-blue-600 rounded-2xl p-5 lg:p-6 text-white overflow-hidden shadow-xl shadow-primary/25"
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-black/10 rounded-full blur-2xl" />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex-1">
                <motion.div
                  variants={popIn}
                  initial="hidden"
                  animate="show"
                  transition={springPop}
                  className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest mb-2"
                >
                  <Sparkles size={9} fill="currentColor" /> Seleccionado
                </motion.div>
                <h3 className="font-black text-lg lg:text-xl leading-tight tracking-tight">{selected.name}</h3>
                {selected.description && (
                  <p className="text-white/60 text-xs mt-1 leading-relaxed line-clamp-2">{selected.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4 relative z-10">
              {selected.price && (
                <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5">
                  <Tag size={12} />
                  <span className="font-black text-sm">{formatGs(selected.price)}</span>
                </div>
              )}
              {selected.durationMinutes && (
                <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5">
                  <Timer size={12} />
                  <span className="font-black text-sm">{selected.durationMinutes} min</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Carousel strip */}
      <div className="relative">
        {/* Prev */}
        <motion.button
          {...useInteraction(tapOnly)}
          onClick={() => scroll('prev')}
          disabled={selectedIdx === 0}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center shadow-md disabled:opacity-30 transition-shadow"
        >
          <ChevronLeft size={14} className="text-slate-700 dark:text-slate-300" />
        </motion.button>

        {/* Cards row */}
        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scroll-smooth no-scrollbar px-10"
        >
          {services.map((s, i) => {
            const isSelected = s.id === selectedId;
            return (
              <motion.button
                {...useInteraction(tapOnly)}
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`flex-shrink-0 w-32 rounded-xl p-3 border-2 transition-colors text-left ${isSelected
                  ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-500/10'
                  : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-primary/30'
                  }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${isSelected ? 'bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-400' : 'bg-slate-200/60 dark:bg-slate-700 text-slate-400'}`}>
                  <Sparkles size={13} />
                </div>
                <p className={`font-bold text-[11px] leading-tight ${isSelected ? 'text-primary dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {s.name}
                </p>
                {s.durationMinutes && (
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <Timer size={9} /> {s.durationMinutes}min
                  </p>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Next */}
        <motion.button
          {...useInteraction(tapOnly)}
          onClick={() => scroll('next')}
          disabled={selectedIdx === services.length - 1}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center shadow-md disabled:opacity-30 transition-shadow"
        >
          <ChevronRight size={14} className="text-slate-700 dark:text-slate-300" />
        </motion.button>
      </div>

      {/* Sliding dot indicators */}
      <SlidingDots total={services.length} activeIdx={selectedIdx} onSelect={i => onSelect(services[i].id)} />
    </div>
  );
}

// ── Sliding Dots Indicator ────────────────────────────────────────────────────
const VISIBLE = 7;
function SlidingDots({ total, activeIdx, onSelect }: { total: number; activeIdx: number; onSelect: (i: number) => void }) {
  if (total <= 1) return null;
  const half = Math.floor(VISIBLE / 2);
  const start = Math.min(Math.max(activeIdx - half, 0), Math.max(total - VISIBLE, 0));
  const visible = Array.from({ length: Math.min(VISIBLE, total) }, (_, i) => start + i);
  return (
    <div className="flex justify-center items-center gap-1.5 pt-2 pb-1">
      <motion.div className="flex items-center gap-1.5" layout>
        {visible.map(i => {
          const isActive = i === activeIdx;
          const distFromActive = Math.abs(i - activeIdx);
          const scale = isActive ? 1 : distFromActive === 1 ? 0.8 : 0.6;
          const opacity = isActive ? 1 : distFromActive === 1 ? 0.5 : 0.25;
          return (
            <motion.button
              key={i}
              layout
              animate={{ width: isActive ? 20 : 6, height: 6, scale, opacity }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              onClick={() => onSelect(i)}
              className={`rounded-full ${isActive ? 'bg-primary dark:bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
              style={{ minWidth: isActive ? 20 : 6 }}
            />
          );
        })}
      </motion.div>
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
function StatusBadge({ status, light }: { status: string; light?: boolean }) {
  const map: Record<string, { label: string; cls: string; lightCls: string }> = {
    CONFIRMED: { label: 'Confirmado', cls: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400', lightCls: 'text-white/90' },
    COMPLETED: { label: 'Completado', cls: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400', lightCls: 'text-white/90' },
    CANCELLED: { label: 'Cancelado', cls: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400', lightCls: 'text-white/90' },
    IN_PROGRESS: { label: 'En Curso', cls: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400', lightCls: 'text-white/90' },
    PENDING: { label: 'Pendiente', cls: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400', lightCls: 'text-white/70' },
  };
  const item = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-500', lightCls: 'text-white/70' };
  if (light) return <span className={`text-[9px] font-black uppercase tracking-widest ${item.lightCls}`}>{item.label}</span>;
  return <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 ${item.cls}`}>{item.label}</span>;
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
      <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shrink-0 shadow-sm text-primary dark:text-blue-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</p>
        <p className="font-bold text-sm text-slate-800 dark:text-slate-200 mt-0.5 capitalize leading-snug">{value}</p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Booking({ user, onBookingComplete }: BookingProps) {
  const [showForm, setShowForm] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [vehicleSizes, setVehicleSizes] = useState<any[]>([]);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [isBooking, setIsBooking] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  // ── Cobertura por plan + flujo de pago híbrido ──
  const [coverage, setCoverage] = useState<any>(null);
  const [payPhase, setPayPhase] = useState<PayPhase>(null);
  const [payMsg, setPayMsg] = useState('');
  const [needsChoice, setNeedsChoice] = useState(false);
  const [choicePrice, setChoicePrice] = useState(0);
  // Modal + handlers para el desafío 3DS de Bancard al cobrar el turno con tarjeta.
  const { handlers: bancard3ds, modal: bancard3dsModal } = useBancard3ds();

  // ── Pago con saldo de la billetera ──
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentSource, setPaymentSource] = useState<'card' | 'wallet'>('card');

  // Scroll-lock para los overlays inline (modal de resultado simple + elección de cupo).
  // BottomSheet y PaymentResultOverlay ya bloquean por su cuenta.
  useScrollLock(!!modal || needsChoice);

  const now = new Date();
  const [day, setDay] = useState(now.getDate().toString());
  const [month, setMonth] = useState(now.getMonth().toString());
  const [year, setYear] = useState(now.getFullYear().toString());
  // Turno elegido ('HH:MM') + disponibilidad real del día (grilla de turnos).
  const [slotTime, setSlotTime] = useState('');
  const [slots, setSlots] = useState<any[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotRefresh, setSlotRefresh] = useState(0);

  useEffect(() => {
    const maxDay = getDaysInMonth(parseInt(month), parseInt(year));
    if (parseInt(day) > maxDay) setDay(maxDay.toString());
  }, [month, year]);

  useEffect(() => {
    api.get('/services').then(res => {
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setServices(list);
      if (list.length > 0) setSelectedServiceId(list[0].id);
    }).catch(() => setServices([]));
  }, []);

  // Cargar los tamaños de vehículo configurados en la BD (públicos, activos, ordenados)
  useEffect(() => {
    api.get('/vehicle-sizes').then(res => {
      setVehicleSizes(Array.isArray(res.data?.data) ? res.data.data : []);
    }).catch(() => setVehicleSizes([]));
  }, []);

  // Cargar el saldo disponible de la billetera (wallet + referidos)
  const fetchWalletBalance = async () => {
    try {
      const { data } = await api.get('/credits', { _noCache: true });
      setWalletBalance(data?.data?.totalBalance ?? 0);
    } catch {
      setWalletBalance(0);
    }
  };
  useEffect(() => { fetchWalletBalance(); }, []);

  const selectedService = services.find(s => s.id === selectedServiceId);
  const vehicle = user?.vehicles?.[0];

  // Tamaños disponibles para el servicio elegido (intersección BD ↔ pricingBySize del servicio)
  const sizeOptions = selectedService?.pricingBySize
    ? vehicleSizes.filter(vs => selectedService.pricingBySize[vs.key] != null)
    : [];
  const serviceAddons = Array.isArray(selectedService?.addons) ? selectedService.addons : [];

  // Al cambiar de servicio: preseleccionar el tamaño del vehículo si aplica y resetear adicionales
  useEffect(() => {
    setSelectedAddons([]);
    if (selectedService?.pricingBySize) {
      const vehicleSizeKey = vehicle?.size;
      if (vehicleSizeKey && selectedService.pricingBySize[vehicleSizeKey] != null) {
        setSelectedSize(vehicleSizeKey);
      } else {
        setSelectedSize('');
      }
    } else {
      setSelectedSize('');
    }
  }, [selectedServiceId, vehicleSizes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAddon = (key: string) =>
    setSelectedAddons(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const totalPrice = selectedService
    ? computeServicePrice(selectedService, selectedSize, selectedAddons)
    : 0;

  // ── Cobertura granular: qué adicionales cubre el plan + total real a pagar ──
  // (lógica idéntica al backend en POST /appointments)
  const includedAddons = coverage?.includedAddons; // 'all' | [keys] | null
  const isAddonIncluded = (key: string) =>
    !!coverage?.covered &&
    (includedAddons === 'all' ||
      (Array.isArray(includedAddons) && includedAddons.includes(key)));

  // Precio base por tamaño (igual que computeServicePrice, sin adicionales)
  const basePriceForSize =
    selectedService?.pricingBySize?.[selectedSize] ??
    selectedService?.basePriceGs ??
    0;
  // Base cubierta → ₲0; si no, se cobra el precio base completo.
  const baseChargeable = coverage?.covered ? 0 : basePriceForSize;
  // Adicionales elegidos que NO están incluidos en el plan → se cobran.
  const addonsChargeable = serviceAddons
    .filter((a: any) => selectedAddons.includes(a.key) && !isAddonIncluded(a.key))
    .reduce((sum: number, a: any) => sum + (a.priceGs || 0), 0);
  const chargeable = baseChargeable + addonsChargeable; // TOTAL real a pagar

  // ── Método de pago: tarjeta vs saldo de la billetera ──
  const walletEnough = walletBalance >= chargeable;
  // Si el saldo no alcanza para el monto a pagar, forzar tarjeta.
  useEffect(() => {
    if (paymentSource === 'wallet' && !walletEnough) setPaymentSource('card');
  }, [walletEnough, paymentSource]);

  // Cobertura del plan para el servicio elegido (se recarga al cambiar de servicio)
  useEffect(() => {
    if (!selectedServiceId) { setCoverage(null); return; }
    let cancelled = false;
    setCoverage(null);
    api.get('/appointments/coverage/' + selectedServiceId)
      .then(res => { if (!cancelled) setCoverage(res.data?.data ?? null); })
      .catch(() => { if (!cancelled) setCoverage(null); });
    return () => { cancelled = true; };
  }, [selectedServiceId]);

  useEffect(() => { fetchBookings(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBookings = async () => {
    try {
      const res = await api.get('/appointments');
      setBookings(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const buildStartTime = () => {
    const m = (parseInt(month) + 1).toString().padStart(2, '0');
    const d = day.padStart(2, '0');
    return `${year}-${m}-${d}T${slotTime}:00`;
  };

  // Disponibilidad real de turnos del día elegido (horario + bahías + duración del servicio).
  // Se recarga al cambiar fecha/servicio o tras reservar (slotRefresh), y deselecciona el turno
  // si dejó de estar disponible → el cliente nunca elige un horario ya completo.
  useEffect(() => {
    if (!selectedServiceId) { setSlots([]); return; }
    const m = (parseInt(month) + 1).toString().padStart(2, '0');
    const d = day.padStart(2, '0');
    const dateStr = `${year}-${m}-${d}`;
    let cancelled = false;
    setSlotsLoading(true);
    api.get('/appointments/day-availability', { params: { date: dateStr, serviceId: selectedServiceId }, _noCache: true })
      .then(res => {
        if (cancelled) return;
        const list = Array.isArray(res.data?.data?.slots) ? res.data.data.slots : [];
        setSlots(list);
        setSlotTime(prev => {
          const s = list.find((x: any) => x.time === prev);
          return s && s.available ? prev : '';
        });
      })
      .catch(() => { if (!cancelled) setSlots([]); })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [day, month, year, selectedServiceId, slotRefresh]);

  // Valida los campos requeridos antes de reservar. Devuelve true si todo OK.
  const validateBooking = () => {
    if (!selectedServiceId) {
      setModal({ type: 'error', title: 'Servicio requerido', message: 'Por favor seleccioná un tipo de servicio para continuar.' });
      return false;
    }
    const vehicleId = user.vehicles?.[0]?.id;
    if (!vehicleId) {
      setModal({ type: 'error', title: 'Sin vehículo', message: 'No encontramos un vehículo asociado a tu cuenta. Agregá uno desde tu perfil.' });
      return false;
    }
    // Validación suave: si el servicio tiene precios por tamaño, exigir elegir uno
    if (selectedService?.pricingBySize && !selectedSize) {
      setModal({ type: 'error', title: 'Tamaño requerido', message: 'Elegí el tamaño del vehículo' });
      return false;
    }
    if (!slotTime) {
      setModal({ type: 'error', title: 'Elegí un horario', message: 'Seleccioná un turno disponible para continuar.' });
      return false;
    }
    return true;
  };

  // Reserva híbrida: gratis si el plan cubre, cobra el turno si no, y si el cupo se
  // agotó pregunta pagar/cargar al próximo mes (billingChoice 'pay' | 'overage').
  const doBooking = async (billingChoice?: 'pay' | 'overage') => {
    if (!validateBooking()) return;
    setNeedsChoice(false);
    setPayPhase('processing');
    const vehicleId = user.vehicles?.[0]?.id;
    const startTime = buildStartTime();
    const dateOnly = startTime.split('T')[0];
    try {
      const body: any = {
        vehicleId,
        serviceId: selectedServiceId,
        date: dateOnly,
        startTime,
        vehicleSize: selectedSize,
        addons: selectedAddons,
        paymentSource,
        ...(billingChoice ? { billingChoice } : {}),
      };
      const res = await api.post('/appointments', body);
      const d = res.data || {};
      if (d.needsChoice) {
        setPayPhase(null);
        setChoicePrice(d.price);
        setNeedsChoice(true);
        return;
      }
      // Desafío 3DS de Bancard: montar el iframe, esperar al usuario y confirmar la cita.
      if (d.requires3ds && d.data) {
        const { processId, jsLibUrl, shopProcessId } = d.data;
        try {
          const sdk = await loadBancardScript(jsLibUrl);
          const containerId = await bancard3ds.mount({ processId, shopProcessId });
          // TODO: verificar API exacta de Bancard checkout 4.0.0 (método de cobro 3DS).
          if (sdk.Charge && typeof sdk.Charge.createForm === 'function') {
            sdk.Charge.createForm(containerId, String(processId));
          } else if (sdk.Cards && typeof sdk.Cards.createForm === 'function') {
            sdk.Cards.createForm(containerId, String(processId));
          }
          await bancard3ds.waitForDone();
        } finally {
          bancard3ds.cleanup?.();
        }
        const conf = await api.post('/appointments/charge-booking-3ds-complete', { shopProcessId });
        if (conf.data?.success) {
          setPayPhase('success');
        } else {
          setPayMsg(conf.data?.message || 'No se pudo completar la verificación del pago.');
          setPayPhase('error');
        }
        return;
      }
      if (d.status === 'booked' || (d.success === true && d.data)) {
        setPayPhase('success');
        return;
      }
      setPayMsg(d.message || 'No se pudo procesar la reserva.');
      setPayPhase('error');
    } catch (err: any) {
      const resp = err?.response?.data;
      if (resp?.code === 'SLOT_TAKEN') {
        // Alguien tomó el último lugar de ese turno mientras el cliente decidía → refrescamos
        // la grilla para que vea el estado real y elija otro horario.
        setPayMsg('Ese horario se acaba de completar. Elegí otro turno disponible.');
        setPayPhase('error');
        setSlotTime('');
        setSlotRefresh(x => x + 1);
      } else if (resp?.code === 'INSUFFICIENT_FUNDS') {
        setPayMsg(resp?.message || 'Saldo insuficiente para pagar este turno con tu billetera.');
        setPayPhase('error');
      } else if (resp?.code === 'NO_CARD') {
        setPayMsg('No tenés una tarjeta guardada. Agregala en Perfil → Mis Tarjetas.');
        setPayPhase('error');
      } else {
        setPayMsg(resp?.message || 'Error al reservar.');
        setPayPhase('error');
      }
    }
  };

  // Tras cerrar el overlay de éxito: refrescar historial y resetear adicionales.
  const handlePayClose = () => {
    const ok = payPhase === 'success';
    setPayPhase(null);
    if (ok) {
      setShowForm(false);
      fetchBookings();
      onBookingComplete();
      setSelectedAddons([]);
      setSlotTime('');
      setSlotRefresh(x => x + 1); // el turno recién tomado ya no debe figurar libre
      fetchWalletBalance();
      api.get('/appointments/coverage/' + selectedServiceId)
        .then(res => setCoverage(res.data?.data ?? null))
        .catch(() => {});
    }
  };

  const maxDay = getDaysInMonth(parseInt(month), parseInt(year));
  const days = Array.from({ length: maxDay }, (_, i) => (i + 1).toString());
  const years = Array.from({ length: 3 }, (_, i) => (now.getFullYear() + i).toString());
  const selectClass = "flex-1 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm rounded-xl px-3 py-3 border-none outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none text-center";

  return (
    <>
      <StaggerList className="space-y-4 pb-24">
        {/* Formulario de reserva — SIEMPRE visible (no detrás de un botón) */}
        <StaggerItem className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm p-5 lg:p-7 transition-colors">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-primary/10 dark:bg-blue-500/20 rounded-xl flex items-center justify-center text-primary dark:text-blue-400">
              <Sparkles size={18} />
            </div>
            <h2 className="text-base lg:text-lg font-black tracking-tight text-slate-900 dark:text-white">Nueva Reserva</h2>
          </div>

          {/* Service Picker */}
          <div className="mb-5">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Tipo de Servicio</p>
            {services.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-xs">
                <Loader2 className="animate-spin" size={16} /> Cargando servicios...
              </div>
            ) : (
              <ServiceCarousel
                services={services}
                selectedId={selectedServiceId}
                onSelect={setSelectedServiceId}
              />
            )}
          </div>

          {/* Vehicle Size Picker — solo si el servicio tiene precios por tamaño */}
          {sizeOptions.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Car size={13} className="text-primary dark:text-blue-400 shrink-0" />
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tamaño del Vehículo</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {sizeOptions.map(vs => {
                  const isSel = selectedSize === vs.key;
                  return (
                    <motion.button
                      {...useInteraction(tapOnly)}
                      key={vs.key}
                      type="button"
                      onClick={() => setSelectedSize(vs.key)}
                      className={`rounded-xl p-3 border-2 transition-colors text-left ${isSel
                        ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-500/10'
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-primary/30'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className={`font-bold text-[12px] leading-tight ${isSel ? 'text-primary dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {vs.label}
                        </p>
                        <AnimatePresence>
                          {isSel && (
                            <motion.span
                              variants={popIn}
                              initial="hidden"
                              animate="show"
                              exit="exit"
                              className="shrink-0"
                            >
                              <CheckCircle2 size={14} className="text-primary dark:text-blue-400" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                      <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 mt-1">
                        {fmtGs(selectedService.pricingBySize[vs.key])}
                      </p>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Adicionales — solo si el servicio tiene addons */}
          {serviceAddons.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Plus size={13} className="text-primary dark:text-blue-400 shrink-0" />
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Adicionales</p>
              </div>
              <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-2.5">
                {serviceAddons.map((a: any) => {
                  const isSel = selectedAddons.includes(a.key);
                  const included = isAddonIncluded(a.key);
                  return (
                    <motion.button
                      {...useInteraction(tapOnly)}
                      key={a.key}
                      type="button"
                      onClick={() => toggleAddon(a.key)}
                      className={`w-full flex items-center gap-3 rounded-xl p-3 border-2 transition-colors text-left ${isSel
                        ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-500/10'
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-primary/30'
                        }`}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-2 transition-colors ${isSel
                        ? 'bg-primary dark:bg-blue-500 border-primary dark:border-blue-500 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                        }`}>
                        <AnimatePresence>
                          {isSel && (
                            <motion.span variants={popIn} initial="hidden" animate="show" exit="exit">
                              <CheckCircle2 size={12} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                      <p className={`flex-1 font-bold text-[12px] leading-tight ${isSel ? 'text-primary dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {a.name}
                      </p>
                      {included ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest px-2 py-1 shrink-0">
                          <CheckCircle2 size={11} /> Incluido
                        </span>
                      ) : (
                        <p className="font-black text-[12px] text-slate-500 dark:text-slate-400 shrink-0">
                          + {fmtGs(a.priceGs)}
                        </p>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resumen de precio total en vivo */}
          <AnimatePresence mode="wait">
            {selectedService && coverage?.covered && chargeable === 0 ? (
              // Todo cubierto (base + adicionales incluidos) → ₲0
              <motion.div
                key="covered-summary"
                variants={scaleIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className="mb-5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-4 py-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Cubierto por tu plan</span>
                  </div>
                  <span className="font-black text-lg tracking-tight text-emerald-600 dark:text-emerald-400">₲ 0</span>
                </div>
                <p className="text-[11px] font-bold text-emerald-600/80 dark:text-emerald-400/80 mt-1.5 ml-6">
                  {coverage.unlimited
                    ? 'Incluido (ilimitado)'
                    : coverage.remaining > 0
                      ? `Te quedan ${coverage.remaining} este mes`
                      : 'Gratis'}
                </p>
              </motion.div>
            ) : selectedService && coverage?.covered && chargeable > 0 ? (
              // Base cubierta por el plan, pero hay adicionales pagos → se cobra el extra
              <motion.div
                key="covered-with-extras"
                variants={scaleIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className="mb-5 rounded-2xl bg-primary/5 dark:bg-blue-500/10 border border-primary/15 dark:border-blue-500/20 px-4 py-3.5"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Lavado cubierto por tu plan</span>
                </div>
                <div className="flex items-center justify-between mt-2.5 ml-6">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Adicionales a pagar</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2.5 border-t border-primary/15 dark:border-blue-500/20">
                  <div className="flex items-center gap-2">
                    <Wallet size={16} className="text-primary dark:text-blue-400" />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total a pagar</span>
                  </div>
                  <AnimatedNumber
                    key={chargeable}
                    value={chargeable}
                    prefix="₲ "
                    currency
                    duration={0.6}
                    className="font-black text-lg tracking-tight text-primary dark:text-blue-400"
                  />
                </div>
              </motion.div>
            ) : selectedService && chargeable > 0 ? (
              // No cubierto → precio completo
              <motion.div
                key="total-summary"
                variants={scaleIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className="mb-5 flex items-center justify-between rounded-2xl bg-primary/5 dark:bg-blue-500/10 border border-primary/15 dark:border-blue-500/20 px-4 py-3.5"
              >
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-primary dark:text-blue-400" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total a pagar</span>
                </div>
                <AnimatedNumber
                  key={chargeable}
                  value={chargeable}
                  prefix="₲ "
                  currency
                  duration={0.6}
                  className="font-black text-lg tracking-tight text-primary dark:text-blue-400"
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Método de pago — solo cuando hay un monto a pagar */}
          <AnimatePresence>
            {selectedService && chargeable > 0 && (
              <motion.div
                key="payment-source"
                variants={scaleIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className="mb-5"
              >
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Método de pago</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Tarjeta */}
                  <motion.button
                    {...useInteraction(tapOnly)}
                    type="button"
                    onClick={() => setPaymentSource('card')}
                    className={`rounded-xl p-3 border-2 transition-colors text-left ${paymentSource === 'card'
                      ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-500/10'
                      : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-primary/30'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`font-bold text-[12px] leading-tight ${paymentSource === 'card' ? 'text-primary dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        Tarjeta
                      </p>
                      <AnimatePresence>
                        {paymentSource === 'card' && (
                          <motion.span variants={popIn} initial="hidden" animate="show" exit="exit" className="shrink-0">
                            <CheckCircle2 size={14} className="text-primary dark:text-blue-400" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-1">
                      Pagar con tu tarjeta
                    </p>
                  </motion.button>

                  {/* Saldo de la billetera */}
                  <motion.button
                    {...useInteraction(tapOnly)}
                    type="button"
                    disabled={!walletEnough}
                    onClick={() => walletEnough && setPaymentSource('wallet')}
                    className={`rounded-xl p-3 border-2 transition-colors text-left ${!walletEnough
                      ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 opacity-60 cursor-not-allowed'
                      : paymentSource === 'wallet'
                        ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-500/10'
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-primary/30'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`font-bold text-[12px] leading-tight flex items-center gap-1.5 ${paymentSource === 'wallet' ? 'text-primary dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        <Wallet size={13} /> Saldo
                      </p>
                      <AnimatePresence>
                        {paymentSource === 'wallet' && (
                          <motion.span variants={popIn} initial="hidden" animate="show" exit="exit" className="shrink-0">
                            <CheckCircle2 size={14} className="text-primary dark:text-blue-400" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    <p className={`text-[11px] font-bold mt-1 ${walletEnough ? 'text-slate-400 dark:text-slate-500' : 'text-red-500 dark:text-red-400'}`}>
                      {walletEnough ? `Saldo: ${fmtGs(walletBalance)}` : 'Saldo insuficiente'}
                    </p>
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Date / Time Picker */}
          <div className="mb-5">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Fecha y Hora</p>
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Calendar size={13} className="text-primary dark:text-blue-400 shrink-0" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha</span>
              </div>
              <div className="flex gap-2">
                <select value={day} onChange={e => setDay(e.target.value)} className={selectClass}>
                  {days.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={month} onChange={e => setMonth(e.target.value)} className={`${selectClass} flex-[2]`}>
                  {MESES.map((m, i) => <option key={i} value={i.toString()}>{m}</option>)}
                </select>
                <select value={year} onChange={e => setYear(e.target.value)} className={selectClass}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={13} className="text-primary dark:text-blue-400 shrink-0" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horario</span>
              </div>
              {slotsLoading ? (
                <p className="text-xs text-slate-400 py-3">Cargando turnos disponibles…</p>
              ) : slots.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 py-3 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  No hay turnos configurados para este día. Probá con otra fecha.
                </div>
              ) : slots.every((s: any) => !s.available) ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 py-3 px-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20">
                  No quedan turnos disponibles este día. Elegí otra fecha.
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                  {slots.map((s: any) => {
                    const isSel = slotTime === s.time;
                    const disabled = !s.available;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSlotTime(s.time)}
                        className={`rounded-xl py-2 text-center border transition-colors ${isSel
                          ? 'border-primary bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-400'
                          : disabled
                            ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 cursor-not-allowed line-through'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 hover:border-primary/40'
                          }`}
                      >
                        <span className="block text-[13px] font-black leading-none">{s.time}</span>
                        <span className={`block text-[8px] font-bold uppercase tracking-wider mt-1 ${disabled
                          ? 'text-slate-300 dark:text-slate-600'
                          : s.remaining <= 1 ? 'text-amber-500' : 'text-emerald-500'
                          }`}>
                          {s.past ? 'Pasó' : disabled ? 'Completo' : s.remaining === 1 ? 'Último' : 'Libre'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <Pressable
            onClick={() => doBooking()}
            disabled={isBooking || payPhase === 'processing' || services.length === 0}
            className="w-full py-3.5 bg-primary dark:bg-blue-500 text-white rounded-xl font-black tracking-widest uppercase text-xs shadow-lg shadow-primary/20 dark:shadow-blue-500/20 hover:shadow-primary/30 transition-shadow disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isBooking || payPhase === 'processing' ? <Loader2 className="animate-spin" size={18} /> : <>Confirmar Reserva <ChevronRight size={16} /></>}
          </Pressable>
        </StaggerItem>

        {/* Booking History */}
        <StaggerItem className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          <div className="flex items-center gap-2 p-5 border-b border-slate-50 dark:border-slate-800">
            <History size={16} className="text-primary dark:text-blue-400" />
            <h3 className="text-sm font-black tracking-tight text-slate-900 dark:text-white">Historial de Reservas</h3>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-[380px] lg:max-h-[480px] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="w-1/2 h-3.5 rounded-md" />
                      <Skeleton className="w-3/4 h-2.5 rounded-md" />
                    </div>
                    <Skeleton className="w-16 h-5 rounded-full shrink-0" />
                  </div>
                ))}
              </div>
            ) : bookings.length === 0 ? (
              <p className="text-slate-400 dark:text-slate-500 text-center text-sm font-medium py-10">Aún no tenés reservas.</p>
            ) : (
              <StaggerList onView>
                {bookings.map((b) => (
                  <StaggerItem key={b.id}>
                    <Pressable
                      asDiv
                      tapOnly
                      onClick={() => setSelectedBooking(b)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left cursor-pointer"
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${b.status === 'COMPLETED'
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : b.status === 'CANCELLED'
                          ? 'bg-red-100 dark:bg-red-500/20 text-red-500'
                          : 'bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-400'}`}>
                        <CheckCircle2 size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-200 truncate">
                          {b.service?.name ?? b.service_type ?? 'Servicio'}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          <Calendar size={10} />
                          <span>{new Date(b.startTime ?? b.booking_date).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          <Clock size={10} />
                          <span>{new Date(b.startTime ?? b.booking_date).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={b.status} />
                        <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
                      </div>
                    </Pressable>
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </div>
        </StaggerItem>
      </StaggerList>

      {/* ── Booking Detail BottomSheet ── */}
      <BottomSheet isOpen={!!selectedBooking} onClose={() => setSelectedBooking(null)}>
        {selectedBooking && (() => {
          const b = selectedBooking;
          const dt = new Date(b.startTime ?? b.booking_date);
          const statusColors: Record<string, string> = {
            COMPLETED: 'from-emerald-500 to-emerald-600',
            CONFIRMED: 'from-blue-500 to-primary',
            CANCELLED: 'from-red-400 to-red-600',
            IN_PROGRESS: 'from-amber-400 to-amber-600',
            PENDING: 'from-slate-400 to-slate-600',
          };
          const grad = statusColors[b.status] ?? 'from-slate-400 to-slate-600';
          return (
            <div className="px-4 pb-8 pt-2">
              <div className={`bg-gradient-to-r ${grad} rounded-2xl p-5 text-white relative overflow-hidden mb-5`}>
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-1">Reserva #{b.id?.slice(-6).toUpperCase()}</p>
                <h2 className="font-black text-xl leading-tight tracking-tight">{b.service?.name ?? b.service_type ?? 'Servicio'}</h2>
                {b.service?.description && <p className="text-white/60 text-xs mt-1">{b.service.description}</p>}
                <motion.div
                  variants={popIn}
                  initial="hidden"
                  animate="show"
                  transition={springPop}
                  className="mt-3 inline-flex bg-white/15 rounded-full px-3 py-1"
                >
                  <StatusBadge status={b.status} light />
                </motion.div>
              </div>
              <StaggerList className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3 mb-5">
                <StaggerItem><DetailRow icon={<Calendar size={15} />} label="Fecha" value={dt.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} /></StaggerItem>
                <StaggerItem><DetailRow icon={<Clock size={15} />} label="Hora" value={dt.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })} /></StaggerItem>
                {b.service?.durationMinutes && <StaggerItem><DetailRow icon={<Timer size={15} />} label="Duración estimada" value={`${b.service.durationMinutes} minutos`} /></StaggerItem>}
                {b.vehicle && <StaggerItem><DetailRow icon={<span className="text-base">🚗</span>} label="Vehículo" value={`${b.vehicle.brand ?? ''} ${b.vehicle.model ?? ''} ${b.vehicle.licensePlate ? `· ${b.vehicle.licensePlate}` : ''}`} /></StaggerItem>}
                {b.user && <StaggerItem><DetailRow icon={<span className="text-base">👤</span>} label="Cliente" value={`${b.user.firstName ?? ''} ${b.user.lastName ?? ''}`.trim() || b.user.phone} /></StaggerItem>}
                {b.notes && <StaggerItem><DetailRow icon={<span className="text-base">📝</span>} label="Notas" value={b.notes} /></StaggerItem>}
                {b.serviceRecord?.completedAt && <StaggerItem><DetailRow icon={<CheckCircle2 size={15} />} label="Completado a las" value={new Date(b.serviceRecord.completedAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })} /></StaggerItem>}
              </StaggerList>
              <Pressable
                onClick={() => setSelectedBooking(null)}
                className="w-full py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest text-xs transition-colors"
              >
                Cerrar
              </Pressable>
            </div>
          );
        })()}
      </BottomSheet>

      {/* ── Premium Modal ── */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-5">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModal(null)}
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="relative z-10 w-full max-w-sm"
            >
              <div className={`relative rounded-[2.5rem] p-8 text-center overflow-hidden shadow-2xl border ${modal.type === 'success' ? 'bg-white dark:bg-slate-900 border-emerald-500/30' : 'bg-white dark:bg-slate-900 border-red-500/30'}`}>
                <div className={`absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-30 ${modal.type === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <Pressable onClick={() => setModal(null)} tapOnly className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <X size={18} />
                </Pressable>
                <motion.div
                  variants={popIn}
                  initial="hidden"
                  animate="show"
                  transition={springPop}
                  className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 relative z-10 ${modal.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-500/20 shadow-xl shadow-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20 shadow-xl shadow-red-500/20'}`}
                >
                  {modal.type === 'success'
                    ? <CheckCircle2 size={40} className="text-emerald-600 dark:text-emerald-400" />
                    : <AlertCircle size={40} className="text-red-500 dark:text-red-400" />}
                </motion.div>
                <h2 className="font-black text-xl tracking-tight mb-2 relative z-10 text-slate-900 dark:text-white">
                  {modal.title}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-7 relative z-10 px-2">
                  {modal.message}
                </p>
                <Pressable
                  onClick={() => setModal(null)}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white transition-colors shadow-lg relative z-10 ${modal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-primary dark:bg-blue-500 shadow-primary/20'}`}
                >
                  {modal.type === 'success' ? '¡Perfecto!' : 'Entendido'}
                </Pressable>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal de elección: cupo del plan agotado ── */}
      <AnimatePresence>
        {needsChoice && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-5">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setNeedsChoice(false)}
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] p-7 text-center shadow-2xl"
            >
              <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-amber-500 dark:text-amber-400" />
              </div>
              <h2 className="font-black text-lg tracking-tight mb-1.5 text-slate-900 dark:text-white">
                Usaste todos tus lavados
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6 px-2">
                Ya no te quedan lavados de tu plan este mes. ¿Cómo querés continuar con esta reserva?
              </p>
              <div className="space-y-2.5">
                <Pressable
                  onClick={() => doBooking('pay')}
                  className="w-full py-3.5 rounded-2xl bg-primary dark:bg-blue-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
                >
                  Pagar {formatGs(choicePrice)} ahora
                </Pressable>
                <Pressable
                  onClick={() => doBooking('overage')}
                  className="w-full py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black uppercase tracking-widest text-xs"
                >
                  Cargar al próximo mes
                </Pressable>
                <button
                  onClick={() => setNeedsChoice(false)}
                  className="w-full py-2.5 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[11px]"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Overlay de resultado de pago/reserva ── */}
      <PaymentResultOverlay
        phase={payPhase}
        message={payMsg}
        successText="¡Reserva confirmada!"
        onClose={handlePayClose}
        onRetry={payPhase === 'error' ? () => doBooking() : undefined}
      />

      {/* Iframe 3DS de Bancard (se muestra solo si el cobro del turno lo requiere) */}
      {bancard3dsModal}
    </>
  );
}
