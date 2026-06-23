import { useState, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Star, MessageSquare, User, Calendar,
  Reply, Search, Trash2, Car, Filter, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import AnimatedNumber from '../../components/AnimatedNumber';
import EmptyState from '../../components/EmptyState';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import { SkeletonStats, SkeletonCard } from '../../components/Skeleton';

const STAR_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: '5', label: '5★' },
  { value: '4', label: '4★' },
  { value: '3', label: '3★' },
  { value: '2', label: '2★' },
  { value: '1', label: '1★' },
];

const ANSWER_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Sin responder' },
  { value: 'answered', label: 'Respondidas' },
];

function Stars({ value, size = 14 }) {
  return (
    <span className="inline-flex text-amber-400 gap-0.5" aria-label={`${value} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} fill={i < value ? 'currentColor' : 'none'} className={i < value ? '' : 'text-slate-300 dark:text-slate-600'} />
      ))}
    </span>
  );
}

export default function ReviewsAdmin() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [starFilter, setStarFilter] = useState('all');
  const [answerFilter, setAnswerFilter] = useState('all');

  // Respond modal
  const [responding, setResponding] = useState(null); // review object
  const [responseText, setResponseText] = useState('');
  const [responseError, setResponseError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [toDelete, setToDelete] = useState(null); // review object
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadReviews(); }, []);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const r = await api.get('/reviews', { _noCache: true });
      setReviews(r.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudieron cargar las reseñas');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = reviews.length;
    const sum = reviews.reduce((s, r) => s + (r.rating || 0), 0);
    const average = total > 0 ? (sum / total).toFixed(1) : '0.0';
    const pending = reviews.filter((r) => !r.adminResponse).length;
    const distribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => r.rating === star).length,
    }));
    return { total, average, pending, answered: total - pending, distribution };
  }, [reviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((r) => {
      if (starFilter !== 'all' && r.rating !== Number(starFilter)) return false;
      if (answerFilter === 'pending' && r.adminResponse) return false;
      if (answerFilter === 'answered' && !r.adminResponse) return false;
      if (!q) return true;
      const name = `${r.user?.firstName || ''} ${r.user?.lastName || ''}`.toLowerCase();
      const comment = (r.comment || '').toLowerCase();
      const service = (r.serviceRecord?.appointment?.service?.name || '').toLowerCase();
      return name.includes(q) || comment.includes(q) || service.includes(q);
    });
  }, [reviews, search, starFilter, answerFilter]);

  const openRespond = (review) => {
    setResponding(review);
    setResponseText(review.adminResponse || '');
    setResponseError('');
  };

  const submitResponse = async (e) => {
    e?.preventDefault();
    if (!responseText.trim()) {
      setResponseError('Escribí una respuesta');
      return;
    }
    setSaving(true);
    try {
      const r = await api.put(`/reviews/${responding.id}/respond`, { response: responseText.trim() });
      const updated = r.data.data;
      setReviews((prev) => prev.map((x) => (x.id === responding.id ? { ...x, adminResponse: updated.adminResponse } : x)));
      toast.success('Respuesta publicada');
      setResponding(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar la respuesta');
    } finally {
      setSaving(false);
    }
  };

  const removeResponse = async (review) => {
    try {
      await api.delete(`/reviews/${review.id}/respond`);
      setReviews((prev) => prev.map((x) => (x.id === review.id ? { ...x, adminResponse: null } : x)));
      toast.success('Respuesta eliminada');
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar la respuesta');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/reviews/${toDelete.id}`);
      setReviews((prev) => prev.filter((x) => x.id !== toDelete.id));
      toast.success('Reseña eliminada');
      setToDelete(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar la reseña');
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => { setSearch(''); setStarFilter('all'); setAnswerFilter('all'); };
  const hasFilters = search || starFilter !== 'all' || answerFilter !== 'all';

  return (
    <div className="page-content pb-12">
      <PageHeader
        title="Reseñas"
        subtitle="Reputación y respuestas a la voz del cliente"
      />

      {/* KPIs */}
      {loading ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Star size={18} fill="currentColor" />} title="Calificación promedio" value={<AnimatedNumber value={Number(stats.average)} format="decimal" decimals={1} />} color="#f59e0b" />
          <StatCard icon={<MessageSquare size={18} />} title="Total reseñas" value={<AnimatedNumber value={stats.total} format="int" />} color="#6366f1" />
          <StatCard icon={<Reply size={18} />} title="Respondidas" value={<AnimatedNumber value={stats.answered} format="int" />} color="#10b981" />
          <StatCard icon={<MessageSquare size={18} />} title="Sin responder" value={<AnimatedNumber value={stats.pending} format="int" />} color="#f43f5e" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribución */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Distribución</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Reseñas por cantidad de estrellas</p>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-2 rounded-full bg-slate-100 dark:bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : stats.total === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">Sin datos todavía</p>
            ) : (
              <div className="space-y-3.5">
                {stats.distribution.map(({ star, count }) => {
                  const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <span className="flex items-center gap-1 w-8 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {star}<Star size={11} className="text-amber-400" fill="currentColor" />
                      </span>
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full ${star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-amber-400' : 'bg-rose-500'}`}
                        />
                      </div>
                      <span className="w-6 text-right text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="lg:col-span-2 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Buscar por cliente, servicio o comentario..."
                className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
                  searchFocused
                    ? 'border-primary ring-2 ring-primary/15'
                    : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              />
            </div>
            {hasFilters && (
              <motion.button
                whileTap={tap}
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <X size={15} /> Limpiar
              </motion.button>
            )}
          </div>

          {/* Chips de filtro */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            {STAR_FILTERS.map((f) => (
              <motion.button
                key={f.value}
                whileTap={tap}
                onClick={() => setStarFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  starFilter === f.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                }`}
              >
                {f.label}
              </motion.button>
            ))}
            <span className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-1" />
            {ANSWER_FILTERS.map((f) => (
              <motion.button
                key={f.value}
                whileTap={tap}
                onClick={() => setAnswerFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  answerFilter === f.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                }`}
              >
                {f.label}
              </motion.button>
            ))}
          </div>

          {/* Contenido */}
          {loading ? (
            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl">
              <EmptyState
                icon="⭐"
                title={reviews.length === 0 ? 'Sin reseñas todavía' : 'Sin resultados'}
                message={reviews.length === 0
                  ? 'Cuando los clientes califiquen un servicio, sus reseñas aparecerán acá.'
                  : 'Ninguna reseña coincide con los filtros actuales.'}
                action={hasFilters ? 'Limpiar filtros' : undefined}
                onAction={hasFilters ? clearFilters : undefined}
              />
            </div>
          ) : (
            <>
              {filtered.map((r) => {
                const serviceName = r.serviceRecord?.appointment?.service?.name;
                const vehicle = r.serviceRecord?.appointment?.vehicle;
                return (
                  <div
                    key={r.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-300 overflow-hidden shrink-0">
                          {r.user?.avatarUrl ? (
                            <img src={r.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User size={18} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {r.user ? `${r.user.firstName} ${r.user.lastName}` : 'Cliente'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <Calendar size={11} />
                            {new Date(r.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <Stars value={r.rating} />
                    </div>

                    {/* Servicio / vehículo */}
                    {(serviceName || vehicle) && (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {serviceName && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-white/5 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {serviceName}
                          </span>
                        )}
                        {vehicle && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-white/5 text-xs font-medium text-slate-600 dark:text-slate-300">
                            <Car size={12} /> {vehicle.brand} {vehicle.model}
                            {vehicle.licensePlate ? ` · ${vehicle.licensePlate}` : ''}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Comentario */}
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-3">
                      {r.comment ? r.comment : <span className="text-slate-400 italic">Sin comentario</span>}
                    </p>

                    {/* Respuesta oficial */}
                    {r.adminResponse && (
                      <div className="mt-4 pl-4 border-l-2 border-indigo-500/40">
                        <p className="text-xs font-medium text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5 mb-1">
                          <Reply size={12} /> Respuesta del equipo
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{r.adminResponse}</p>
                      </div>
                    )}

                    {/* Acciones */}
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                      <motion.button
                        whileTap={tap}
                        onClick={() => openRespond(r)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                      >
                        <Reply size={14} /> {r.adminResponse ? 'Editar respuesta' : 'Responder'}
                      </motion.button>
                      {r.adminResponse && (
                        <motion.button
                          whileTap={tap}
                          onClick={() => removeResponse(r)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        >
                          Quitar respuesta
                        </motion.button>
                      )}
                      <motion.button
                        whileTap={tap}
                        onClick={() => setToDelete(r)}
                        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 size={14} /> Eliminar
                      </motion.button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Modal de respuesta */}
      <FormModal
        isOpen={!!responding}
        onClose={() => setResponding(null)}
        title={responding?.adminResponse ? 'Editar respuesta' : 'Responder reseña'}
        subtitle={responding ? `${responding.user?.firstName || ''} ${responding.user?.lastName || ''}`.trim() : ''}
        icon={<Reply size={18} />}
        formId="respond-form"
        submitting={saving}
        submitLabel={responding?.adminResponse ? 'Guardar respuesta' : 'Publicar respuesta'}
      >
        <form id="respond-form" onSubmit={submitResponse} className="space-y-4">
          {responding && (
            <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-3.5">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Reseña del cliente</span>
                <Stars value={responding.rating} size={12} />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {responding.comment || <span className="italic text-slate-400">Sin comentario</span>}
              </p>
            </div>
          )}
          <FormField
            as="textarea"
            label="Respuesta oficial"
            name="response"
            value={responseText}
            onChange={(e) => { setResponseText(e.target.value); if (responseError) setResponseError(''); }}
            error={responseError}
            hint="Esta respuesta será visible para el cliente."
            rows={5}
            required
            placeholder="Gracias por tu reseña..."
          />
        </form>
      </FormModal>

      {/* Confirmación de eliminación */}
      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        variant="danger"
        title="Eliminar reseña"
        message={`¿Seguro que querés eliminar la reseña de ${toDelete?.user?.firstName || 'este cliente'}? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
