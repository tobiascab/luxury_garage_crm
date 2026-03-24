import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, User, Car,
  ChevronLeft, ChevronRight, Plus,
  MoreVertical, CheckCircle2, AlertCircle,
  Timer, XCircle, Search, CalendarDays,
  Loader2, Filter, Zap, RefreshCcw,
  LayoutDashboard, ArrowUpRight, ChevronRight as ChevronRightIcon,
  Shield, MapPin, Settings2, Sparkles,
  UserCheck, History, Info, Award
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function AppointmentsCalendar() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [view, setView] = useState('day');
  const [search, setSearch] = useState('');

  useEffect(() => { loadAppointments(); }, [selectedDate]);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const start = new Date(selectedDate); start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate); end.setHours(23, 59, 59, 999);
      const res = await api.get(`/appointments?startDate=${start.toISOString()}&endDate=${end.toISOString()}`);
      setAppointments(res.data.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Error en la sincronización de agenda');
    }
    setLoading(false);
  };

  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM

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
    PENDING: { color: 'text-amber-500 bg-amber-500/5 border-amber-500/20', icon: <Timer size={14} />, label: 'Pendiente', badge: 'bg-amber-500' },
    CONFIRMED: { color: 'text-blue-500 bg-blue-500/5 border-blue-500/20', icon: <CheckCircle2 size={14} />, label: 'Confirmado', badge: 'bg-blue-500' },
    IN_PROGRESS: { color: 'text-cyan-500 bg-cyan-500/5 border-cyan-500/20', icon: <Clock size={14} />, label: 'En Proceso', badge: 'bg-cyan-500' },
    COMPLETED: { color: 'text-emerald-500 bg-emerald-500/5 border-emerald-500/20', icon: <CheckCircle2 size={14} />, label: 'Completado', badge: 'bg-emerald-500' },
    CANCELLED: { color: 'text-red-500 bg-red-500/5 border-red-500/20', icon: <XCircle size={14} />, label: 'Cancelado', badge: 'bg-rose-500' },
    NO_SHOW: { color: 'text-rose-500 bg-rose-500/5 border-rose-500/20', icon: <AlertCircle size={14} />, label: 'Sin Asistencia', badge: 'bg-rose-600' }
  };

  const changeDate = (offset) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const formattedDate = new Date(selectedDate).toLocaleDateString('es-PY', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

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
            Control operativo de {filteredAppointments.length} servicios programados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
            <button
              onClick={() => setView('day')}
              className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${view === 'day' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Timeline
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${view === 'list' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Lista Global
            </button>
          </div>
          <button className="admin-btn-primary" onClick={() => toast.success('Módulo de reserva externa activo')}>
            <Plus size={16} /> Crear Protocolo
          </button>
        </div>
      </header>

      {/* Control Bar: Date Nav + Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => changeDate(-1)}
              className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-white/5 transition-all border-r border-slate-100 dark:border-white/5"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="relative group px-6 py-3 min-w-[280px] flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
              <Calendar size={18} className="text-primary" />
              <span className="text-sm font-black uppercase tracking-tighter text-slate-800 dark:text-slate-200 italic">
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
              className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-white/5 transition-all border-l border-slate-100 dark:border-white/5"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="h-12 px-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary hover:border-primary/30 transition-all shadow-sm flex items-center gap-2"
          >
            <History size={14} /> Fecha Actual
          </button>

          <button
            onClick={() => { setLoading(true); loadAppointments(); }}
            className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-primary transition-all shadow-sm"
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
              placeholder="BUSCAR TURNO POR CLIENTE, VEHÍCULO O SERVICIO..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
          <Loader2 size={40} className="text-primary animate-spin" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sincronización de Agenda en Curso...</p>
            <p className="text-[8px] font-bold text-slate-500 italic mt-1 uppercase tracking-tighter">Accediendo a la base de datos de servicios optimizados</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {view === 'day' ? (
            <div className="admin-card !p-0 overflow-hidden border-slate-200/60 dark:border-white/5 shadow-2xl shadow-slate-200/5">
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {hours.map(h => {
                  const currentHourMatches = filteredAppointments.filter(a => new Date(a.startTime).getHours() === h);
                  return (
                    <div key={h} className="flex min-h-[140px] group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/20 relative">
                      {/* Hour Bar */}
                      <div className="w-28 flex flex-col items-center justify-start py-8 border-r border-slate-100 dark:border-white/5 shrink-0 bg-slate-50/30 dark:bg-slate-900/30 sticky left-0 z-10 backdrop-blur-md">
                        <span className="text-2xl font-black italic tracking-tighter text-slate-900 dark:text-white leading-none">
                          {String(h).padStart(2, '0')}:00
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">
                          {h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'}
                        </span>
                      </div>

                      {/* Horizontal Content Area */}
                      <div className="flex-1 p-6 flex gap-6 overflow-x-auto scrollbar-hide relative min-w-0">
                        {/* Empty Slot Placeholder */}
                        {currentHourMatches.length === 0 && (
                          <div className="flex items-center px-4 w-full opacity-0 group-hover:opacity-100 transition-all duration-500">
                            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 italic">
                              <Plus size={16} />
                              <span>Espacio disponible para Slot Operativo</span>
                            </div>
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
                                className={`relative flex-none w-[380px] p-6 rounded-[2rem] border transition-all hover:translate-y-[-4px] hover:shadow-2xl group/card cursor-pointer
                                  ${config.color}
                                `}
                              >
                                {/* Active Glow Effect */}
                                <div className={`absolute inset-0 rounded-[2rem] opacity-0 group-hover/card:opacity-10 dark:group-hover/card:opacity-20 transition-opacity ${config.badge}`} />

                                <div className="flex justify-between items-start mb-6 relative z-10">
                                  <div>
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] mb-3 opacity-70">
                                      <Clock size={14} className="animate-pulse" />
                                      {new Date(a.startTime).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })} HRS
                                    </div>
                                    <h4 className="text-lg font-black italic uppercase tracking-tighter leading-tight text-slate-900 dark:text-white group-hover/card:translate-x-1 transition-transform">
                                      {a.service?.name || 'PROTOCOLO ESTÁNDAR'}
                                    </h4>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <button className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/40 flex items-center justify-center transition-all">
                                      <MoreVertical size={18} />
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-4 relative z-10">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/30 flex items-center justify-center shadow-inner border border-white/20">
                                      <User size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                      <p className="text-xs font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                        {a.user?.firstName} {a.user?.lastName}
                                      </p>
                                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Titular de Operatividad</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/30 flex items-center justify-center shadow-inner border border-white/20">
                                      <Car size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                      <p className="text-[10px] font-black uppercase italic tracking-tighter text-slate-700 dark:text-slate-300">
                                        {a.vehicle?.brand} {a.vehicle?.model}
                                      </p>
                                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Unidad Vinculada</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-8 pt-4 border-t border-black/5 dark:border-white/5 relative z-10">
                                  <div className={`inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full bg-white/40 backdrop-blur-md border border-white/20 ${config.color}`}>
                                    <span className={`w-2 h-2 rounded-full ${config.badge} animate-pulse`} />
                                    {config.label}
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
                      <th>Cronología</th>
                      <th>Arquitectura de Servicio</th>
                      <th>Identidad de Usuario</th>
                      <th>Estatus de Proceso</th>
                      <th className="text-right pr-10">Optimización</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-32 text-center flex flex-col items-center gap-6">
                          <div className="w-24 h-24 rounded-[3rem] bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-200 dark:text-slate-700 shadow-inner group-hover:scale-110 transition-transform duration-700 mx-auto mt-10">
                            <CalendarDays size={48} className="animate-pulse" />
                          </div>
                          <div>
                            <h3 className="text-base font-black uppercase tracking-[0.3em] text-slate-400 italic">No hay registros hoy</h3>
                            <p className="text-[9px] font-bold text-slate-400/60 uppercase tracking-widest mt-2">No se han detectado protocolos de servicio para la fecha seleccionada.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredAppointments.map((a, i) => {
                        const config = statusConfig[a.status] || statusConfig.PENDING;
                        return (
                          <motion.tr
                            key={a.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="group"
                          >
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex flex-col items-center justify-center shrink-0">
                                  <span className="text-[10px] font-black italic leading-none">{new Date(a.startTime).getHours()}:00</span>
                                  <span className="text-[7px] font-black uppercase tracking-widest text-slate-400 mt-1">TIME</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-black tabular-nums">{new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} HRS</span>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Slot Operativo</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="flex flex-col">
                                <p className="text-sm font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none mb-1">{a.service?.name}</p>
                                <div className="flex items-center gap-2">
                                  <Car size={10} className="text-slate-400" />
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{a.vehicle?.brand} {a.vehicle?.model}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50/50 dark:bg-white/5 flex items-center justify-center text-indigo-500"><UserCheck size={14} /></div>
                                <span className="text-xs font-black uppercase tracking-tight italic">{a.user?.firstName} {a.user?.lastName}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`admin-badge px-3 py-1.5 transition-all
                                    ${config.color}
                                  `}>
                                <span className="flex items-center gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full ${config.badge}`} />
                                  {config.label}
                                </span>
                              </span>
                            </td>
                            <td className="text-right pr-6">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-primary transition-all flex items-center justify-center"><ArrowUpRight size={18} /></button>
                                <button className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex items-center justify-center"><MoreVertical size={18} /></button>
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

      {/* Footer Meta Summary */}
      <div className="mt-12 flex flex-col md:flex-row items-center justify-between px-8 gap-6 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <Shield size={16} className="text-primary" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 leading-none mb-1">Cifrado de Protocolo</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Canal de reserva seguro</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Zap size={16} className="text-amber-500" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 leading-none mb-1">Optimización Automática</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Gap analysis activo</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 italic">LG System OS Engine v2.0</p>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Luxury Garage Management Console</p>
        </div>
      </div>
    </div>
  );
}
