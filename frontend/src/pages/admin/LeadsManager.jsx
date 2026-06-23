import { useState, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Target, Mail, Phone, Users, TrendingUp, UserPlus,
  UserCheck, Search, RefreshCcw, Copy, MessageSquare,
  Eye, Gift, Calendar, Loader2,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import AnimatedNumber from '../../components/AnimatedNumber';
import FormModal from '../../components/FormModal';
import { SkeletonStats, SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';

// Estados reales en BD (minúscula)
const STATUS_META = {
  invited: { label: 'Invitado', tone: 'cyan' },
  registered: { label: 'Registrado', tone: 'sky' },
  purchased: { label: 'Convertido', tone: 'emerald' },
};

const TONES = {
  slate: 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300',
  cyan: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  sky: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

const ACCENTS = {
  slate: 'bg-slate-100 dark:bg-white/5 text-slate-500',
  sky: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

const card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm';
const btnSecondary =
  'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 transition-colors disabled:opacity-60';

function fmtGs(n) {
  return '₲ ' + Number(n || 0).toLocaleString('es-PY');
}

export default function LeadsManager() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapSm = reduceMotion ? undefined : { scale: 0.9 };
  const [searchFocused, setSearchFocused] = useState(false);
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [syncingId, setSyncingId] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [leadsRes, statsRes] = await Promise.all([
        api.get('/arizar/leads', { _noCache: true }),
        api.get('/arizar/leads/stats', { _noCache: true }),
      ]);
      setLeads(leadsRes.data.data || []);
      setStats(statsRes.data.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudieron cargar los leads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    api.invalidate('/arizar/leads');
    loadAll(true);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      const matchesTab = tab === 'all' || l.status === tab;
      if (!q) return matchesTab;
      const matchesSearch =
        l.referredEmail?.toLowerCase().includes(q) ||
        l.referredPhone?.includes(q) ||
        l.code?.toLowerCase().includes(q) ||
        l.referrer?.firstName?.toLowerCase().includes(q) ||
        l.referrer?.lastName?.toLowerCase().includes(q) ||
        l.referred?.firstName?.toLowerCase().includes(q) ||
        l.referred?.lastName?.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [leads, tab, search]);

  const handleSyncToCrm = async (lead) => {
    if (!lead.referred?.id) {
      return toast.error('Este lead todavía no es un usuario registrado');
    }
    setSyncingId(lead.id);
    try {
      const res = await api.post(`/arizar/sync-user/${lead.referred.id}`);
      toast.success(res.data.message || 'Contacto sincronizado al CRM');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error sincronizando al CRM');
    } finally {
      setSyncingId(null);
    }
  };

  const counts = {
    all: leads.length,
    invited: stats?.invited ?? leads.filter((l) => l.status === 'invited').length,
    registered: stats?.registered ?? leads.filter((l) => l.status === 'registered').length,
    purchased: stats?.purchased ?? leads.filter((l) => l.status === 'purchased').length,
  };

  const TABS = [
    { id: 'all', label: 'Todos' },
    { id: 'invited', label: 'Invitados' },
    { id: 'registered', label: 'Registrados' },
    { id: 'purchased', label: 'Convertidos' },
  ];

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="admin-itile admin-itile-indigo w-11 h-11 rounded-2xl">
            <Target size={22} className="text-white" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leads y referidos</h1>
            <p className="text-sm text-slate-500">Embudo de captación: invitados, registrados y convertidos</p>
          </div>
        </div>
        <motion.button whileTap={refreshing ? undefined : tap} onClick={refresh} className={btnSecondary} disabled={refreshing}>
          <RefreshCcw size={15} className={refreshing ? 'animate-spin' : ''} /> Actualizar
        </motion.button>
      </div>

      {/* ── KPIs ── */}
      {loading ? (
        <div className="mb-6">
          <SkeletonStats count={4} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Kpi icon={Mail} accent="cyan" tint="sky" label="Invitados" value={<AnimatedNumber value={counts.invited} format="int" />} />
          <Kpi icon={UserPlus} accent="sky" tint="sky" label="Registrados" value={<AnimatedNumber value={counts.registered} format="int" />} />
          <Kpi icon={UserCheck} accent="emerald" tint="emerald" label="Convertidos" value={<AnimatedNumber value={counts.purchased} format="int" />} />
          <Kpi icon={TrendingUp} accent="amber" tint="amber" label="Conversión" value={<AnimatedNumber value={stats?.conversion} format="percent" />} />
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
            placeholder="Buscar por email, teléfono, código o referente…"
            className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
              searchFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <motion.button
                key={t.id}
                whileTap={tap}
                onClick={() => setTab(t.id)}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="leads-tab-filter"
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }}
                    className="absolute inset-0 rounded-lg bg-white dark:bg-slate-800 shadow-sm"
                  />
                )}
                <span className="relative">
                  {t.label} <span className="text-slate-400 tabular-nums">({counts[t.id] ?? 0})</span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Tabla ── */}
      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : filtered.length === 0 ? (
        <div className={`${card} p-6`}>
          <EmptyState
            icon="🎯"
            title={search || tab !== 'all' ? 'Sin resultados' : 'Aún no hay leads'}
            message={
              search || tab !== 'all'
                ? 'Probá con otro término o cambiá el filtro.'
                : 'Los referidos generados por tus clientes aparecerán acá.'
            }
          />
        </div>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-white/[0.02] text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <th className="px-5 py-3.5 font-medium">Prospecto</th>
                  <th className="px-5 py-3.5 font-medium">Referente</th>
                  <th className="px-5 py-3.5 font-medium">Estado</th>
                  <th className="px-5 py-3.5 font-medium">Fecha</th>
                  <th className="px-5 py-3.5 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const meta = STATUS_META[l.status] || { label: l.status, tone: 'slate' };
                  const contact = l.referredEmail || l.referredPhone || (l.referred ? l.referred.email : null);
                  const isEmail = !!l.referredEmail;
                  return (
                    <tr
                      key={l.id}
                      className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`admin-itile w-9 h-9 shrink-0 ${
                              isEmail ? 'admin-itile-sky' : 'admin-itile-emerald'
                            }`}
                          >
                            {isEmail ? <Mail size={15} className="text-white" /> : <Phone size={15} className="text-white" />}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate">
                              {l.referred ? `${l.referred.firstName} ${l.referred.lastName}` : contact || 'Anónimo'}
                            </p>
                            {l.referred && contact && (
                              <p className="text-xs text-slate-400 truncate">{contact}</p>
                            )}
                            {!l.referred && l.code && (
                              <p className="text-xs text-slate-400 font-mono">Código: {l.code}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {l.referrer ? (
                          <div className="flex items-center gap-2.5">
                            <span className="admin-itile admin-itile-violet w-7 h-7 rounded-lg shrink-0">
                              <Users size={13} className="text-white" />
                            </span>
                            <span className="text-slate-700 dark:text-slate-300 truncate">
                              {l.referrer.firstName} {l.referrer.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Directo</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${TONES[meta.tone]}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500 dark:text-slate-400 text-xs">
                        {new Date(l.createdAt).toLocaleDateString('es-PY')}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <motion.button
                            whileTap={tapSm}
                            onClick={() => setDetail(l)}
                            title="Ver detalle"
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 flex items-center justify-center transition-colors"
                          >
                            <Eye size={15} />
                          </motion.button>
                          <motion.button
                            whileTap={(!l.referred?.id || syncingId === l.id) ? undefined : tapSm}
                            onClick={() => handleSyncToCrm(l)}
                            disabled={!l.referred?.id || syncingId === l.id}
                            title={l.referred?.id ? 'Sincronizar al CRM' : 'El lead aún no es usuario'}
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {syncingId === l.id ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
                          </motion.button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Detalle ── */}
      <FormModal
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        title="Detalle del lead"
        subtitle={detail?.referred ? `${detail.referred.firstName} ${detail.referred.lastName}` : 'Prospecto'}
        icon={<Target size={18} />}
        hideFooter
      >
        {detail && <LeadDetail lead={detail} onCopy={(v) => { navigator.clipboard.writeText(v); toast.success('Copiado'); }} />}
      </FormModal>
    </div>
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

function LeadDetail({ lead, onCopy }) {
  const reduceMotion = useReducedMotion();
  const meta = STATUS_META[lead.status] || { label: lead.status, tone: 'slate' };
  const rows = [
    { label: 'Email', value: lead.referredEmail || lead.referred?.email, icon: Mail },
    { label: 'Teléfono', value: lead.referredPhone || lead.referred?.phone, icon: Phone },
    { label: 'Código de referido', value: lead.code, icon: Gift, mono: true },
    { label: 'Fecha', value: new Date(lead.createdAt).toLocaleString('es-PY'), icon: Calendar },
  ].filter((r) => r.value);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Estado</span>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${TONES[meta.tone]}`}>
          {meta.label}
        </span>
      </div>

      <div className="space-y-2">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <div
              key={r.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] px-4 py-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon size={15} className="text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">{r.label}</p>
                  <p className={`text-sm text-slate-700 dark:text-slate-200 truncate ${r.mono ? 'font-mono' : ''}`}>
                    {r.value}
                  </p>
                </div>
              </div>
              <motion.button whileTap={reduceMotion ? undefined : { scale: 0.9 }} onClick={() => onCopy(r.value)} className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0" title="Copiar">
                <Copy size={14} />
              </motion.button>
            </div>
          );
        })}
      </div>

      {/* Referente */}
      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] px-4 py-3">
        <p className="text-xs text-slate-400 mb-1">Referente</p>
        {lead.referrer ? (
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {lead.referrer.firstName} {lead.referrer.lastName}
            </p>
            <p className="text-xs text-slate-400">{lead.referrer.email}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Registro directo (sin referente)</p>
        )}
      </div>

      {/* Recompensa */}
      {lead.rewardAmount != null && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 flex items-center gap-2.5">
          <Gift size={16} className="text-emerald-500" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Recompensa: <span className="font-semibold">{fmtGs(lead.rewardAmount)}</span>
            {lead.rewardType && <span className="text-xs text-emerald-600 dark:text-emerald-400"> · {lead.rewardType}</span>}
          </p>
        </div>
      )}

      {/* Usuario vinculado */}
      {lead.referred && (
        <div className="rounded-xl border border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10 px-4 py-3 flex items-center gap-2.5">
          <MessageSquare size={16} className="text-sky-500" />
          <p className="text-sm text-sky-700 dark:text-sky-300">
            {lead.referred.arizarContactId
              ? 'Cliente vinculado al CRM de ARIZAR'
              : 'Cliente registrado, aún no sincronizado al CRM'}
          </p>
        </div>
      )}
    </div>
  );
}
