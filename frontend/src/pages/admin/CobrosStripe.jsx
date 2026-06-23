import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import {
  CreditCard, Banknote, TrendingUp, Clock, RotateCcw, PieChart,
  CheckCircle2, AlertTriangle, RefreshCw, Wallet, Percent, Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatGs } from '../../constants/pricing';
import { SkeletonStats } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';

// Guaraní compacto para ejes/insignias estrechas (ej. ₲ 1,2 M)
const fmtCompact = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `₲ ${(v / 1_000_000).toLocaleString('es-PY', { maximumFractionDigits: 1 })} M`;
  if (v >= 1_000) return `₲ ${(v / 1_000).toLocaleString('es-PY', { maximumFractionDigits: 0 })} k`;
  return formatGs(v);
};

// Etiquetas legibles para los métodos que devuelve la API en byMethod.
const METHOD_LABELS = {
  bancard_card: 'Tarjeta Bancard',
  bancard_test: 'Tarjeta (prueba)',
  bancard: 'Bancard',
  wallet: 'Billetera',
  card: 'Tarjeta',
  cash: 'Efectivo',
  transfer: 'Transferencia',
};
const methodLabel = (m) => {
  if (!m) return 'Otro';
  if (METHOD_LABELS[m]) return METHOD_LABELS[m];
  // Desconocido: capitalizado y sin guiones bajos.
  const clean = String(m).replace(/_/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};
const methodIcon = (m) => (m === 'wallet' ? <Wallet size={14} /> : <CreditCard size={14} />);

export default function CobrosStripe() {
  const [config, setConfig] = useState(null);   // /payments/status
  const [finance, setFinance] = useState(null); // /payments/admin/finance
  const [stats, setStats] = useState(null);     // /payments/admin/stats
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async ({ silent, initial } = {}) => {
    if (silent) setRefreshing(true);
    else if (!initial) setLoading(true);

    const [configRes, financeRes, statsRes] = await Promise.allSettled([
      api.get('/payments/status', { _noCache: true }),
      api.get('/payments/admin/finance', { _noCache: true }),
      api.get('/payments/admin/stats', { _noCache: true }),
    ]);

    if (configRes.status === 'fulfilled') {
      setConfig(configRes.value.data.data || {});
    } else {
      console.error('payments status error', configRes.reason);
      setConfig({ configured: false, bancardConfigured: false });
    }

    if (financeRes.status === 'fulfilled') {
      setFinance(financeRes.value.data.data || {});
    } else {
      console.error('finance error', financeRes.reason);
      if (!silent) toast.error('No se pudieron cargar las métricas de cobros');
    }

    if (statsRes.status === 'fulfilled') {
      setStats(statsRes.value.data.data || {});
    } else {
      console.error('stats error', statsRes.reason);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    (async () => { await loadAll({ initial: true }); })();
  }, [loadAll]);

  const f = finance || {};
  const st = stats || {};
  const configured = config?.bancardConfigured ?? config?.configured ?? false;

  // Tasa de éxito: viene de /stats; si no, se estima con finance.
  const successRate = st.successRate != null
    ? Number(st.successRate)
    : (() => {
        const total = Number(f.totalTransactions) || 0;
        const completed = Number(f.completedCount) || 0;
        return total > 0 ? Math.round((completed / total) * 100) : 0;
      })();

  const series = (f.monthlyRevenue || []);
  const byMethod = (f.byMethod || []);
  const methodTotal = byMethod.reduce((sum, m) => sum + (Number(m.total) || 0), 0);

  return (
    <div className="page-content space-y-6 pb-16">
      {/* ── Header ── */}
      <header className="admin-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-lg shrink-0">
              <CreditCard size={22} />
            </span>
            Cobros — Bancard
          </h1>
          <p>Estado de la integración y resumen de cobros — montos en Guaraníes (₲)</p>
        </div>
        <button
          type="button"
          onClick={() => loadAll({ silent: true })}
          disabled={loading || refreshing}
          className="admin-btn-primary px-6 flex items-center gap-2.5 disabled:opacity-60"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </header>

      {/* ── Estado de la integración Bancard ── */}
      {loading ? (
        <div className="admin-card">
          <div className="animate-pulse h-16" />
        </div>
      ) : (
        <div className="admin-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className={`w-12 h-12 admin-itile text-white shrink-0 ${
                  configured ? 'admin-itile-emerald' : 'admin-itile-amber'
                }`}
              >
                {configured ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Integración Bancard</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {configured
                    ? 'Las claves de Bancard están cargadas. La pasarela puede procesar cobros.'
                    : 'Bancard todavía no está configurado en el backend.'}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                configured
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
              }`}
            >
              {configured ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {configured ? 'Configurado' : 'No configurado'}
            </span>
          </div>

          {!configured && (
            <div className="mt-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Faltan cargar las claves de Bancard en el backend (archivo <span className="font-mono">.env</span>).
                  Hasta entonces no se podrán procesar cobros con tarjeta.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KPIs ── */}
      {loading ? (
        <SkeletonStats count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<TrendingUp size={18} />} color="emerald"
            label="Total cobrado" value={formatGs(f.totalCompleted)}
            sub={`${Number(f.completedCount || 0).toLocaleString('es-PY')} pagos`}
          />
          <KpiCard
            icon={<Banknote size={18} />} color="indigo"
            label="Cobros del mes" value={formatGs(f.monthRevenue)}
            sub={`${Number(f.monthTransactions || 0).toLocaleString('es-PY')} transacciones`}
          />
          <KpiCard
            icon={<PieChart size={18} />} color="cyan"
            label="Ticket promedio" value={formatGs(f.averageTicket)}
            sub={f.failedMonth ? `${Number(f.failedMonth).toLocaleString('es-PY')} fallidos (mes)` : 'pagos completados'}
          />
          <KpiCard
            icon={<Percent size={18} />} color="violet"
            label="Tasa de éxito" value={`${successRate}%`}
            sub={`${Number(f.totalTransactions || st.totalPayments || 0).toLocaleString('es-PY')} transacciones totales`}
          />
        </div>
      )}

      {/* ── KPIs secundarios ── */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<Clock size={18} />} color="amber"
            label="Pendientes" value={formatGs(f.pendingTotal)}
            sub={`${Number(f.pendingCount || 0).toLocaleString('es-PY')} en espera`}
          />
          <KpiCard
            icon={<RotateCcw size={18} />} color="rose"
            label="Reembolsado" value={formatGs(f.refundedTotal)}
            sub={`${Number(f.refundedCount || 0).toLocaleString('es-PY')} reembolsos`}
          />
          <KpiCard
            icon={<AlertTriangle size={18} />} color="rose"
            label="Fallidos (mes)" value={Number(f.failedMonth || 0).toLocaleString('es-PY')}
            sub="transacciones rechazadas"
          />
          <KpiCard
            icon={<Layers size={18} />} color="violet"
            label="Transacciones totales" value={Number(f.totalTransactions || 0).toLocaleString('es-PY')}
            sub="histórico"
          />
        </div>
      )}

      {/* ── Gráfico de ingresos (6 meses) + desglose por método ── */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ingresos últimos 6 meses */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Ingresos (últimos 6 meses)</h2>
                <p className="text-xs text-slate-400 mt-0.5">Cobros completados por mes</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                <TrendingUp size={13} /> {fmtCompact(f.monthRevenue)} este mes
              </span>
            </div>
            {series.some((x) => Number(x.revenue) > 0) ? (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bancardRevGrad" x1="0" y1="0" x2="0" y2="1">
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
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#bancardRevGrad)" dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[260px] flex items-center justify-center">
                <EmptyState icon="📈" title="Sin ingresos aún" message="Los cobros completados aparecerán acá." />
              </div>
            )}
          </div>

          {/* Desglose por método de pago */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm flex flex-col">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Por método de pago</h2>
            <p className="text-xs text-slate-400 mb-4">Distribución de los cobros</p>
            {byMethod.length > 0 ? (
              <div className="space-y-4">
                {byMethod.map((m, i) => {
                  const total = Number(m.total) || 0;
                  const pct = methodTotal > 0 ? Math.round((total / methodTotal) * 100) : 0;
                  return (
                    <div key={m.method || i}>
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                          <span className="w-7 h-7 admin-itile admin-itile-indigo text-white shrink-0">
                            {methodIcon(m.method)}
                          </span>
                          {methodLabel(m.method)}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                          {formatGs(total)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-400 tabular-nums w-16 text-right">
                          {Number(m.count || 0).toLocaleString('es-PY')} · {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState icon="💳" title="Sin cobros" message="Todavía no se registraron cobros por método." />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Subcomponentes ── */

const TINTS = {
  emerald: 'admin-tint-emerald',
  indigo: 'admin-tint-indigo',
  sky: 'admin-tint-sky',
  amber: 'admin-tint-amber',
  rose: 'admin-tint-rose',
  violet: 'admin-tint-violet',
  cyan: 'admin-tint-sky', // no existe admin-tint-cyan; usa sky como pariente
};

function KpiCard({ icon, color, label, value, sub }) {
  const tint = TINTS[color] || TINTS.indigo;
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
