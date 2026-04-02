import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import {
  Bell, BellOff, CheckCircle2,
  Calendar, CreditCard, Gift,
  MessageSquare, Clock, Search,
  Trash2, ChevronRight, Sparkles,
  Loader2, Info, Plus, Send,
  X, AlertCircle, Megaphone,
  Eye, RefreshCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function Notifications() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const [notifications, setNotifications] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ type: 'info', title: '', message: '', target: 'all', userId: '' });

  useEffect(() => { loadNotifications(); if (isAdmin) loadMembers(); }, []);

  const loadNotifications = async () => {
    try {
      const url = isAdmin ? '/notifications/admin' : '/notifications';
      const res = await api.get(url);
      setNotifications(res.data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadMembers = async () => {
    try { const res = await api.get('/members?limit=100'); setMembers(res.data.data || []); } catch (e) { console.error(e); }
  };

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;
    await Promise.all(unread.map(n => api.put(`/notifications/${n.id}/read`).catch(() => {})));
    toast.success('Todas marcadas como leídas');
    api.invalidate('/notifications');
    loadNotifications();
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.title || !form.message) { toast.error('Completá título y mensaje'); return; }
    setSending(true);
    try {
      if (form.target === 'specific' && form.userId) {
        await api.post('/notifications', { type: form.type, title: form.title, message: form.message, channel: 'app', userId: form.userId });
        toast.success('Notificación enviada');
      } else {
        await api.post('/notifications/broadcast', { type: form.type, title: form.title, message: form.message, channel: 'app', filter: form.target });
        toast.success('Notificación enviada a todos');
      }
      setForm({ type: 'info', title: '', message: '', target: 'all', userId: '' });
      setShowCreate(false);
      api.invalidate('/notifications');
      loadNotifications();
    } catch (err) { toast.error(err.response?.data?.message || 'Error al enviar'); }
    setSending(false);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const typeConfig = {
    RENEWAL_REMINDER: { icon: <Clock size={16} />, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', label: 'Renovación' },
    APPOINTMENT_REMINDER: { icon: <Calendar size={16} />, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20', label: 'Agenda' },
    WELCOME: { icon: <Sparkles size={16} />, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', label: 'Bienvenida' },
    PROMOTION: { icon: <Gift size={16} />, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', label: 'Promoción' },
    SERVICE_COMPLETED: { icon: <CheckCircle2 size={16} />, color: 'text-sky-500 bg-sky-500/10 border-sky-500/20', label: 'Servicio' },
    PAYMENT: { icon: <CreditCard size={16} />, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', label: 'Pago' },
    info: { icon: <Info size={16} />, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', label: 'Info' },
    promo: { icon: <Megaphone size={16} />, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', label: 'Promoción' },
    alert: { icon: <AlertCircle size={16} />, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', label: 'Alerta' },
    reminder: { icon: <Clock size={16} />, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', label: 'Recordatorio' },
  };

  const filtered = notifications.filter(n => {
    const matchesSearch = n.title?.toLowerCase().includes(search.toLowerCase()) || n.message?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'ALL' || (filter === 'UNREAD' && !n.isRead) || (filter === 'READ' && n.isRead);
    return matchesSearch && matchesFilter;
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Cargando notificaciones...</p>
    </div>
  );

  return (
    <div className="page-content pb-20">
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <Bell size={24} />
            </div>
            Notificaciones
            {unreadCount > 0 && (
              <span className="ml-2 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">{unreadCount}</span>
            )}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {isAdmin ? 'Enviá avisos a tus clientes — sin costo' : 'Tus avisos y alertas'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="px-5 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-primary transition-all">
              <Eye size={14} className="inline mr-2" /> Marcar todo leído
            </button>
          )}
          {isAdmin && (
            <button className="admin-btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={18} /> Nueva Notificación
            </button>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="mb-8 flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-all"
            placeholder="Buscar notificaciones..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          {['ALL', 'UNREAD', 'READ'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === f ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400'}`}>
              {f === 'ALL' ? 'Todas' : f === 'UNREAD' ? 'Sin leer' : 'Leídas'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="admin-card text-center py-20 flex flex-col items-center gap-4">
          <BellOff size={48} className="text-slate-200 dark:text-slate-700" />
          <h3 className="text-base font-bold text-slate-400">Sin notificaciones</h3>
          {isAdmin && <p className="text-sm text-slate-400">Creá tu primer aviso para los clientes.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode='popLayout'>
            {filtered.map((n, i) => {
              const config = typeConfig[n.type] || { icon: <Info size={16} />, color: 'text-slate-500 bg-slate-500/10 border-slate-500/20', label: 'Sistema' };
              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.02 }}
                  className={`admin-card !p-0 overflow-hidden group transition-all cursor-pointer ${!n.isRead ? 'border-l-4 border-l-primary' : 'opacity-70'}`}
                  onClick={() => !n.isRead && markRead(n.id)}
                >
                  <div className="p-5 flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl ${config.color} flex items-center justify-center shrink-0 border`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${config.color} border`}>{config.label}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {new Date(n.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })} · {new Date(n.createdAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{n.title}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{n.message}</p>
                      {isAdmin && n.user && (
                        <p className="text-xs text-slate-400 mt-1">→ {n.user.firstName} {n.user.lastName}</p>
                      )}
                    </div>
                    {!n.isRead && <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-lg shadow-primary/40 animate-pulse shrink-0 mt-2" />}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── CREATE MODAL ── */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
            <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
              onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Nueva Notificación</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Aparece como popup al cliente — gratis</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"><X size={20} /></button>
              </div>
              <form onSubmit={handleSend} className="p-6 space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 block">Tipo</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[['info','Info',<Info size={14}/>],['promo','Promo',<Megaphone size={14}/>],['alert','Alerta',<AlertCircle size={14}/>],['reminder','Recordar',<Clock size={14}/>]].map(([k,l,ic]) => (
                      <button key={k} type="button" onClick={() => setForm({...form,type:k})}
                        className={`p-3 rounded-xl border text-center transition-all ${form.type===k ? (typeConfig[k]?.color||'') + ' shadow-md' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'}`}>
                        <div className="flex justify-center mb-1">{ic}</div>
                        <span className="text-[10px] font-bold">{l}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 block">Destinatarios</label>
                  <select className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary" value={form.target} onChange={e => setForm({...form, target:e.target.value})}>
                    <option value="all">Todos los clientes</option>
                    <option value="active">Solo miembros activos</option>
                    <option value="specific">Un cliente específico</option>
                  </select>
                </div>
                {form.target === 'specific' && (
                  <select className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary" value={form.userId} onChange={e => setForm({...form,userId:e.target.value})} required>
                    <option value="">Seleccionar...</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                  </select>
                )}
                <div>
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 block">Título</label>
                  <input className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary" value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="Ej: ¡Promo de fin de semana!" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 block">Mensaje</label>
                  <textarea className="w-full min-h-[100px] px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary resize-none" value={form.message} onChange={e => setForm({...form,message:e.target.value})} placeholder="Escribí el mensaje..." required />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">Cancelar</button>
                  <button type="submit" disabled={sending} className="flex-[1.5] h-12 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} /> Enviar</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
