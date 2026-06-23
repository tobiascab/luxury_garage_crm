import { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ClipboardList, Inbox, PhoneCall, UserCheck, TrendingUp,
  Search, RefreshCcw, ChevronDown, Mail, Phone, Car,
  Crown, Sparkles, Loader2, Check, X, MessageSquare,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import AnimatedNumber from '../../components/AnimatedNumber';
import { SkeletonStats, SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';

// ── Estados (mismos valores que el backend) ──
const STATUS_META = {
  NEW: { label: 'Nuevo', tone: 'sky' },
  CONTACTED: { label: 'Contactado', tone: 'amber' },
  CONVERTED: { label: 'Convertido', tone: 'emerald' },
  DISCARDED: { label: 'Descartado', tone: 'slate' },
};

const TONES = {
  slate: 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300',
  sky: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400',
  amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

// ── Origen ──
const SOURCE_META = {
  landing: { label: 'Landing', tone: 'sky' },
  login: { label: 'Login', tone: 'amber' },
};

const card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm';
const btnSecondary =
  'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 transition-colors disabled:opacity-60';

const STATUS_FILTERS = [
  { id: '', label: 'Todas' },
  { id: 'NEW', label: 'Nuevas' },
  { id: 'CONTACTED', label: 'Contactadas' },
  { id: 'CONVERTED', label: 'Convertidas' },
  { id: 'DISCARDED', label: 'Descartadas' },
];

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function MembershipRequestsManager() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapSm = reduceMotion ? undefined : { scale: 0.9 };

  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);

  const [status, setStatus] = useState('');
  const [statusFocused, setStatusFocused] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const [updatingId, setUpdatingId] = useState(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/membership-requests/stats', { _noCache: true });
      setStats(res.data.data || null);
    } catch {
      /* las KPIs son secundarias; no rompemos la pantalla */
    }
  }, []);

  const loadRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (status) params.set('status', status);
      if (debouncedSearch) params.set('search', debouncedSearch);
      api.invalidate('/membership-requests');
      const res = await api.get(`/membership-requests?${params}`, { _noCache: true });
      setRequests(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudieron cargar las solicitudes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, status, debouncedSearch]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  const refresh = () => {
    setRefreshing(true);
    api.invalidate('/membership-requests');
    loadStats();
    loadRequests(true);
  };

  const changeStatus = async (req, newStatus) => {
    // "Convertir" no es un simple cambio de estado: crea el cliente real (User + membresía).
    if (newStatus === 'CONVERTED') return convertLead(req);
    setUpdatingId(req.id);
    try {
      await api.put(`/membership-requests/${req.id}/status`, { status: newStatus });
      const meta = STATUS_META[newStatus];
      toast.success(`Solicitud marcada como ${meta ? meta.label.toLowerCase() : newStatus}`);
      // Optimista en la lista
      setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: newStatus } : r)));
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo cambiar el estado');
    } finally {
      setUpdatingId(null);
    }
  };

  // Convierte el lead en cliente real (1 click). Crea el usuario, membresía y envía credenciales.
  const convertLead = async (req) => {
    setUpdatingId(req.id);
    try {
      const res = await api.post(`/membership-requests/${req.id}/convert`);
      const d = res.data?.data || {};
      const sent = d.credentialsSent ? ' · credenciales enviadas' : '';
      if (res.data?.reused) {
        toast.success(`El cliente ya existía; lead marcado como convertido${sent}`);
      } else {
        toast.success(`Cliente creado${sent}`);
      }
      // Optimista + recargar lista/KPIs
      setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: 'CONVERTED' } : r)));
      api.invalidate('/membership-requests');
      loadStats();
      loadRequests(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo convertir el lead');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="page-content pb-20">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="admin-itile admin-itile-indigo w-11 h-11 rounded-2xl">
            <ClipboardList size={22} className="text-white" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Solicitudes de membresía</h1>
            <p className="text-sm text-slate-500">Interesados que pidieron sumarse a un plan desde la web</p>
          </div>
        </div>
        <motion.button whileTap={refreshing ? undefined : tap} onClick={refresh} className={btnSecondary} disabled={refreshing}>
          <RefreshCcw size={15} className={refreshing ? 'animate-spin' : ''} /> Actualizar
        </motion.button>
      </div>

      {/* ── KPIs ── */}
      {loading && !stats ? (
        <div className="mb-6">
          <SkeletonStats count={5} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <Kpi icon={Inbox} accent="indigo" tint="indigo" label="Total" value={<AnimatedNumber value={stats?.total} format="int" />} />
          <Kpi icon={Sparkles} accent="sky" tint="sky" label="Nuevos" value={<AnimatedNumber value={stats?.nuevos} format="int" />} />
          <Kpi icon={PhoneCall} accent="amber" tint="amber" label="Contactados" value={<AnimatedNumber value={stats?.contactados} format="int" />} />
          <Kpi icon={UserCheck} accent="emerald" tint="emerald" label="Convertidos" value={<AnimatedNumber value={stats?.convertidos} format="int" />} />
          <Kpi icon={TrendingUp} accent="violet" tint="violet" label="Conversión" value={<AnimatedNumber value={stats?.conversion} format="percent" />} />
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="flex flex-col lg:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`} size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar por nombre, email, teléfono o vehículo…"
            className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
              searchFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          />
        </div>
        <div className="relative">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            onFocus={() => setStatusFocused(true)}
            onBlur={() => setStatusFocused(false)}
            className={`appearance-none bg-white dark:bg-slate-900 border rounded-xl pl-4 pr-10 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none transition-all duration-200 cursor-pointer w-full lg:w-auto ${
              statusFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.id || 'all'} value={f.id}>{f.label}</option>
            ))}
          </select>
          <motion.span
            aria-hidden
            animate={{ rotate: statusFocused ? 180 : 0, color: statusFocused ? 'var(--color-primary)' : '#94a3b8' }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 24 }}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          >
            <ChevronDown size={16} />
          </motion.span>
        </div>
      </div>

      {/* ── Tabla ── */}
      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : requests.length === 0 ? (
        <div className={`${card} p-6`}>
          <EmptyState
            icon="📝"
            title={debouncedSearch || status ? 'Sin resultados' : 'Aún no hay solicitudes'}
            message={
              debouncedSearch || status
                ? 'Probá con otro término o cambiá el filtro.'
                : 'Las solicitudes de membresía que dejen los interesados aparecerán acá.'
            }
          />
        </div>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-white/[0.02] text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <th className="px-5 py-3.5 font-medium">Interesado</th>
                  <th className="px-5 py-3.5 font-medium hidden md:table-cell">Vehículo</th>
                  <th className="px-5 py-3.5 font-medium hidden lg:table-cell">Plan</th>
                  <th className="px-5 py-3.5 font-medium hidden sm:table-cell">Origen</th>
                  <th className="px-5 py-3.5 font-medium">Estado</th>
                  <th className="px-5 py-3.5 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const meta = STATUS_META[r.status] || { label: r.status, tone: 'slate' };
                  const source = SOURCE_META[r.source] || (r.source ? { label: r.source, tone: 'slate' } : null);
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors align-top"
                    >
                      {/* Interesado */}
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-semibold text-xs shrink-0 uppercase">
                            {(r.firstName?.[0] || '') + (r.lastName?.[0] || '') || '?'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">
                                {[r.firstName, r.lastName].filter(Boolean).join(' ') || 'Sin nombre'}
                              </p>
                              {r.arizarContactId && (
                                <span
                                  title="Ya sincronizado al CRM de ARIZAR"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-medium"
                                >
                                  <Crown size={10} /> ARIZAR
                                </span>
                              )}
                            </div>
                            {r.email && (
                              <p className="text-xs text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                                <Mail size={11} className="shrink-0" /> {r.email}
                              </p>
                            )}
                            {r.phone && (
                              <p className="text-xs text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                                <Phone size={11} className="shrink-0" /> {r.phone}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-400 mt-1 tabular-nums">{fmtDate(r.createdAt)}</p>
                          </div>
                        </div>
                      </td>

                      {/* Vehículo */}
                      <td className="px-5 py-4 hidden md:table-cell">
                        {r.vehicleInfo || r.vehicleSize ? (
                          <div className="flex items-start gap-2">
                            <Car size={14} className="text-slate-400 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              {r.vehicleInfo && (
                                <p className="text-slate-700 dark:text-slate-200 truncate">{r.vehicleInfo}</p>
                              )}
                              {r.vehicleSize && (
                                <p className="text-xs text-slate-400 truncate">{r.vehicleSize}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Plan de interés */}
                      <td className="px-5 py-4 hidden lg:table-cell">
                        {r.planInterest ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
                            <Crown size={12} /> {r.planInterest}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Sin definir</span>
                        )}
                      </td>

                      {/* Origen */}
                      <td className="px-5 py-4 hidden sm:table-cell">
                        {source ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${TONES[source.tone]}`}>
                            {source.label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${TONES[meta.tone]}`}>
                          {meta.label}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {updatingId === r.id ? (
                            <Loader2 size={16} className="animate-spin text-slate-400" />
                          ) : (
                            <RowActions
                              req={r}
                              tapSm={tapSm}
                              onChange={changeStatus}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02]">
              <p className="text-xs text-slate-400">
                Página {pagination.page} de {pagination.totalPages}
                {pagination.total != null && <span className="text-slate-300 dark:text-slate-600"> · {pagination.total} solicitudes</span>}
              </p>
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={page <= 1 ? undefined : tap}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
                >
                  Anterior
                </motion.button>
                <motion.button
                  whileTap={page >= pagination.totalPages ? undefined : tap}
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
                >
                  Siguiente
                </motion.button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Acciones por fila: avanzar/descartar según el estado actual ──
function RowActions({ req, tapSm, onChange }) {
  const actions = [];
  if (req.status === 'NEW') {
    actions.push({ key: 'CONTACTED', title: 'Marcar contactado', icon: PhoneCall, cls: 'hover:bg-amber-600 hover:text-white' });
  }
  if (req.status === 'NEW' || req.status === 'CONTACTED') {
    actions.push({ key: 'CONVERTED', title: 'Marcar convertido', icon: Check, cls: 'hover:bg-emerald-600 hover:text-white' });
    actions.push({ key: 'DISCARDED', title: 'Descartar', icon: X, cls: 'hover:bg-rose-600 hover:text-white' });
  }
  if (req.status === 'DISCARDED') {
    actions.push({ key: 'NEW', title: 'Reabrir solicitud', icon: RefreshCcw, cls: 'hover:bg-sky-600 hover:text-white' });
  }

  return (
    <>
      {req.phone && (
        <motion.a
          whileTap={tapSm}
          href={`https://wa.me/${req.phone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Escribir por WhatsApp"
          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-colors"
        >
          <MessageSquare size={15} />
        </motion.a>
      )}
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <motion.button
            key={a.key}
            whileTap={tapSm}
            onClick={() => onChange(req, a.key)}
            title={a.title}
            className={`w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 flex items-center justify-center transition-colors ${a.cls}`}
          >
            <Icon size={15} />
          </motion.button>
        );
      })}
      {actions.length === 0 && (
        <span className="text-xs text-slate-300 dark:text-slate-600 pr-1">Sin acciones</span>
      )}
    </>
  );
}

function Kpi({ icon, accent, tint, label, value }) {
  const Icon = icon;
  return (
    <div className={card + ` relative overflow-hidden p-5 admin-tint-${tint}`}>
      <div className="flex items-center justify-between mb-4">
        <span className={`admin-itile admin-itile-${accent} w-10 h-10`}>
          <Icon size={18} className="text-white" />
        </span>
      </div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 dark:text-white tabular-nums mt-1">{value}</p>
    </div>
  );
}
