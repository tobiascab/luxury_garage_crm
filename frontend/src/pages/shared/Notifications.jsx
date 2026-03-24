import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import {
  Bell, BellOff, CheckCircle2,
  Calendar, CreditCard, Gift,
  MessageSquare, UserPlus, Clock,
  Search, Filter, Trash2,
  ChevronRight, Sparkles, Loader2,
  Mail, Settings, Info, Briefcase
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Error al sincronizar notificaciones');
    }
    setLoading(false);
  };

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;
    try {
      await Promise.all(unread.map(n => api.put(`/notifications/${n.id}/read`).catch(() => { })));
      toast.success('Bandeja de entrada optimizada');
      loadNotifications();
    } catch (e) {
      toast.error('Error al procesar sincronización');
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(notifications.filter(n => n.id !== id));
      toast.success('Entrada eliminada');
    } catch (e) { toast.error('Error al eliminar'); }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const typeConfig = {
    RENEWAL_REMINDER: { icon: <Clock size={16} />, color: 'text-amber-500 bg-amber-500/10', label: 'Renovación' },
    APPOINTMENT_REMINDER: { icon: <Calendar size={16} />, color: 'text-indigo-500 bg-indigo-500/10', label: 'Agenda' },
    WELCOME: { icon: <Sparkles size={16} />, color: 'text-emerald-500 bg-emerald-500/10', label: 'Bienvenida' },
    PROMOTION: { icon: <Gift size={16} />, color: 'text-purple-500 bg-purple-500/10', label: 'Promoción' },
    SERVICE_COMPLETED: { icon: <CheckCircle2 size={16} />, color: 'text-sky-500 bg-sky-500/10', label: 'Operaciones' },
    PAYMENT: { icon: <CreditCard size={16} />, color: 'text-rose-500 bg-rose-500/10', label: 'Finanzas' },
  };

  const filtered = notifications.filter(n => {
    const matchesSearch = n.title?.toLowerCase().includes(search.toLowerCase()) || n.message?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'ALL' || (filter === 'UNREAD' && !n.isRead) || (filter === 'READ' && n.isRead);
    return matchesSearch && matchesFilter;
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escaneando Inbox de Notificaciones...</p>
    </div>
  );

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <Bell size={24} />
            </div>
            Central de Avisos
          </h1>
          <p>Supervisión de alertas y comunicaciones del ecosistema</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="px-6 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200 hover:text-primary transition-all"
            >
              Marcar todo como leído
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 font-black text-xs">
            {unreadCount}
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="mb-10 flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="admin-search-wrapper">
            <Search className="admin-search-icon" size={18} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="BUSCAR EN EL HISTORIAL DE NOTIFICACIONES..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5">
          {['ALL', 'UNREAD', 'READ'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-white dark:bg-slate-800 text-primary shadow-sm border border-slate-200 dark:border-white/10' : 'text-slate-400'}`}
            >
              {f === 'ALL' ? 'Todos' : f === 'UNREAD' ? 'Sin Leer' : 'Vistos'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="admin-card text-center py-24 flex flex-col items-center gap-6 group">
          <div className="w-20 h-20 rounded-[2rem] bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 transform group-hover:rotate-12 translate-y-0 group-hover:-translate-y-2">
            <BellOff size={40} />
          </div>
          <div>
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white mb-2 underline decoration-indigo-500/30">Bandeja de Entrada Vacía</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">No hay registros operacionales pendientes de revisión</p>
          </div>
          <button onClick={loadNotifications} className="admin-btn-outline px-8 mt-4">Sincronizar Nodo</button>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode='popLayout'>
            {filtered.map((n, i) => {
              const config = typeConfig[n.type] || { icon: <Info size={16} />, color: 'text-slate-500 bg-slate-500/10', label: 'Sistema' };
              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  className={`admin-card !p-0 overflow-hidden relative group transition-all duration-300 ${!n.isRead ? 'border-l-4 border-l-indigo-600 border-indigo-500/10' : 'opacity-70 bg-slate-50/30'}`}
                >
                  <div className="p-6 md:p-8 flex items-start gap-6">
                    <div className={`w-14 h-14 rounded-2xl ${config.color} flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 group-hover:-rotate-12 transition-all duration-500 border border-white/10`}>
                      {config.icon}
                    </div>

                    <div className="flex-1 min-w-0" onClick={() => !n.isRead && markRead(n.id)}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${config.color} border-none`}>
                          {config.label}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {new Date(n.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })} • {new Date(n.createdAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className={`text-base font-black italic uppercase tracking-tight text-slate-900 dark:text-white leading-tight mb-2 ${!n.isRead ? 'group-hover:text-indigo-600 transition-colors' : ''}`}>
                        {n.title}
                      </h3>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {!n.isRead && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-[0_0_12px_#6366f1] animate-pulse" />}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }} className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-inner">
                          <Trash2 size={16} />
                        </button>
                        <button className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center hover:text-primary transition-all">
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Identification Label (Technical Background Decor) */}
                  {!n.isRead && (
                    <div className="absolute right-12 bottom-0 pointer-events-none opacity-[0.03] select-none">
                      <span className="text-[60px] font-black italic tracking-tighter uppercase">UNREAD_LOG</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

