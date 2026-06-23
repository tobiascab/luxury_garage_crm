import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Calendar, Clock, User, Car, ChevronLeft, ChevronRight, Plus,
  CheckCircle2, Timer, XCircle, Search, CalendarDays, RefreshCcw,
  Play, Pencil, Phone, UserCog, CalendarClock,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, addMonths, parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatGs } from '../../constants/pricing';
import AnimatedNumber from '../../components/AnimatedNumber';
import FormModal from '../../components/FormModal';
import FormField from '../../components/FormField';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';
import { SkeletonTable, SkeletonStats } from '../../components/Skeleton';

// ── Configuración sobria por estado ──────────────────────────────────────────
const STATUS = {
  PENDING:     { label: 'Pendiente',  dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' },
  CONFIRMED:   { label: 'Confirmado', dot: 'bg-sky-500',     chip: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20' },
  IN_PROGRESS: { label: 'En proceso', dot: 'bg-indigo-500',  chip: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20' },
  COMPLETED:   { label: 'Completado', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' },
  CANCELLED:   { label: 'Cancelado',  dot: 'bg-rose-500',    chip: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' },
  NO_SHOW:     { label: 'No asistió', dot: 'bg-slate-400',   chip: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10' },
};
const STATUS_OPTIONS = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

const todayISO = () => new Date().toISOString().split('T')[0];
const timeFmt = (d) => new Date(d).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

function StatusChip({ status }) {
  const c = STATUS[status] || STATUS.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${status === 'IN_PROGRESS' ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  );
}

export default function AppointmentsCalendar() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapIcon = reduceMotion ? undefined : { scale: 0.9 };

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Catálogos para formularios
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);

  // Modales
  const [editTarget, setEditTarget] = useState(null); // null = cerrado · {} = crear · obj = editar
  const [cancelTarget, setCancelTarget] = useState(null);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/appointments?date=${selectedDate}`, { _noCache: true });
      setAppointments(res.data.data || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error cargando la agenda');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  // Catálogos (una vez)
  useEffect(() => {
    api.get('/members?role=EMPLOYEE&limit=100')
      .then((r) => setEmployees(r.data.data || []))
      .catch(() => {});
    api.get('/services')
      .then((r) => setServices((r.data.data || []).filter((s) => !s.isAddon)))
      .catch(() => {});
  }, []);

  // ── Acciones rápidas ───────────────────────────────────────────────────────
  const runAction = async (id, fn, okMsg) => {
    setActionLoading(id);
    try {
      await fn();
      toast.success(okMsg);
      await loadAppointments();
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudo completar la acción');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = (id) => runAction(id, () => api.put(`/appointments/${id}/start`), 'Servicio iniciado');
  const handleComplete = (id) => runAction(id, () => api.put(`/appointments/${id}/complete`), 'Servicio completado');

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    setActionLoading(id);
    try {
      await api.delete(`/appointments/${id}`);
      toast.success('Turno cancelado');
      setCancelTarget(null);
      await loadAppointments();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al cancelar');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Filtro + orden ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments
      .filter((a) => {
        if (!q) return true;
        return (
          a.service?.name?.toLowerCase().includes(q) ||
          a.user?.firstName?.toLowerCase().includes(q) ||
          a.user?.lastName?.toLowerCase().includes(q) ||
          a.vehicle?.brand?.toLowerCase().includes(q) ||
          a.vehicle?.model?.toLowerCase().includes(q) ||
          a.vehicle?.licensePlate?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }, [appointments, search]);

  const stats = useMemo(() => ({
    total: appointments.length,
    pending: appointments.filter((a) => ['PENDING', 'CONFIRMED'].includes(a.status)).length,
    inProgress: appointments.filter((a) => a.status === 'IN_PROGRESS').length,
    completed: appointments.filter((a) => a.status === 'COMPLETED').length,
  }), [appointments]);

  const statCards = [
    { label: 'Total del día', value: stats.total, icon: CalendarDays, color: 'text-slate-500 bg-slate-100 dark:bg-white/5' },
    { label: 'Por atender',   value: stats.pending, icon: Timer, color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
    { label: 'En proceso',    value: stats.inProgress, icon: Clock, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10' },
    { label: 'Completados',   value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
  ];

  const empName = (id) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : null;
  };

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agenda de turnos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestioná las reservas: crear, reprogramar, asignar empleados y registrar el avance.
          </p>
        </div>
        <motion.button
          whileTap={tap}
          onClick={() => setEditTarget({})}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/20 self-start"
        >
          <Plus size={16} /> Nuevo turno
        </motion.button>
      </div>

      {/* Stats */}
      {loading ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
                  <Icon size={18} />
                </span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-3 tabular-nums"><AnimatedNumber value={s.value} format="int" /></p>
                <p className="text-xs font-medium text-slate-400 mt-0.5">{s.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Control bar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
        <DateNavigator value={selectedDate} onChange={setSelectedDate} />

        <motion.button
          whileTap={tapIcon}
          onClick={loadAppointments}
          className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors shadow-sm"
          aria-label="Recargar"
        >
          <RefreshCcw size={16} />
        </motion.button>

        <div className="relative flex-1 lg:max-w-sm lg:ml-auto">
          <Search
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`}
            size={16}
          />
          <input
            type="text"
            placeholder="Buscar por cliente, vehículo o servicio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={`w-full h-10 pl-10 pr-4 rounded-xl bg-white dark:bg-slate-900 border text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 shadow-sm ${
              searchFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          />
        </div>
      </div>

      {/* Lista de turnos */}
      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl py-4">
          <EmptyState
            icon="📅"
            title={search ? 'Sin resultados' : 'No hay turnos para esta fecha'}
            message={search ? 'Probá con otro término de búsqueda.' : 'Creá un turno o seleccioná otra fecha.'}
            action={search ? undefined : 'Nuevo turno'}
            onAction={search ? undefined : () => setEditTarget({})}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
          {/* Header tabla (desktop) */}
          <div className="hidden md:grid grid-cols-[90px_1.4fr_1.4fr_1.2fr_130px_180px] gap-4 px-5 py-3.5 bg-slate-50/60 dark:bg-white/[0.02] text-xs font-medium text-slate-400 uppercase tracking-wide">
            <span>Hora</span>
            <span>Cliente</span>
            <span>Servicio</span>
            <span>Empleado</span>
            <span>Estado</span>
            <span className="text-right">Acciones</span>
          </div>

          {filtered.map((a) => {
              const busy = actionLoading === a.id;
              const canStart = ['PENDING', 'CONFIRMED'].includes(a.status);
              const canComplete = a.status === 'IN_PROGRESS';
              const canCancel = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(a.status);
              const empLabel = a.serviceRecord?.employee
                ? `${a.serviceRecord.employee.firstName} ${a.serviceRecord.employee.lastName}`
                : empName(a.employeeId);

              return (
                <div
                  key={a.id}
                  className="grid grid-cols-1 md:grid-cols-[90px_1.4fr_1.4fr_1.2fr_130px_180px] gap-2 md:gap-4 px-5 py-4 border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors items-center"
                >
                  {/* Hora */}
                  <div className="flex items-center gap-2 md:block">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{timeFmt(a.startTime)}</span>
                    {a.totalPriceGs ? (
                      <span className="block text-xs text-slate-400 tabular-nums">{formatGs(a.totalPriceGs)}</span>
                    ) : a.coveredByMembership ? (
                      <span className="block text-xs text-emerald-600 dark:text-emerald-400">Plan</span>
                    ) : null}
                  </div>

                  {/* Cliente */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                      {(a.user?.firstName?.[0] || '?')}{(a.user?.lastName?.[0] || '')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{a.user?.firstName} {a.user?.lastName}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Car size={11} className="shrink-0" />
                        <span className="truncate">{a.vehicle?.brand} {a.vehicle?.model}{a.vehicle?.licensePlate ? ` · ${a.vehicle.licensePlate}` : ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Servicio */}
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{a.service?.name || '—'}</p>
                    {a.vehicleSize && <p className="text-xs text-slate-400 capitalize">{a.vehicleSize}</p>}
                  </div>

                  {/* Empleado */}
                  <div className="min-w-0">
                    {empLabel ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                        <UserCog size={13} className="text-slate-400 shrink-0" /> <span className="truncate">{empLabel}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Sin asignar</span>
                    )}
                  </div>

                  {/* Estado */}
                  <div><StatusChip status={a.status} /></div>

                  {/* Acciones */}
                  <div className="flex items-center justify-start md:justify-end gap-1.5">
                    {canStart && (
                      <motion.button whileTap={busy ? undefined : tapIcon} onClick={() => handleStart(a.id)} disabled={busy} title="Iniciar servicio"
                        className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50">
                        <Play size={15} />
                      </motion.button>
                    )}
                    {canComplete && (
                      <motion.button whileTap={busy ? undefined : tapIcon} onClick={() => handleComplete(a.id)} disabled={busy} title="Completar"
                        className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50">
                        <CheckCircle2 size={15} />
                      </motion.button>
                    )}
                    {a.user?.phone && (
                      <motion.a whileTap={tapIcon} href={`https://wa.me/${a.user.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                        className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-colors">
                        <Phone size={15} />
                      </motion.a>
                    )}
                    <motion.button whileTap={busy ? undefined : tapIcon} onClick={() => setEditTarget(a)} disabled={busy} title="Editar / reprogramar"
                      className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50">
                      <Pencil size={15} />
                    </motion.button>
                    {canCancel && (
                      <motion.button whileTap={busy ? undefined : tapIcon} onClick={() => setCancelTarget(a)} disabled={busy} title="Cancelar turno"
                        className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50">
                        <XCircle size={15} />
                      </motion.button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Modal crear / editar */}
      {editTarget !== null && (
        <AppointmentFormModal
          appointment={editTarget.id ? editTarget : null}
          defaultDate={selectedDate}
          employees={employees}
          services={services}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); loadAppointments(); }}
        />
      )}

      {/* Confirmación de cancelación */}
      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
        loading={actionLoading === cancelTarget?.id}
        variant="danger"
        title="Cancelar turno"
        confirmLabel="Cancelar turno"
        cancelLabel="Volver"
        message={cancelTarget ? `¿Cancelar el turno de ${cancelTarget.user?.firstName || ''} ${cancelTarget.user?.lastName || ''} a las ${timeFmt(cancelTarget.startTime)}? El cliente será notificado y se liberará el horario.` : ''}
      />
    </div>
  );
}

// ── Modal de crear/editar turno ──────────────────────────────────────────────
function AppointmentFormModal({ appointment, defaultDate, employees, services, onClose, onSaved }) {
  const reduceMotion = useReducedMotion();
  const isEdit = !!appointment;
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Cliente / vehículo (solo al crear)
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientVehicles, setClientVehicles] = useState([]);

  const initialTime = () => {
    const d = appointment?.startTime ? new Date(appointment.startTime) : null;
    const pad = (n) => String(n).padStart(2, '0');
    if (d) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${defaultDate}T09:00`;
  };

  const [form, setForm] = useState({
    serviceId: appointment?.serviceId || (services[0]?.id || ''),
    vehicleId: appointment?.vehicleId || '',
    startTime: initialTime(),
    status: appointment?.status || 'CONFIRMED',
    employeeId: appointment?.employeeId || '',
    notes: appointment?.notes || '',
  });

  // Búsqueda de clientes (debounced) — solo al crear
  useEffect(() => {
    if (isEdit) return;
    const q = clientSearch.trim();
    if (q.length < 2 || selectedClient) { setClientResults([]); return; }
    const t = setTimeout(async () => {
      setSearchingClients(true);
      try {
        const r = await api.get(`/members?role=CLIENT&search=${encodeURIComponent(q)}&limit=8`, { _noCache: true });
        setClientResults(r.data.data || []);
      } catch { setClientResults([]); }
      finally { setSearchingClients(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [clientSearch, isEdit, selectedClient]);

  const pickClient = (c) => {
    setSelectedClient(c);
    setClientResults([]);
    setClientSearch(`${c.firstName} ${c.lastName}`);
    const vehicles = c.vehicles || [];
    setClientVehicles(vehicles);
    setForm((f) => ({ ...f, vehicleId: vehicles[0]?.id || '' }));
  };

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!isEdit && !selectedClient) e.client = 'Seleccioná un cliente';
    if (!form.serviceId) e.serviceId = 'Elegí un servicio';
    if (!form.vehicleId) e.vehicleId = 'Elegí un vehículo';
    if (!form.startTime) e.startTime = 'Indicá fecha y hora';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    // datetime-local da "2026-06-08T09:00"; el backend asume hora local PY (UTC-4)
    const startTime = `${form.startTime}:00`;
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/appointments/${appointment.id}`, {
          serviceId: form.serviceId,
          vehicleId: form.vehicleId,
          startTime,
          status: form.status,
          employeeId: form.employeeId || null,
          notes: form.notes,
        });
        toast.success('Turno actualizado');
      } else {
        await api.post('/appointments/admin', {
          userId: selectedClient.id,
          vehicleId: form.vehicleId,
          serviceId: form.serviceId,
          startTime,
          status: form.status,
          employeeId: form.employeeId || null,
          notes: form.notes,
        });
        toast.success('Turno creado');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar el turno');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      isOpen
      onClose={onClose}
      title={isEdit ? 'Editar turno' : 'Nuevo turno'}
      subtitle={isEdit ? `${appointment.user?.firstName || ''} ${appointment.user?.lastName || ''}` : 'Cargá un turno manual para un cliente'}
      icon={<CalendarClock size={18} />}
      formId="appointment-form"
      submitting={submitting}
      submitLabel={isEdit ? 'Guardar cambios' : 'Crear turno'}
      size="md"
    >
      <form id="appointment-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Cliente */}
        {isEdit ? (
          <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-4 py-3 flex items-center gap-3">
            <User size={16} className="text-slate-400" />
            <div className="text-sm">
              <p className="font-medium text-slate-900 dark:text-white">{appointment.user?.firstName} {appointment.user?.lastName}</p>
              {appointment.user?.phone && <p className="text-xs text-slate-400">{appointment.user.phone}</p>}
            </div>
          </div>
        ) : (
          <div className="relative">
            <FormField
              label="Cliente"
              name="clientSearch"
              required
              placeholder="Buscar por nombre, email o teléfono..."
              value={clientSearch}
              onChange={(e) => { setClientSearch(e.target.value); setSelectedClient(null); }}
              error={errors.client}
              hint={selectedClient ? `Seleccionado: ${selectedClient.email}` : 'Escribí al menos 2 caracteres'}
            />
            {!selectedClient && clientSearch.trim().length >= 2 && (clientResults.length > 0 || searchingClients) && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                {searchingClients && <p className="px-4 py-3 text-xs text-slate-400">Buscando...</p>}
                {clientResults.map((c) => (
                  <motion.button whileTap={reduceMotion ? undefined : { scale: 0.98 }} key={c.id} type="button" onClick={() => pickClient(c)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-slate-400">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                  </motion.button>
                ))}
                {!searchingClients && clientResults.length === 0 && (
                  <p className="px-4 py-3 text-xs text-slate-400">Sin resultados</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Vehículo */}
        {isEdit ? (
          <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-4 py-3 flex items-center gap-3">
            <Car size={16} className="text-slate-400" />
            <span className="text-sm text-slate-700 dark:text-slate-200">
              {appointment.vehicle?.brand} {appointment.vehicle?.model}{appointment.vehicle?.licensePlate ? ` · ${appointment.vehicle.licensePlate}` : ''}
            </span>
          </div>
        ) : (
          <FormField as="select" label="Vehículo" name="vehicleId" required
            value={form.vehicleId} onChange={(e) => setField('vehicleId', e.target.value)}
            error={errors.vehicleId}
            disabled={!selectedClient}
            hint={!selectedClient ? 'Seleccioná un cliente primero' : (clientVehicles.length === 0 ? 'Este cliente no tiene vehículos cargados' : undefined)}
          >
            <option value="">Seleccionar vehículo</option>
            {clientVehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.brand} {v.model}{v.licensePlate ? ` · ${v.licensePlate}` : ''}</option>
            ))}
          </FormField>
        )}

        {/* Servicio */}
        <FormField as="select" label="Servicio" name="serviceId" required
          value={form.serviceId} onChange={(e) => setField('serviceId', e.target.value)} error={errors.serviceId}>
          <option value="">Seleccionar servicio</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.durationMinutes ? ` (${s.durationMinutes} min)` : ''}</option>
          ))}
        </FormField>

        {/* Fecha y hora */}
        <FormField label="Fecha y hora" name="startTime" type="datetime-local" required
          value={form.startTime} onChange={(e) => setField('startTime', e.target.value)} error={errors.startTime} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Empleado */}
          <FormField as="select" label="Empleado" name="employeeId"
            value={form.employeeId} onChange={(e) => setField('employeeId', e.target.value)}
            hint="Opcional">
            <option value="">Sin asignar</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
            ))}
          </FormField>

          {/* Estado */}
          <FormField as="select" label="Estado" name="status"
            value={form.status} onChange={(e) => setField('status', e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS[s].label}</option>
            ))}
          </FormField>
        </div>

        {/* Notas */}
        <FormField as="textarea" label="Notas" name="notes" rows={2}
          placeholder="Observaciones internas..."
          value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
      </form>
    </FormModal>
  );
}

// ── Selector de fecha: navegación rápida + popover de calendario compacto ──────
function DateNavigator({ value, onChange }) {
  const reduceMotion = useReducedMotion();
  const tapIcon = reduceMotion ? undefined : { scale: 0.9 };
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = parseISO(value);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseISO(value)));

  useEffect(() => { setViewMonth(startOfMonth(parseISO(value))); }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const shift = (days) => {
    const d = parseISO(value);
    d.setDate(d.getDate() + days);
    onChange(format(d, 'yyyy-MM-dd'));
  };
  const pick = (d) => { onChange(format(d, 'yyyy-MM-dd')); setOpen(false); };

  const today = new Date();
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 }),
  });
  const triggerLabel = format(selected, "EEE d 'de' MMM, yyyy", { locale: es });

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden">
        <motion.button whileTap={tapIcon} onClick={() => shift(-1)} aria-label="Día anterior"
          className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
          <ChevronLeft size={18} />
        </motion.button>
        <motion.button whileTap={reduceMotion ? undefined : { scale: 0.97 }} onClick={() => setOpen((o) => !o)}
          className="px-4 py-2 min-w-[210px] flex items-center justify-center gap-2.5 text-sm font-medium capitalize text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-x border-slate-100 dark:border-white/5">
          <Calendar size={16} className="text-indigo-600 shrink-0" />
          <span className="truncate">{triggerLabel}</span>
        </motion.button>
        <motion.button whileTap={tapIcon} onClick={() => shift(1)} aria-label="Día siguiente"
          className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
          <ChevronRight size={18} />
        </motion.button>
      </div>

      {open && (
          <div
            className="absolute z-30 mt-2 left-0 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl p-3"
          >
            {/* Mes */}
            <div className="flex items-center justify-between mb-2">
              <motion.button whileTap={tapIcon} onClick={() => setViewMonth(addMonths(viewMonth, -1))} aria-label="Mes anterior"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                <ChevronLeft size={16} />
              </motion.button>
              <span className="text-sm font-semibold capitalize text-slate-900 dark:text-white">
                {format(viewMonth, 'MMMM yyyy', { locale: es })}
              </span>
              <motion.button whileTap={tapIcon} onClick={() => setViewMonth(addMonths(viewMonth, 1))} aria-label="Mes siguiente"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                <ChevronRight size={16} />
              </motion.button>
            </div>

            {/* Días de la semana */}
            <div className="grid grid-cols-7 mb-1">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <span key={i} className="h-7 flex items-center justify-center text-[10px] font-semibold uppercase text-slate-400">{d}</span>
              ))}
            </div>

            {/* Grilla */}
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((d) => {
                const sel = isSameDay(d, selected);
                const out = !isSameMonth(d, viewMonth);
                const isToday = isSameDay(d, today);
                return (
                  <motion.button
                    whileTap={tapIcon}
                    key={d.toISOString()}
                    onClick={() => pick(d)}
                    className={`h-9 rounded-lg text-sm font-medium tabular-nums transition-colors
                      ${sel
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30'
                        : isToday
                          ? 'text-indigo-600 dark:text-indigo-400 font-semibold ring-1 ring-inset ring-indigo-500/40'
                          : out
                            ? 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-white/5'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                  >
                    {d.getDate()}
                  </motion.button>
                );
              })}
            </div>

            <motion.button
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              onClick={() => pick(today)}
              className="mt-2 w-full h-9 rounded-lg text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
            >
              Hoy
            </motion.button>
          </div>
        )}
    </div>
  );
}
