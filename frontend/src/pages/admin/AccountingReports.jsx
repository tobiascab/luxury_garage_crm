import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Scale, Receipt,
  Clock, AlertTriangle, FileBarChart2, Landmark,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatGs } from '../../constants/pricing';
import { SkeletonStats, SkeletonCard, SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import AnimatedNumber from '../../components/AnimatedNumber';
import { DatePicker } from '../../components/DatePicker';

// ── Helpers ───────────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthStartISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const yearStartISO = () => `${new Date().getFullYear()}-01-01`;

const fmtCompact = (n) => {
  const v = Number(n) || 0;
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}₲ ${(abs / 1_000_000).toLocaleString('es-PY', { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000) return `${sign}₲ ${(abs / 1_000).toLocaleString('es-PY', { maximumFractionDigits: 0 })} k`;
  return formatGs(v);
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' });

const PRESETS = [
  { id: 'month', label: 'Este mes', from: monthStartISO, to: todayISO },
  { id: 'year', label: 'Este año', from: yearStartISO, to: todayISO },
];

const TABS = [
  { id: 'income', label: 'Estado de resultados', icon: Scale },
  { id: 'iva', label: 'IVA', icon: Receipt },
  { id: 'receivables', label: 'Cuentas por cobrar', icon: Landmark },
];

const FALLBACK_COLOR = '#6366f1';

export default function AccountingReports() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const [tab, setTab] = useState('income');
  const [fromDate, setFromDate] = useState(monthStartISO());
  const [toDate, setToDate] = useState(todayISO());

  const applyPreset = (p) => { setFromDate(p.from()); setToDate(p.to()); };

  const rangeParams = useMemo(
    () => ({ from: fromDate || undefined, to: toDate || undefined }),
    [fromDate, toDate]
  );

  return (
    <div className="page-content space-y-6 pb-16">
      {/* Header */}
      <div className="admin-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contabilidad</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Resultados, IVA y cuentas por cobrar — montos en Guaraníes (₲)
          </p>
        </div>
      </div>

      {/* Date range + presets */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Desde</label>
            <DatePicker
              value={fromDate} max={toDate || undefined}
              onChange={(v) => setFromDate(v)}
              placeholder="Desde"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Hasta</label>
            <DatePicker
              value={toDate} min={fromDate || undefined}
              onChange={(v) => setToDate(v)}
              placeholder="Hasta"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 self-start lg:self-end">
          {PRESETS.map((p) => (
            <motion.button
              key={p.id}
              type="button"
              whileTap={tap}
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-900 transition-colors"
            >
              {p.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-white/10">
        <div className="flex gap-1 overflow-x-auto -mb-px">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <motion.button
                key={t.id}
                whileTap={tap}
                onClick={() => setTab(t.id)}
                className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={16} />
                {t.label}
                {active && (
                  <motion.span
                    layoutId="accounting-tab-indicator"
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }}
                    className="absolute left-0 right-0 -bottom-px h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {tab === 'income' && <IncomeStatement params={rangeParams} />}
      {tab === 'iva' && <IvaReport params={rangeParams} />}
      {tab === 'receivables' && <Receivables />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ESTADO DE RESULTADOS
// ════════════════════════════════════════════════════════════════════════════
function IncomeStatement({ params }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/accounting/reports/income-statement', {
        _noCache: true,
        params,
      });
      setData(res.data.data || {});
    } catch (err) {
      setError(true);
      toast.error(err.response?.data?.message || 'No se pudo cargar el estado de resultados');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonStats count={3} />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl py-16">
        <EmptyState icon="⚠️" title="Error al cargar" message="No se pudo obtener el estado de resultados."
          action="Reintentar" onAction={load} />
      </div>
    );
  }

  const d = data || {};
  const income = Number(d.incomeGs || 0);
  const expenses = Number(d.expensesGs || 0);
  const profit = d.profitGs != null ? Number(d.profitGs) : income - expenses;
  const margin = income > 0 ? Math.round((profit / income) * 100) : 0;
  const series = Array.isArray(d.monthly) ? d.monthly : [];
  const incomeByType = Array.isArray(d.incomeBreakdown) ? d.incomeBreakdown : [];
  const expenseByCat = Array.isArray(d.expenseBreakdown) ? d.expenseBreakdown : [];
  const hasData = income > 0 || expenses > 0;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Ingresos" value={<AnimatedNumber value={income} format="gs" />} icon={<TrendingUp size={18} />} color="emerald"
          sub={`${d.incomeCount || 0} cobros completados`} />
        <KpiCard label="Egresos" value={<AnimatedNumber value={expenses} format="gs" />} icon={<TrendingDown size={18} />} color="rose"
          sub={`${d.expenseCount || 0} gastos`} />
        <KpiCard
          label="Utilidad neta"
          value={<AnimatedNumber value={profit} format="gs" />}
          icon={<Scale size={18} />}
          color={profit >= 0 ? 'indigo' : 'amber'}
          sub={income > 0 ? `Margen ${margin}%` : 'Sin ingresos'}
          highlight
        />
      </div>

      {!hasData ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl py-16">
          <EmptyState icon="📊" title="Sin movimientos en el período"
            message="Cuando haya ingresos o egresos en el rango elegido, vas a ver el resultado acá." />
        </div>
      ) : (
        <>
          {/* Income vs expenses chart */}
          {series.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Ingresos vs. egresos</h2>
                <p className="text-xs text-slate-400 mt-0.5">Comparativo por período</p>
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} margin={{ top: 5, right: 8, left: -10, bottom: 0 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-white/5" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtCompact} width={70} />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 13 }}
                      formatter={(v, n) => [formatGs(v), n]}
                      labelStyle={{ fontWeight: 600, color: '#1e293b' }}
                      cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar dataKey="income" name="Ingresos" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={42} />
                    <Bar dataKey="expenses" name="Egresos" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BreakdownPanel
              title="Ingresos por concepto" total={income}
              rows={incomeByType} accent="#10b981" emptyMsg="Sin desglose de ingresos."
            />
            <BreakdownPanel
              title="Egresos por categoría" total={expenses}
              rows={expenseByCat} accent="#f43f5e" emptyMsg="Sin desglose de egresos."
            />
          </div>

          {/* Income statement summary table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-2">
              <FileBarChart2 size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Resumen del período</h2>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <SummaryRow label="Ingresos totales" value={income} positive />
                <SummaryRow label="(−) Egresos totales" value={-expenses} />
                <SummaryRow label="Utilidad neta" value={profit} bold positive={profit >= 0} />
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryRow({ label, value, bold, positive }) {
  return (
    <tr className={`border-b border-slate-50 dark:border-white/5 last:border-0 ${bold ? 'bg-slate-50/60 dark:bg-white/[0.02]' : ''}`}>
      <td className={`px-5 py-3.5 ${bold ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
        {label}
      </td>
      <td className={`px-5 py-3.5 text-right tabular-nums ${bold ? 'text-base font-bold' : 'font-medium'} ${
        positive === false ? 'text-rose-600 dark:text-rose-400' : positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
      }`}>
        {formatGs(value)}
      </td>
    </tr>
  );
}

function BreakdownPanel({ title, total, rows, accent, emptyMsg }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">{title}</h2>
        <p className="text-sm text-slate-400 py-6 text-center">{emptyMsg}</p>
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">{title}</h2>
      <div className="space-y-3">
        {rows.map((r, i) => {
          const amount = Number(r.totalGs ?? r.amountGs ?? 0);
          const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
          const color = r.color || accent;
          return (
            <div key={r.id || r.categoryId || r.name || i}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  {r.name || r.label || 'Otros'}
                </span>
                <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                  {formatGs(amount)} <span className="text-xs text-slate-400">· {pct}%</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// IVA
// ════════════════════════════════════════════════════════════════════════════
function IvaReport({ params }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/accounting/reports/iva', { _noCache: true, params });
      setData(res.data.data || {});
    } catch (err) {
      setError(true);
      toast.error(err.response?.data?.message || 'No se pudo cargar el reporte de IVA');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="space-y-4"><SkeletonStats count={3} /><SkeletonCard /></div>;

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl py-16">
        <EmptyState icon="⚠️" title="Error al cargar" message="No se pudo obtener el reporte de IVA."
          action="Reintentar" onAction={load} />
      </div>
    );
  }

  const d = data || {};
  const ivaDebit = Number(d.ivaDebitGs ?? d.ivaSalesGs ?? 0);   // IVA sobre ventas (débito fiscal)
  const ivaCredit = Number(d.ivaCreditGs ?? d.ivaPurchasesGs ?? 0); // IVA sobre compras (crédito fiscal)
  const balance = d.ivaBalanceGs != null ? Number(d.ivaBalanceGs) : ivaDebit - ivaCredit;
  const owes = balance >= 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="IVA débito (ventas)" value={<AnimatedNumber value={ivaDebit} format="gs" />} icon={<TrendingUp size={18} />} color="emerald"
          sub="IVA cobrado a clientes" />
        <KpiCard label="IVA crédito (compras)" value={<AnimatedNumber value={ivaCredit} format="gs" />} icon={<TrendingDown size={18} />} color="indigo"
          sub="IVA pagado en egresos" />
        <KpiCard
          label={owes ? 'IVA a pagar' : 'Saldo a favor'}
          value={<AnimatedNumber value={Math.abs(balance)} format="gs" />}
          icon={<Receipt size={18} />}
          color={owes ? 'amber' : 'emerald'}
          sub="Débito − crédito"
          highlight
        />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-2">
          <Receipt size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Liquidación de IVA</h2>
        </div>
        <table className="w-full text-sm">
          <tbody>
            <SummaryRow label="IVA débito fiscal (ventas)" value={ivaDebit} positive />
            <SummaryRow label="(−) IVA crédito fiscal (compras)" value={-ivaCredit} />
            <SummaryRow
              label={owes ? 'IVA a pagar al fisco' : 'Saldo a favor del contribuyente'}
              value={balance} bold positive={!owes}
            />
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 flex items-start gap-2">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
        Cálculo estimado a partir de los pagos completados y el IVA cargado en cada egreso. IVA general Paraguay 10%.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CUENTAS POR COBRAR
// ════════════════════════════════════════════════════════════════════════════
function Receivables() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/accounting/receivables', { _noCache: true });
      setData(res.data.data || {});
    } catch (err) {
      setError(true);
      toast.error(err.response?.data?.message || 'No se pudieron cargar las cuentas por cobrar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="space-y-4"><SkeletonStats count={3} /><SkeletonTable rows={5} cols={4} /></div>;

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl py-16">
        <EmptyState icon="⚠️" title="Error al cargar" message="No se pudieron obtener las cuentas por cobrar."
          action="Reintentar" onAction={load} />
      </div>
    );
  }

  const d = data || {};
  const items = Array.isArray(d.items) ? d.items : Array.isArray(d) ? d : [];
  const totalOutstanding = Number(d.totalOutstandingGs ?? items.reduce((s, x) => s + outstanding(x), 0));
  const overdueTotal = Number(d.overdueGs ?? items.filter(isOverdue).reduce((s, x) => s + outstanding(x), 0));
  const overdueCount = d.overdueCount ?? items.filter(isOverdue).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Saldo pendiente total" value={<AnimatedNumber value={totalOutstanding} format="gs" />} icon={<Landmark size={18} />} color="indigo"
          sub={`${items.length} cuentas abiertas`} highlight />
        <KpiCard label="Vencido" value={<AnimatedNumber value={overdueTotal} format="gs" />} icon={<AlertTriangle size={18} />} color="rose"
          sub={`${overdueCount} cuentas vencidas`} />
        <KpiCard label="Al día" value={<AnimatedNumber value={Math.max(0, totalOutstanding - overdueTotal)} format="gs" />} icon={<Clock size={18} />} color="emerald"
          sub={`${Math.max(0, items.length - overdueCount)} cuentas`} />
      </div>

      {items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl py-16">
          <EmptyState icon="✅" title="Sin cuentas por cobrar"
            message="No hay saldos pendientes de clientes en este momento." />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
                  <th className="text-left text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Cliente</th>
                  <th className="text-left text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Concepto</th>
                  <th className="text-left text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Vencimiento</th>
                  <th className="text-center text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Estado</th>
                  <th className="text-right text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const bal = outstanding(it);
                  const overdue = isOverdue(it);
                  const user = it.user || {};
                  const name = it.userName || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Sin asignar';
                  return (
                    <tr
                      key={it.id || i}
                      className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-xs font-semibold text-slate-500 shrink-0">
                            {(name[0] || '?').toUpperCase()}
                          </span>
                          <span className="font-medium text-slate-900 dark:text-white">{name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs max-w-[240px] truncate">
                        {it.reason || it.description || it.concept || 'Crédito'}
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300 text-xs whitespace-nowrap">
                        {it.dueDate ? fmtDate(it.dueDate) : 'Sin fecha'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center">
                          {overdue ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                              <AlertTriangle size={11} /> Vencido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                              <Clock size={11} /> Al día
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatGs(bal)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// saldo pendiente = amount - (settledGs || 0)
function outstanding(it) {
  if (it.outstandingGs != null) return Number(it.outstandingGs);
  const amount = Number(it.amountGs ?? it.amount ?? 0);
  const settled = Number(it.settledGs || 0);
  return Math.max(0, amount - settled);
}

function isOverdue(it) {
  if (!it.dueDate) return false;
  if (it.status === 'settled' || it.status === 'written_off') return false;
  return new Date(it.dueDate) < new Date() && outstanding(it) > 0;
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED KPI CARD
// ════════════════════════════════════════════════════════════════════════════
const KPI_COLORS = {
  emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
  indigo: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

function KpiCard({ label, value, sub, icon, color, highlight }) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm ${
        highlight ? 'border-indigo-200 dark:border-indigo-500/20 ring-1 ring-indigo-500/10' : 'border-slate-200 dark:border-white/10'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${KPI_COLORS[color] || KPI_COLORS.indigo}`}>{icon}</span>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-tight">{value}</p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      {sub ? <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}
