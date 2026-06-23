import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import {
  Bell, BellOff, CheckCircle2,
  Calendar, CreditCard, Gift,
  Clock, Search,
  Sparkles, Loader2, Info, Plus, Send,
  X, AlertCircle, Megaphone, Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import useScrollLock from '../../hooks/useScrollLock';

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

  // Bloquea el scroll del body mientras el modal de creación esté abierto
  useScrollLock(showCreate);

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
    RENEWAL_REMINDER: { icon: <Clock size={16} />, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20', label: 'Renovación' },
    APPOINTMENT_REMINDER: { icon: <Calendar size={16} />, color: 'text-[#0040e0] bg-[#0040e0]/10 border-[#0040e0]/20', label: 'Agenda' },
    WELCOME: { icon: <Sparkles size={16} />, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20', label: 'Bienvenida' },
    PROMOTION: { icon: <Gift size={16} />, color: 'text-purple-600 bg-purple-500/10 border-purple-500/20', label: 'Promoción' },
    SERVICE_COMPLETED: { icon: <CheckCircle2 size={16} />, color: 'text-sky-600 bg-sky-500/10 border-sky-500/20', label: 'Servicio' },
    PAYMENT: { icon: <CreditCard size={16} />, color: 'text-rose-600 bg-rose-500/10 border-rose-500/20', label: 'Pago' },
    info: { icon: <Info size={16} />, color: 'text-[#0040e0] bg-[#0040e0]/10 border-[#0040e0]/20', label: 'Info' },
    promo: { icon: <Megaphone size={16} />, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20', label: 'Promoción' },
    alert: { icon: <AlertCircle size={16} />, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20', label: 'Alerta' },
    reminder: { icon: <Clock size={16} />, color: 'text-purple-600 bg-purple-500/10 border-purple-500/20', label: 'Recordatorio' },
  };

  const filtered = notifications.filter(n => {
    const matchesSearch = n.title?.toLowerCase().includes(search.toLowerCase()) || n.message?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'ALL' || (filter === 'UNREAD' && !n.isRead) || (filter === 'READ' && n.isRead);
    return matchesSearch && matchesFilter;
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={36} className="text-[#0040e0] animate-spin" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cargando notificaciones...</p>
    </div>
  );

  return (
    <div className="page-content pb-20">
      <header className="admin-page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0040e0]/10 text-[#0040e0] flex items-center justify-center shrink-0">
            <Bell size={20} />
          </div>
          <div>
            <h1 className="flex items-center gap-2">
              Notificaciones
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-md bg-[#0040e0] text-white text-xs font-semibold">{unreadCount}</span>
              )}
            </h1>
            <p>{isAdmin ? 'Enviá avisos a tus clientes — sin costo' : 'Tus avisos y alertas'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="admin-btn-outline">
              <Eye size={16} /> Marcar todo leído
            </button>
          )}
          {isAdmin && (
            <button className="admin-btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> Nueva Notificación
            </button>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="mb-6 flex flex-col lg:flex-row gap-3">
        <div className="admin-search-wrapper max-w-none">
          <Search className="admin-search-icon" size={16} />
          <input
            className="admin-search-input"
            placeholder="Buscar notificaciones..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
          {['ALL', 'UNREAD', 'READ'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-md text-xs font-semibold tracking-normal transition-colors ${filter === f ? 'bg-white dark:bg-slate-900 text-[#0040e0] shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
              {f === 'ALL' ? 'Todas' : f === 'UNREAD' ? 'Sin leer' : 'Leídas'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="admin-card text-center py-16 flex flex-col items-center gap-3">
          <BellOff size={40} className="text-slate-300 dark:text-slate-700" />
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Sin notificaciones</h3>
          {isAdmin && <p className="text-sm font-normal text-slate-400 dark:text-slate-500">Creá tu primer aviso para los clientes.</p>}
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
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2) }}
                  className={`admin-card !p-0 group transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 ${!n.isRead ? 'border-l-4 border-l-[#0040e0]' : 'opacity-70'}`}
                  onClick={() => !n.isRead && markRead(n.id)}
                >
                  <div className="p-5 flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center shrink-0 border`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs font-semibold tracking-normal px-2 py-0.5 rounded-md border ${config.color}`}>{config.label}</span>
                        <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                          {new Date(n.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })} · {new Date(n.createdAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{n.title}</h3>
                      <p className="text-sm font-normal text-slate-500 dark:text-slate-400 line-clamp-2">{n.message}</p>
                      {isAdmin && n.user && (
                        <p className="text-xs font-normal text-slate-400 mt-1">→ {n.user.firstName} {n.user.lastName}</p>
                      )}
                    </div>
                    {!n.isRead && <div className="w-2.5 h-2.5 rounded-full bg-[#0040e0] shrink-0 mt-1.5" />}
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
          <div className="admin-modal-overlay">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0" onClick={() => setShowCreate(false)} />
            <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }}
              className="admin-modal relative"
              onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-[var(--admin-border)] flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Nueva Notificación</h2>
                  <p className="text-sm font-normal text-slate-500 dark:text-slate-400">Aparece como popup al cliente — gratis</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="w-9 h-9 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"><X size={18} /></button>
              </div>
              <form onSubmit={handleSend} className="p-6 space-y-5">
                <div>
                  <label className="admin-label">Tipo</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[['info','Info',<Info size={16}/>],['promo','Promo',<Megaphone size={16}/>],['alert','Alerta',<AlertCircle size={16}/>],['reminder','Recordar',<Clock size={16}/>]].map(([k,l,ic]) => (
                      <button key={k} type="button" onClick={() => setForm({...form,type:k})}
                        className={`p-3 rounded-md border text-center transition-colors ${form.type===k ? (typeConfig[k]?.color || '') : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                        <div className="flex justify-center mb-1">{ic}</div>
                        <span className="text-xs font-semibold tracking-normal">{l}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="admin-label">Destinatarios</label>
                  <select className="admin-select" value={form.target} onChange={e => setForm({...form, target:e.target.value})}>
                    <option value="all">Todos los clientes</option>
                    <option value="active">Solo miembros activos</option>
                    <option value="specific">Un cliente específico</option>
                  </select>
                </div>
                {form.target === 'specific' && (
                  <div>
                    <label className="admin-label">Cliente</label>
                    <select className="admin-select" value={form.userId} onChange={e => setForm({...form,userId:e.target.value})} required>
                      <option value="">Seleccionar...</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="admin-label">Título</label>
                  <input className="admin-input" value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="Ej: ¡Promo de fin de semana!" required />
                </div>
                <div>
                  <label className="admin-label">Mensaje</label>
                  <textarea className="admin-input min-h-[100px] py-3 h-auto resize-none" value={form.message} onChange={e => setForm({...form,message:e.target.value})} placeholder="Escribí el mensaje..." required />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="admin-btn-outline">Cancelar</button>
                  <button type="submit" disabled={sending} className="admin-btn-primary">
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
