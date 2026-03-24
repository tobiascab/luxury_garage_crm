import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, CheckCircle2, Sparkles, History, ChevronRight,
  ChevronLeft, Loader2, X, AlertCircle, Timer, Tag
} from 'lucide-react';
import api from '../../services/api';
import BottomSheet from '../components/BottomSheet';

interface BookingProps {
  user: any;
  onBookingComplete: () => void;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const HORAS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTOS = ['00', '15', '30', '45'];

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
            transition={{ duration: 0.2 }}
            className="relative bg-primary dark:bg-blue-600 rounded-2xl p-5 text-white overflow-hidden shadow-xl shadow-primary/25"
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-black/10 rounded-full blur-2xl" />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest mb-2">
                  <Sparkles size={9} fill="currentColor" /> Seleccionado
                </div>
                <h3 className="font-black text-lg leading-tight tracking-tight">{selected.name}</h3>
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
        <button
          onClick={() => scroll('prev')}
          disabled={selectedIdx === 0}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center shadow-md disabled:opacity-30 transition-all hover:scale-110 active:scale-95"
        >
          <ChevronLeft size={14} className="text-slate-700 dark:text-slate-300" />
        </button>

        {/* Cards row */}
        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scroll-smooth no-scrollbar px-10"
        >
          {services.map((s, i) => {
            const isSelected = s.id === selectedId;
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`flex-shrink-0 w-32 rounded-xl p-3 border-2 transition-all active:scale-95 text-left ${isSelected
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
              </button>
            );
          })}
        </div>

        {/* Next */}
        <button
          onClick={() => scroll('next')}
          disabled={selectedIdx === services.length - 1}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center shadow-md disabled:opacity-30 transition-all hover:scale-110 active:scale-95"
        >
          <ChevronRight size={14} className="text-slate-700 dark:text-slate-300" />
        </button>
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
  const [services, setServices] = useState<any[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const now = new Date();
  const [day, setDay] = useState(now.getDate().toString());
  const [month, setMonth] = useState(now.getMonth().toString());
  const [year, setYear] = useState(now.getFullYear().toString());
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');

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

  useEffect(() => { fetchBookings(); }, [user.id]);

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
    return `${year}-${m}-${d}T${hour}:${minute}:00`;
  };

  const handleBooking = async () => {
    if (!selectedServiceId) {
      setModal({ type: 'error', title: 'Servicio requerido', message: 'Por favor seleccioná un tipo de servicio para continuar.' });
      return;
    }
    const vehicleId = user.vehicles?.[0]?.id;
    if (!vehicleId) {
      setModal({ type: 'error', title: 'Sin vehículo', message: 'No encontramos un vehículo asociado a tu cuenta. Agregá uno desde tu perfil.' });
      return;
    }
    setIsBooking(true);
    const startTime = buildStartTime();
    const dateOnly = startTime.split('T')[0];
    try {
      await api.post('/appointments', { vehicleId, serviceId: selectedServiceId, date: dateOnly, startTime });
      await fetchBookings();
      onBookingComplete();
      const sel = services.find(s => s.id === selectedServiceId);
      setModal({
        type: 'success',
        title: '¡Reserva Confirmada! 🎉',
        message: `Tu ${sel?.name ?? 'servicio'} fue agendado para el ${day} de ${MESES[parseInt(month)]} de ${year} a las ${hour}:${minute}hs. ¡Te esperamos!`,
      });
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Ocurrió un error al procesar tu reserva. Intentá nuevamente.';
      setModal({ type: 'error', title: 'Error al reservar', message: msg });
    } finally {
      setIsBooking(false);
    }
  };

  const maxDay = getDaysInMonth(parseInt(month), parseInt(year));
  const days = Array.from({ length: maxDay }, (_, i) => (i + 1).toString());
  const years = Array.from({ length: 3 }, (_, i) => (now.getFullYear() + i).toString());
  const selectClass = "flex-1 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm rounded-xl px-3 py-3 border-none outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none text-center";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-4 pb-24"
      >
        {/* New Booking Form */}
        <div className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-primary/10 dark:bg-blue-500/20 rounded-xl flex items-center justify-center text-primary dark:text-blue-400">
              <Sparkles size={18} />
            </div>
            <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white">Nueva Reserva</h2>
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
              <div className="flex items-center gap-2 mb-1.5">
                <Clock size={13} className="text-primary dark:text-blue-400 shrink-0" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hora</span>
              </div>
              <div className="flex gap-2 items-center">
                <select value={hour} onChange={e => setHour(e.target.value)} className={selectClass}>
                  {HORAS.map(h => <option key={h} value={h}>{h}hs</option>)}
                </select>
                <span className="font-black text-slate-400 dark:text-slate-500 text-lg">:</span>
                <select value={minute} onChange={e => setMinute(e.target.value)} className={selectClass}>
                  {MINUTOS.map(m => <option key={m} value={m}>{m}min</option>)}
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={handleBooking}
            disabled={isBooking || services.length === 0}
            className="w-full py-3.5 bg-primary dark:bg-blue-500 text-white rounded-xl font-black tracking-widest uppercase text-xs shadow-lg shadow-primary/20 dark:shadow-blue-500/20 hover:shadow-primary/30 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isBooking ? <Loader2 className="animate-spin" size={18} /> : <>Confirmar Reserva <ChevronRight size={16} /></>}
          </button>
        </div>

        {/* Booking History */}
        <div className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          <div className="flex items-center gap-2 p-5 border-b border-slate-50 dark:border-slate-800">
            <History size={16} className="text-primary dark:text-blue-400" />
            <h3 className="text-sm font-black tracking-tight text-slate-900 dark:text-white">Historial de Reservas</h3>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-[380px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-primary dark:text-blue-400" size={24} />
              </div>
            ) : bookings.length === 0 ? (
              <p className="text-slate-400 dark:text-slate-500 text-center text-sm font-medium py-10">Aún no tenés reservas.</p>
            ) : (
              bookings.map((b) => (
                <motion.button
                  key={b.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setSelectedBooking(b)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors active:scale-[0.98] text-left"
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
                </motion.button>
              ))
            )}
          </div>
        </div>
      </motion.div>

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
                <div className="mt-3 inline-flex bg-white/15 rounded-full px-3 py-1">
                  <StatusBadge status={b.status} light />
                </div>
              </div>
              <div className="space-y-3 mb-5">
                <DetailRow icon={<Calendar size={15} />} label="Fecha" value={dt.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
                <DetailRow icon={<Clock size={15} />} label="Hora" value={dt.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })} />
                {b.service?.durationMinutes && <DetailRow icon={<Timer size={15} />} label="Duración estimada" value={`${b.service.durationMinutes} minutos`} />}
                {b.vehicle && <DetailRow icon={<span className="text-base">🚗</span>} label="Vehículo" value={`${b.vehicle.brand ?? ''} ${b.vehicle.model ?? ''} ${b.vehicle.licensePlate ? `· ${b.vehicle.licensePlate}` : ''}`} />}
                {b.user && <DetailRow icon={<span className="text-base">👤</span>} label="Cliente" value={`${b.user.firstName ?? ''} ${b.user.lastName ?? ''}`.trim() || b.user.phone} />}
                {b.notes && <DetailRow icon={<span className="text-base">📝</span>} label="Notas" value={b.notes} />}
                {b.serviceRecord?.completedAt && <DetailRow icon={<CheckCircle2 size={15} />} label="Completado a las" value={new Date(b.serviceRecord.completedAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })} />}
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="w-full py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest text-xs transition-all active:scale-95"
              >
                Cerrar
              </button>
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
                <button onClick={() => setModal(null)} className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                  <X size={18} />
                </button>
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
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
                <button
                  onClick={() => setModal(null)}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white transition-all active:scale-95 shadow-lg relative z-10 ${modal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-primary dark:bg-blue-500 shadow-primary/20'}`}
                >
                  {modal.type === 'success' ? '¡Perfecto!' : 'Entendido'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
