import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Bell, BellOff, Search, Plus, Send, Megaphone, Info, AlertCircle,
  Clock, Trash2, Eye, Users, CheckCircle2, Mail, Loader2,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import FormModal from '../../components/FormModal';
import FormField from '../../components/FormField';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';
import Skeleton, { SkeletonStats } from '../../components/Skeleton';
import AnimatedNumber from '../../components/AnimatedNumber';

const TYPE_META = {
  info: { icon: Info, label: 'Información', color: 'text-sky-600 dark:text-sky-400', chip: 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20' },
  promo: { icon: Megaphone, label: 'Promoción', color: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' },
  alert: { icon: AlertCircle, label: 'Alerta', color: 'text-amber-600 dark:text-amber-400', chip: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' },
  reminder: { icon: Clock, label: 'Recordatorio', color: 'text-indigo-600 dark:text-indigo-400', chip: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20' },
};

const metaFor = (type) =>
  TYPE_META[type] || { icon: Bell, label: type || 'Sistema', color: 'text-slate-500', chip: 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10' };

const emptyForm = { type: 'info', title: '', message: '', target: 'all', userId: '' };

export default function Notifications() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapSmall = reduceMotion ? undefined : { scale: 0.9 };

  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [filter, setFilter] = useState('ALL');

  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [n, s] = await Promise.all([
        api.get('/notifications/admin', { _noCache: true }),
        api.get('/notifications/admin/stats', { _noCache: true }),
      ]);
      setNotifications(n.data.data || []);
      setStats(s.data.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudieron cargar las notificaciones');
    }
    setLoading(false);
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const res = await api.get('/members?limit=200');
      setMembers(res.data.data || []);
    } catch { /* no bloqueante */ }
  }, []);

  useEffect(() => { load(); loadMembers(); }, [load, loadMembers]);

  const markRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await api.put(`/notifications/${id}/read`);
      api.invalidate('/notifications');
      setStats((s) => (s ? { ...s, unread: Math.max(0, s.unread - 1), read: s.read + 1 } : s));
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo marcar como leída');
      load();
    }
  };

  const openCreate = () => {
    setForm(emptyForm);
    setFormErrors({});
    setShowCreate(true);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim()) errs.title = 'El título es obligatorio';
    if (!form.message.trim()) errs.message = 'El mensaje es obligatorio';
    if (form.target === 'specific' && !form.userId) errs.userId = 'Seleccioná un cliente';
    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    setSending(true);
    try {
      if (form.target === 'specific') {
        await api.post('/notifications', {
          type: form.type, title: form.title.trim(), message: form.message.trim(),
          channel: 'app', userId: form.userId,
        });
        toast.success('Notificación enviada');
      } else {
        const res = await api.post('/notifications/broadcast', {
          type: form.type, title: form.title.trim(), message: form.message.trim(),
          channel: 'app', filter: form.target,
        });
        toast.success(res.data?.message || 'Notificación enviada');
      }
      setShowCreate(false);
      api.invalidate('/notifications');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al enviar');
    }
    setSending(false);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/notifications/${toDelete.id}`);
      toast.success('Notificación eliminada');
      setToDelete(null);
      api.invalidate('/notifications');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar');
    }
    setDeleting(false);
  };

  const filtered = notifications.filter((n) => {
    const q = search.toLowerCase();
    const matchSearch = !q || n.title?.toLowerCase().includes(q) || n.message?.toLowerCase().includes(q);
    const matchFilter = filter === 'ALL' || (filter === 'UNREAD' && !n.isRead) || (filter === 'READ' && n.isRead);
    return matchSearch && matchFilter;
  });

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <div className="admin-page-header mb-8">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-white">
            <span className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-600/20">
              <Bell size={20} />
            </span>
            Notificaciones
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Enviá avisos a tus clientes y revisá el historial</p>
        </div>
        <motion.button
          onClick={openCreate}
          whileTap={tap}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-colors"
        >
          <Plus size={16} /> Nueva notificación
        </motion.button>
      </div>

      {/* KPIs reales */}
      {loading ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Kpi icon={<Bell size={18} />} label="Total enviadas" value={<AnimatedNumber value={stats?.total} format="int" />} color="text-indigo-600" />
          <Kpi icon={<Eye size={18} />} label="Sin leer" value={<AnimatedNumber value={stats?.unread} format="int" />} color="text-amber-600" />
          <Kpi icon={<Send size={18} />} label="Este mes" value={<AnimatedNumber value={stats?.sentThisMonth} format="int" />} color="text-sky-600" />
          <Kpi icon={<Users size={18} />} label="Clientes alcanzados" value={<AnimatedNumber value={stats?.reach} format="int" />} color="text-emerald-600" />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`} size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar por título o mensaje…"
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
              searchFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          {[['ALL', 'Todas'], ['UNREAD', 'Sin leer'], ['READ', 'Leídas']].map(([k, l]) => {
            const active = filter === k;
            return (
              <motion.button
                key={k}
                onClick={() => setFilter(k)}
                whileTap={tap}
                className={`relative px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                {active && (
                  reduceMotion ? (
                    <span className="absolute inset-0 rounded-lg bg-white dark:bg-slate-800 shadow-sm" />
                  ) : (
                    <motion.span
                      layoutId="notif-filter-pill"
                      className="absolute inset-0 rounded-lg bg-white dark:bg-slate-800 shadow-sm"
                      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                    />
                  )
                )}
                <span className="relative">{l}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex gap-4">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3 rounded" />
                <Skeleton className="h-3 w-2/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl">
          <EmptyState
            icon="🔔"
            title="Sin notificaciones"
            message={search || filter !== 'ALL' ? 'No hay resultados para el filtro actual.' : 'Creá tu primer aviso para los clientes.'}
            action={!search && filter === 'ALL' ? 'Nueva notificación' : undefined}
            onAction={!search && filter === 'ALL' ? openCreate : undefined}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((n) => {
              const meta = metaFor(n.type);
              const Icon = meta.icon;
              return (
                <motion.div
                  key={n.id}
                  layout
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className={`group bg-white dark:bg-slate-900 border rounded-2xl p-5 flex items-start gap-4 shadow-sm transition-colors ${
                    n.isRead ? 'border-slate-200 dark:border-white/10' : 'border-indigo-200 dark:border-indigo-500/30 ring-1 ring-indigo-500/10'
                  }`}
                >
                  <span className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${meta.chip} ${meta.color}`}>
                    <Icon size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${meta.chip} ${meta.color}`}>{meta.label}</span>
                      {!n.isRead && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">Nuevo</span>
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(n.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })} · {new Date(n.createdAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{n.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                    {n.user && (
                      <p className="text-xs text-slate-400 mt-1.5 inline-flex items-center gap-1">
                        <Users size={12} /> {n.user.firstName} {n.user.lastName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!n.isRead && (
                      <motion.button
                        onClick={() => markRead(n.id)}
                        whileTap={tapSmall}
                        title="Marcar como leída"
                        className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 flex items-center justify-center transition-colors"
                      >
                        <CheckCircle2 size={16} />
                      </motion.button>
                    )}
                    <motion.button
                      onClick={() => setToDelete(n)}
                      whileTap={tapSmall}
                      title="Eliminar"
                      className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={16} />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modal crear/enviar */}
      <FormModal
        isOpen={showCreate}
        onClose={() => !sending && setShowCreate(false)}
        title="Nueva notificación"
        subtitle="Aparece en la app del cliente — sin costo"
        icon={<Send size={18} />}
        formId="notif-form"
        submitting={sending}
        submitLabel="Enviar"
        size="md"
      >
        <form id="notif-form" onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Tipo</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(TYPE_META).map(([k, m]) => {
                const Icon = m.icon;
                const active = form.type === k;
                return (
                  <motion.button
                    key={k}
                    type="button"
                    onClick={() => setForm({ ...form, type: k })}
                    whileTap={tap}
                    className={`p-2.5 rounded-xl border text-center transition-colors ${
                      active ? `${m.chip} ${m.color}` : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-white/10 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon size={16} className="mx-auto mb-1" />
                    <span className="text-[11px] font-medium">{m.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <FormField as="select" label="Destinatarios" name="target" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value, userId: '' })}>
            <option value="all">Todos los clientes</option>
            <option value="active">Solo miembros activos</option>
            <option value="specific">Un cliente específico</option>
          </FormField>

          {form.target === 'specific' && (
            <FormField as="select" label="Cliente" name="userId" required value={form.userId} error={formErrors.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">Seleccionar…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.firstName} {m.lastName}{m.email ? ` — ${m.email}` : ''}</option>
              ))}
            </FormField>
          )}

          <FormField
            label="Título" name="title" required value={form.title} error={formErrors.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ej: Promo de fin de semana"
          />
          <FormField
            as="textarea" label="Mensaje" name="message" required rows={4} value={form.message} error={formErrors.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Escribí el mensaje…"
          />
        </form>
      </FormModal>

      {/* Confirmar borrado */}
      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => !deleting && setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        variant="danger"
        title="Eliminar notificación"
        message={`¿Seguro que querés eliminar "${toDelete?.title}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}

function Kpi({ icon, label, value, color }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
      <div className={`w-9 h-9 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center ${color}`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-3 tabular-nums">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}
