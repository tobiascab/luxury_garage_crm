import { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, CreditCard, Clock, AlertCircle, Banknote,
  Search, ChevronLeft, ChevronRight, PieChart, CheckCircle2,
  RotateCcw, TrendingDown, Scale,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatGs } from '../../constants/pricing';
import Skeleton, { SkeletonStats, SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import AnimatedNumber from '../../components/AnimatedNumber';

const fmtCompact = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `₲ ${(v / 1_000_000).toLocaleString('es-PY', { maximumFractionDigits: 1 })} M`;
  if (v >= 1_000) return `₲ ${(v / 1_000).toLocaleString('es-PY', { maximumFractionDigits: 0 })} k`;
  return formatGs(v);
};

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'COMPLETED', label: 'Cobrados' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'FAILED', label: 'Fallidos' },
  { value: 'REFUNDED', label: 'Reembolsados' },
];

const METHOD_LABELS = {
  bancard_card: 'Tarjeta',
  bancard_test: 'Tarjeta (prueba)',
  stripe: 'Tarjeta (legado)',
  stripe_card: 'Tarjeta (legado)',
  card: 'Tarjeta',
  cash: 'Efectivo',
  transfer: 'Transferencia',
};
const methodLabel = (m) => METHOD_LABELS[m] || (m ? m.replace(/_/g, ' ') : 'Otro');

function StatusBadge({ status }) {
  const map = {
    COMPLETED: { cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20', icon: CheckCircle2, label: 'Cobrado' },
    PENDING: { cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20', icon: Clock, label: 'Pendiente' },
    PROCESSING: { cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/20', icon: Clock, label: 'Procesando' },
    REQUIRES_ACTION: { cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/20', icon: Clock, label: 'Acción requerida' },
    FAILED: { cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20', icon: AlertCircle, label: 'Fallido' },
    REFUNDED: { cls: 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10', icon: RotateCcw, label: 'Reembolsado' },
  };
  const c = map[status] || map.PENDING;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${c.cls}`}>
      <Icon size={12} /> {c.label}
    </span>
  );
}

// Rango del mes en curso (ISO yyyy-mm-dd) para el resultado mensual real
const currentMonthRange = () => {
  const d = new Date();
  return {
    from: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  };
};

export default function FinanceDashboard() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const [searchFocused, setSearchFocused] = useState(false);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Estado de resultados del mes (ingresos − egresos = utilidad real)
  const [pnl, setPnl] = useState(null);
  const [loadingPnl, setLoadingPnl] = useState(true);

  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loadingTable, setLoadingTable] = useState(true);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // Load aggregate stats once
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/payments/admin/finance', { _noCache: true });
        setStats(res.data.data || {});
      } catch (err) {
        toast.error(err.response?.data?.message || 'No se pudieron cargar las métricas');
      } finally {
        setLoadingStats(false);
      }
    })();
  }, []);

  // Load monthly profit & loss (real utility = ingresos − egresos)
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/accounting/reports/income-statement', {
          _noCache: true,
          params: currentMonthRange(),
        });
        setPnl(res.data.data || null);
      } catch {
        // El módulo contable es opcional acá; no rompemos el dashboard de pagos
        setPnl(null);
      } finally {
        setLoadingPnl(false);
      }
    })();
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadTable = useCallback(async () => {
    setLoadingTable(true);
    try {
      const res = await api.get('/payments/history', {
        _noCache: true,
        params: { page, limit: 20, status: status || undefined, search: debouncedSearch || undefined },
      });
      setPayments(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo cargar el historial de pagos');
      setPayments([]);
    } finally {
      setLoadingTable(false);
    }
  }, [page, status, debouncedSearch]);

  useEffect(() => { loadTable(); }, [loadTable]);

  const s = stats || {};
  const series = s.monthlyRevenue || [];

  return (
    <div className="page-content space-y-6 pb-16">
      {/* Header */}
      <div className="admin-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestión financiera</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Ingresos y cobros — montos en Guaraníes (₲)</p>
        </div>
      </div>

      {/* Stats */}
      {loadingStats ? (
        <SkeletonStats count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <FinanceCard label="Total cobrado" value={<AnimatedNumber value={s.totalCompleted} format="gs" />} sub={`${s.completedCount || 0} pagos`} icon={<TrendingUp size={18} />} color="emerald" />
          <FinanceCard label="Cobrado este mes" value={<AnimatedNumber value={s.monthRevenue} format="gs" />} sub={`${s.monthTransactions || 0} transacciones`} icon={<Banknote size={18} />} color="indigo" />
          <FinanceCard label="Pendiente de cobro" value={<AnimatedNumber value={s.pendingTotal} format="gs" />} sub={`${s.pendingCount || 0} en espera`} icon={<Clock size={18} />} color="amber" />
          <FinanceCard label="Ticket promedio" value={<AnimatedNumber value={s.averageTicket} format="gs" />} sub={s.failedMonth ? `${s.failedMonth} fallidos (mes)` : 'pagos completados'} icon={<PieChart size={18} />} color="sky" />
        </div>
      )}

      {/* Resultado del mes (ingresos − egresos = utilidad real) */}
      <ProfitabilityPanel pnl={pnl} loading={loadingPnl} />

      {/* Revenue chart */}
      {!loadingStats && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Ingresos (últimos 6 meses)</h2>
              <p className="text-xs text-slate-400 mt-0.5">Pagos completados por mes</p>
            </div>
          </div>
          {series.some((x) => x.revenue > 0) ? (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="finRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-white/5" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtCompact} width={70} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 13 }}
                    formatter={(v) => [formatGs(v), 'Ingresos']}
                    labelStyle={{ fontWeight: 600, color: '#1e293b' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#finRevGrad)" dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[240px] flex items-center justify-center">
              <EmptyState icon="📈" title="Sin ingresos aún" message="Los pagos completados aparecerán acá." />
            </div>
          )}
        </div>
      )}

      {/* Transactions */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="w-1 h-5 bg-indigo-600 rounded-full" /> Movimientos
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:min-w-[300px]">
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`} size={16} />
              <input
                className={`w-full h-10 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
                  searchFocused
                    ? 'border-primary ring-2 ring-primary/15'
                    : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
                placeholder="Buscar por cliente o concepto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 overflow-x-auto">
              {STATUS_FILTERS.map((f) => {
                const active = status === f.value;
                return (
                  <motion.button
                    key={f.value}
                    type="button"
                    whileTap={tap}
                    onClick={() => { setStatus(f.value); setPage(1); }}
                    className={`relative px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      active
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="finance-status-filter"
                        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }}
                        className="absolute inset-0 rounded-lg bg-white dark:bg-slate-900 shadow-sm"
                      />
                    )}
                    <span className="relative">{f.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {loadingTable ? (
          <SkeletonTable rows={6} cols={5} />
        ) : payments.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl py-16">
            <EmptyState
              icon="🧾"
              title="Sin movimientos"
              message={debouncedSearch || status ? 'No hay pagos que coincidan con el filtro.' : 'Todavía no se registraron pagos.'}
              action={debouncedSearch || status ? 'Limpiar filtros' : undefined}
              onAction={debouncedSearch || status ? () => { setSearch(''); setStatus(''); setPage(1); } : undefined}
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/60 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
                    <th className="text-left text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Fecha</th>
                    <th className="text-left text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Cliente</th>
                    <th className="text-left text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Concepto</th>
                    <th className="text-left text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Medio</th>
                    <th className="text-left text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Estado</th>
                    <th className="text-right text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                        <td className="px-5 py-4 whitespace-nowrap">
                          <p className="text-sm text-slate-900 dark:text-white">
                            {new Date(p.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(p.createdAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-xs font-semibold text-slate-500 shrink-0">
                              {p.user ? `${p.user.firstName?.[0] || ''}${p.user.lastName?.[0] || ''}` : '?'}
                            </span>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Sin asignar'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {p.description || p.membership?.plan?.name || 'Pago'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <span className="w-7 h-7 admin-itile admin-itile-sky text-white">
                              <CreditCard size={13} />
                            </span>
                            {methodLabel(p.paymentMethod)}
                          </span>
                        </td>
                        <td className="px-5 py-4"><StatusBadge status={p.status} /></td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                            {formatGs(p.amountGs || 0)}
                          </span>
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 bg-slate-50/60 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5">
              <p className="text-xs text-slate-400">
                Página <span className="font-semibold text-slate-700 dark:text-slate-200">{pagination.page}</span> de{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">{pagination.totalPages}</span>
                {' · '}{pagination.total} transacciones
              </p>
              <div className="flex gap-2">
                <motion.button
                  type="button"
                  whileTap={(page <= 1 || loadingTable) ? undefined : tap}
                  disabled={page <= 1 || loadingTable}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} /> Anterior
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={(page >= pagination.totalPages || loadingTable) ? undefined : tap}
                  disabled={page >= pagination.totalPages || loadingTable}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente <ChevronRight size={14} />
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado del mes: utilidad real = ingresos − egresos
// (datos de /accounting/reports/income-statement). Se oculta si el módulo
// contable aún no devolvió datos para no mostrar ceros engañosos.
// ─────────────────────────────────────────────────────────────────────────────
function ProfitabilityPanel({ pnl, loading }) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
        <Skeleton className="h-5 w-48 rounded-lg mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!pnl) return null;

  const income = Number(pnl.incomeGs || 0);
  const expenses = Number(pnl.expensesGs || 0);
  const profit = pnl.profitGs != null ? Number(pnl.profitGs) : income - expenses;
  const margin = income > 0 ? Math.round((profit / income) * 100) : 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Resultado del mes</h2>
          <p className="text-xs text-slate-400 mt-0.5">Ingresos cobrados menos egresos del mes en curso</p>
        </div>
        <a
          href="/admin/accounting"
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
        >
          Ver contabilidad →
        </a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <PnlTile label="Ingresos" value={<AnimatedNumber value={income} format="gs" />} icon={<TrendingUp size={16} />} color="emerald" />
        <PnlTile label="Egresos" value={<AnimatedNumber value={expenses} format="gs" />} icon={<TrendingDown size={16} />} color="rose" />
        <PnlTile
          label="Utilidad neta"
          value={<AnimatedNumber value={profit} format="gs" />}
          icon={<Scale size={16} />}
          color={profit >= 0 ? 'indigo' : 'amber'}
          sub={income > 0 ? `Margen ${margin}%` : undefined}
          highlight
        />
      </div>
    </div>
  );
}

function PnlTile({ label, value, sub, icon, color, highlight }) {
  return (
    <div className={`rounded-xl p-4 border ${
      highlight ? 'border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-500/[0.04]' : 'border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02]'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 admin-itile admin-itile-${color} text-white`}>{icon}</span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums leading-tight">{value}</p>
      {sub ? <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}

const CARD_TINTS = {
  emerald: 'admin-tint-emerald',
  indigo: 'admin-tint-indigo',
  amber: 'admin-tint-amber',
  sky: 'admin-tint-sky',
  violet: 'admin-tint-violet',
  rose: 'admin-tint-rose',
};

function FinanceCard({ label, value, sub, icon, color }) {
  const tint = CARD_TINTS[color] || CARD_TINTS.indigo;
  return (
    <div
      className={`relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm ${tint}`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className={`w-10 h-10 admin-itile admin-itile-${color} text-white`}>{icon}</span>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-tight">{value}</p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      {sub ? <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}
