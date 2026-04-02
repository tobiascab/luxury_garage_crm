import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, User, Car,
  ChevronLeft, ChevronRight, Plus,
  CheckCircle2, AlertCircle,
  Timer, XCircle, Search, CalendarDays,
  Loader2, Zap, RefreshCcw,
  Play, Square, Trash2,
  UserCheck, History, Phone
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function AppointmentsCalendar() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [view, setView] = useState('day');
  const [search, setSearch] = useState('');
  const [actionMenuId, setActionMenuId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => { loadAppointments(); }, [selectedDate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setActionMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const start = new Date(selectedDate); start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate); end.setHours(23, 59, 59, 999);
      const res = await api.get(`/appointments?startDate=${start.toISOString()}&endDate=${end.toISOString()}`);
      setAppointments(res.data.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Error cargando la agenda');
    }
    setLoading(false);
  };

  // ── ACTIONS ────────────────────────────────────────────
  const handleCancel = async (id) => {
    if (!window.confirm('¿Confirmar cancelación del turno? El cliente será notificado.')) return;
    setActionLoading(id);
    try {
      await api.delete(`/appointments/${id}`);
      toast.success('Turno cancelado correctamente');
      loadAppointments();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al cancelar');
    }
    setActionLoading(null);
    setActionMenuId(null);
  };

  const handleStart = async (id) => {
    setActionLoading(id);
    try {
      await api.put(`/appointments/${id}/start`);
      toast.success('Servicio iniciado — el cliente fue notificado');
      loadAppointments();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al iniciar servicio');
    }
    setActionLoading(null);
    setActionMenuId(null);
  };

  const handleComplete = async (id) => {
    setActionLoading(id);
    try {
      await api.put(`/appointments/${id}/complete`);
      toast.success('Servicio completado ✅');
      loadAppointments();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al completar');
    }
    setActionLoading(null);
    setActionMenuId(null);
  };

  const hours = Array.from({ length: 14 }, (_, i) => i + 7);

  const filteredAppointments = appointments.filter(a => {
    const searchLower = search.toLowerCase();
    return (
      a.service?.name?.toLowerCase().includes(searchLower) ||
      a.user?.firstName?.toLowerCase().includes(searchLower) ||
      a.user?.lastName?.toLowerCase().includes(searchLower) ||
      a.vehicle?.brand?.toLowerCase().includes(searchLower) ||
      a.vehicle?.model?.toLowerCase().includes(searchLower) ||
      a.status?.toLowerCase().includes(searchLower)
    );
  }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const statusConfig = {
    PENDING: { color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20', icon: <Timer size={14} />, label: 'Pendiente', badge: 'bg-amber-500' },
    CONFIRMED: { color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20', icon: <CheckCircle2 size={14} />, label: 'Confirmado', badge: 'bg-blue-500' },
    IN_PROGRESS: { color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/20', icon: <Clock size={14} />, label: 'En Proceso', badge: 'bg-cyan-500' },
    COMPLETED: { color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: <CheckCircle2 size={14} />, label: 'Completado', badge: 'bg-emerald-500' },
    CANCELLED: { color: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20', icon: <XCircle size={14} />, label: 'Cancelado', badge: 'bg-rose-500' },
    NO_SHOW: { color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20', icon: <AlertCircle size={14} />, label: 'No se presentó', badge: 'bg-rose-600' }
  };

  const changeDate = (offset) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const formattedDate = new Date(selectedDate).toLocaleDateString('es-PY', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Stats
  const stats = {
    total: filteredAppointments.length,
    pending: filteredAppointments.filter(a => a.status === 'PENDING' || a.status === 'CONFIRMED').length,
    inProgress: filteredAppointments.filter(a => a.status === 'IN_PROGRESS').length,
    completed: filteredAppointments.filter(a => a.status === 'COMPLETED').length,
    cancelled: filteredAppointments.filter(a => a.status === 'CANCELLED').length,
  };

  // ── Action menu for a single appointment ──
  const ActionMenu = ({ appointment }) => {
    const config = statusConfig[appointment.status] || statusConfig.PENDING;
    const canStart = ['PENDING', 'CONFIRMED'].includes(appointment.status);
    const canComplete = appointment.status === 'IN_PROGRESS';
    const canCancel = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(appointment.status);
    const isLoading = actionLoading === appointment.id;

    return (
      <div ref={menuRef} className="absolute right-2 top-12 z-50 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden py-2" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Acciones del turno</p>
        </div>
        {canStart && (
          <button onClick={() => handleStart(appointment.id)} disabled={isLoading}
            className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-500/10 flex items-center gap-3 transition-colors disabled:opacity-50">
            <Play size={16} className="text-blue-500" /> Iniciar Servicio
          </button>
        )}
        {canComplete && (
          <button onClick={() => handleComplete(appointment.id)} disabled={isLoading}
            className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 flex items-center gap-3 transition-colors disabled:opacity-50">
            <CheckCircle2 size={16} className="text-emerald-500" /> Completar Servicio
          </button>
        )}
        {appointment.user?.phone && (
          <a href={`https://wa.me/${appointment.user.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
            className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 flex items-center gap-3 transition-colors">
            <Phone size={16} className="text-emerald-500" /> WhatsApp al cliente
          </a>
        )}
        {canCancel && (
          <>
            <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
            <button onClick={() => handleCancel(appointment.id)} disabled={isLoading}
              className="w-full px-4 py-3 text-left text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-3 transition-colors disabled:opacity-50">
              <Trash2 size={16} /> Cancelar Turno
            </button>
          </>
        )}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 flex items-center justify-center rounded-2xl">
            <Loader2 size={20} className="animate-spin text-primary" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <CalendarDays size={24} />
            </div>
            Agenda de Turnos
          </h1>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            {stats.total} turnos hoy — {stats.pending} pendientes, {stats.inProgress} en proceso, {stats.completed} completados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button
              onClick={() => setView('day')}
              className={`px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'day' ? 'bg-primary text-white shadow-lg' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Timeline
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'list' ? 'bg-primary text-white shadow-lg' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Lista
            </button>
          </div>
        </div>
      </header>

      {/* Control Bar: Date Nav + Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => changeDate(-1)}
              className="w-12 h-12 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border-r border-slate-100 dark:border-slate-700"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="relative group px-6 py-3 min-w-[280px] flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
              <Calendar size={18} className="text-primary" />
              <span className="text-sm font-bold capitalize text-slate-800 dark:text-slate-200">
                {formattedDate}
              </span>
              <input
                type="date"
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>

            <button
              onClick={() => changeDate(1)}
              className="w-12 h-12 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border-l border-slate-100 dark:border-slate-700"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="h-12 px-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary/30 transition-all shadow-sm flex items-center gap-2"
          >
            <History size={14} /> Hoy
          </button>

          <button
            onClick={() => { setLoading(true); loadAppointments(); }}
            className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-primary transition-all shadow-sm"
          >
            <RefreshCcw size={18} />
          </button>
        </div>

        <div className="flex-1 max-w-md lg:ml-auto">
          <div className="admin-search-wrapper">
            <Search className="admin-search-icon" size={18} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Buscar por cliente, vehículo o servicio..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
          <Loader2 size={40} className="text-primary animate-spin" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Cargando agenda...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {view === 'day' ? (
            <div className="admin-card !p-0 overflow-hidden border-slate-200 dark:border-slate-700 shadow-xl">
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {hours.map(h => {
                  const currentHourMatches = filteredAppointments.filter(a => new Date(a.startTime).getHours() === h);
                  return (
                    <div key={h} className="flex min-h-[110px] group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 relative">
                      {/* Hour Bar */}
                      <div className="w-24 flex flex-col items-center justify-start py-4 border-r border-slate-100 dark:border-slate-700/50 shrink-0 bg-slate-50/30 dark:bg-slate-900/30 sticky left-0 z-10 backdrop-blur-md">
                        <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                          {String(h).padStart(2, '0')}:00
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-2">
                          {h < 12 ? 'Mañana' : h < 18 ? 'Tarde' : 'Noche'}
                        </span>
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 p-6 flex gap-6 overflow-x-auto scrollbar-hide relative min-w-0">
                        {currentHourMatches.length === 0 && (
                          <div className="flex items-center px-4 w-full opacity-0 group-hover:opacity-100 transition-all duration-500">
                            <span className="text-sm text-slate-300 dark:text-slate-600">Horario disponible</span>
                          </div>
                        )}

                        <AnimatePresence mode='popLayout'>
                          {currentHourMatches.map((a, i) => {
                            const config = statusConfig[a.status] || statusConfig.PENDING;
                            return (
                              <motion.div
                                key={a.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className={`relative flex-none w-[320px] p-4.5 rounded-2xl border transition-all hover:translate-y-[-2px] hover:shadow-xl group/card cursor-pointer ${config.color}`}
                              >
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                  <div>
                                    <div className="flex items-center gap-2 text-[10px] font-semibold mb-1.5 opacity-80">
                                      <Clock size={12} />
                                      {new Date(a.startTime).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })} hs
                                    </div>
                                    <h4 className="text-base font-bold leading-tight text-slate-900 dark:text-white">
                                      {a.service?.name || 'Servicio estándar'}
                                    </h4>
                                  </div>
                                  {/* Action button */}
                                  <div className="relative">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === a.id ? null : a.id); }}
                                      className="w-8 h-8 rounded-lg bg-white/40 dark:bg-black/20 hover:bg-white/70 dark:hover:bg-black/40 flex items-center justify-center transition-all text-slate-700 dark:text-slate-200"
                                    >
                                      {actionLoading === a.id ? <Loader2 size={14} className="animate-spin" /> : <span className="text-base font-bold">⋮</span>}
                                    </button>
                                    {actionMenuId === a.id && <ActionMenu appointment={a} />}
                                  </div>
                                </div>

                                <div className="space-y-2 relative z-10">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7.5 h-7.5 rounded-lg bg-white/30 dark:bg-black/20 flex items-center justify-center border border-white/20 dark:border-white/10">
                                      <User size={12} />
                                    </div>
                                    <div>
                                      <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200">
                                        {a.user?.firstName} {a.user?.lastName}
                                      </p>
                                      {a.user?.phone && <span className="text-[10px] text-slate-500 dark:text-slate-400">{a.user.phone}</span>}
                                    </div>
                                  </div>

                                  {a.vehicle && (
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7.5 h-7.5 rounded-lg bg-white/30 dark:bg-black/20 flex items-center justify-center border border-white/20 dark:border-white/10">
                                        <Car size={12} />
                                      </div>
                                      <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                                        {a.vehicle.brand} {a.vehicle.model} {a.vehicle.licensePlate && `• ${a.vehicle.licensePlate}`}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                <div className="mt-4 pt-2.5 border-t border-black/5 dark:border-white/10 flex items-center justify-between relative z-10">
                                  <div className={`inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/10`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${config.badge} ${a.status === 'IN_PROGRESS' ? 'animate-pulse' : ''}`} />
                                    {config.label}
                                  </div>
                                  {/* Quick actions */}
                                  <div className="flex gap-1">
                                    {['PENDING', 'CONFIRMED'].includes(a.status) && (
                                      <button onClick={() => handleStart(a.id)} title="Iniciar"
                                        className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-all">
                                        <Play size={12} />
                                      </button>
                                    )}
                                    {a.status === 'IN_PROGRESS' && (
                                      <button onClick={() => handleComplete(a.id)} title="Completar"
                                        className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all">
                                        <CheckCircle2 size={12} />
                                      </button>
                                    )}
                                    {['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(a.status) && (
                                      <button onClick={() => handleCancel(a.id)} title="Cancelar"
                                        className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all">
                                        <XCircle size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="admin-card !p-0 overflow-hidden border-b-4 border-b-primary/20">
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Servicio</th>
                      <th>Cliente</th>
                      <th>Vehículo</th>
                      <th>Estado</th>
                      <th className="text-right pr-10">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-20">
                          <div className="flex flex-col items-center gap-4">
                            <CalendarDays size={48} className="text-slate-200 dark:text-slate-700" />
                            <h3 className="text-base font-bold text-slate-400">No hay turnos para esta fecha</h3>
                            <p className="text-sm text-slate-400">Seleccioná otra fecha o creá un nuevo turno.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredAppointments.map((a, i) => {
                        const config = statusConfig[a.status] || statusConfig.PENDING;
                        return (
                          <motion.tr
                            key={a.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="group"
                          >
                            <td>
                              <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                                {new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                              </span>
                            </td>
                            <td>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{a.service?.name}</p>
                            </td>
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                  {a.user?.firstName?.[0]}{a.user?.lastName?.[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{a.user?.firstName} {a.user?.lastName}</p>
                                  {a.user?.phone && <p className="text-xs text-slate-500 dark:text-slate-400">{a.user.phone}</p>}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="text-sm text-slate-600 dark:text-slate-300">{a.vehicle?.brand} {a.vehicle?.model}</span>
                            </td>
                            <td>
                              <span className={`admin-badge px-3 py-1.5 transition-all ${config.color}`}>
                                <span className="flex items-center gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full ${config.badge}`} />
                                  {config.label}
                                </span>
                              </span>
                            </td>
                            <td className="text-right pr-6">
                              <div className="flex justify-end gap-2">
                                {['PENDING', 'CONFIRMED'].includes(a.status) && (
                                  <button onClick={() => handleStart(a.id)} title="Iniciar Servicio"
                                    className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-all">
                                    <Play size={14} />
                                  </button>
                                )}
                                {a.status === 'IN_PROGRESS' && (
                                  <button onClick={() => handleComplete(a.id)} title="Completar"
                                    className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all">
                                    <CheckCircle2 size={14} />
                                  </button>
                                )}
                                {['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(a.status) && (
                                  <button onClick={() => handleCancel(a.id)} title="Cancelar Turno"
                                    className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
