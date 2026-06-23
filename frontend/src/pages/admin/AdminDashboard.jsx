import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  Users, UserPlus, CalendarClock, Banknote, CreditCard, Wallet,
  Clock, AlertTriangle, TrendingUp, CheckCircle2, RefreshCw, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { formatGs } from '../../constants/pricing';
import { SkeletonStats, SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import AnimatedNumber from '../../components/AnimatedNumber';

const PLAN_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#a855f7'];

// Compact Guaraní for tight chart axes / cards (e.g. ₲ 1,2 M)
const fmtCompact = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `₲ ${(v / 1_000_000).toLocaleString('es-PY', { maximumFractionDigits: 1 })} M`;
  if (v >= 1_000) return `₲ ${(v / 1_000).toLocaleString('es-PY', { maximumFractionDigits: 0 })} k`;
  return formatGs(v);
};

export default function AdminDashboard() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async ({ silent } = {}) => {
    if (silent) setRefreshing(true);
    try {
      const res = await api.get('/dashboard/admin', { _noCache: true });
      setData(res.data.data || {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo cargar el panel');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div className="page-content space-y-6">
        <div className="admin-page-header">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Panel general</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Resumen operativo y financiero</p>
          </div>
        </div>
        <SkeletonStats count={4} />
        <SkeletonTable rows={6} cols={4} />
      </div>
    );
  }

  const d = data || {};
  const planData = (d.membersByPlan || []).map((p) => ({ name: p.planName, value: p.count }));
  const totalPlanMembers = planData.reduce((s, p) => s + p.value, 0);
  const series = d.monthlyRevenue || [];
  const recent = d.recentPayments || [];

  return (
    <div className="page-content space-y-6 pb-16">
      {/* ── Header ── */}
      <div className="admin-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Panel general</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Resumen operativo y financiero — montos en Guaraníes (₲)</p>
        </div>
        <motion.button
          type="button"
          whileTap={refreshing ? undefined : tap}
          onClick={() => loadData({ silent: true })}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-60"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Actualizar
        </motion.button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Banknote size={18} />} color="emerald"
          label="Ingresos del mes" value={<AnimatedNumber value={d.totalRevenue} format="gs" />}
        />
        <KpiCard
          icon={<Users size={18} />} color="indigo"
          label="Membresías activas" value={<AnimatedNumber value={d.activeMembers} format="int" />}
          sub={`${(d.totalMembers ?? 0).toLocaleString('es-PY')} clientes`}
        />
        <KpiCard
          icon={<UserPlus size={18} />} color="sky"
          label="Nuevos este mes" value={<AnimatedNumber value={d.newThisMonth} format="int" />}
        />
        <KpiCard
          icon={<CalendarClock size={18} />} color="amber"
          label="Citas de hoy" value={<AnimatedNumber value={d.todayAppointments} format="int" />}
          sub={d.pendingAppointments ? `${d.pendingAppointments} pendientes` : ''}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue growth */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Ingresos (últimos 6 meses)</h2>
              <p className="text-xs text-slate-400 mt-0.5">Pagos completados por mes</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg">
              <TrendingUp size={13} /> {fmtCompact(d.totalRevenue)} este mes
            </span>
          </div>
          {series.some((s) => s.revenue > 0) ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
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
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[260px] flex items-center justify-center">
              <EmptyState icon="📈" title="Sin ingresos aún" message="Los pagos completados aparecerán acá." />
            </div>
          )}
        </div>

        {/* Members by plan */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm flex flex-col">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Membresías por plan</h2>
          <p className="text-xs text-slate-400 mb-4">Distribución de membresías activas</p>
          {totalPlanMembers > 0 ? (
            <>
              <div className="h-[180px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={planData} cx="50%" cy="50%" innerRadius={58} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                      {planData.map((_, i) => <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                      formatter={(v, n) => [`${v} membresías`, n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <AnimatedNumber className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums" value={totalPlanMembers} format="int" />
                  <span className="text-[11px] text-slate-400">activas</span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {planData.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                      {p.name}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{p.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon="👥" title="Sin membresías activas" message="Todavía no hay clientes con plan activo." />
            </div>
          )}
        </div>
      </div>

      {/* ── Balance / finance cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BalanceCard icon={<CreditCard size={18} />} color="emerald" title="Ingresos suscripción" subtitle="Membresías cobradas (mes)" amount={<AnimatedNumber value={d.subscriptionRevenue} format="gs" />} />
        <BalanceCard icon={<Banknote size={18} />} color="sky" title="Ingresos servicios" subtitle="Otros cobros (mes)" amount={<AnimatedNumber value={d.servicesRevenue} format="gs" />} />
        <BalanceCard icon={<Wallet size={18} />} color="indigo" title="Crédito a favor" subtitle="Saldo en billeteras" amount={<AnimatedNumber value={d.creditBalance} format="gs" />} />
        <BalanceCard icon={<Clock size={18} />} color="amber" title="Pagos pendientes" subtitle={`${d.pendingPaymentsCount || 0} transacciones`} amount={<AnimatedNumber value={d.pendingPaymentsTotal} format="gs" />} />
      </div>

      {/* ── Recent activity + alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent payments */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Actividad reciente</h2>
            <Link to="/admin/finance" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
              Ver finanzas <ChevronRight size={14} />
            </Link>
          </div>
          {recent.length > 0 ? (
            <div className="divide-y divide-slate-50 dark:divide-white/5">
              {recent.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <span className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Cliente'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {p.membership?.plan?.name ? `Membresía ${p.membership.plan.name}` : (p.description || 'Pago')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{formatGs(p.amountGs)}</p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(p.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12">
              <EmptyState icon="🧾" title="Sin actividad" message="Los pagos completados aparecerán acá." />
            </div>
          )}
        </div>

        {/* Operational alerts (all real counts) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Alertas operativas</h2>
          <div className="space-y-3">
            <AlertRow
              icon={<CalendarClock size={16} />} color="amber"
              label="Citas pendientes" value={<AnimatedNumber value={d.pendingAppointments} format="int" />}
              to="/admin/calendar"
            />
            <AlertRow
              icon={<RefreshCw size={16} />} color="sky"
              label="Membresías por vencer (7 días)" value={<AnimatedNumber value={d.expiringMemberships} format="int" />}
              to="/admin/members"
            />
            <AlertRow
              icon={<AlertTriangle size={16} />} color="rose"
              label="Insumos con stock bajo" value={<AnimatedNumber value={d.lowStockItems} format="int" />}
              to="/admin/inventory"
            />
            <AlertRow
              icon={<Clock size={16} />} color="indigo"
              label="Pagos pendientes" value={<AnimatedNumber value={d.pendingPaymentsCount} format="int" />}
              to="/admin/finance"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Subcomponents ── */

// Azulejo de ícono: gradiente vivo + sombra de color. Tinte: fondo sutil de la tarjeta.
const COLORS = {
  emerald: 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30',
  indigo: 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30',
  sky: 'bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg shadow-sky-500/30',
  amber: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30',
  rose: 'bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-lg shadow-rose-500/30',
};
const TINTS = {
  emerald: 'from-emerald-50/70 dark:from-emerald-500/[0.07]',
  indigo: 'from-indigo-50/70 dark:from-indigo-500/[0.07]',
  sky: 'from-sky-50/70 dark:from-sky-500/[0.07]',
  amber: 'from-amber-50/70 dark:from-amber-500/[0.07]',
  rose: 'from-rose-50/70 dark:from-rose-500/[0.07]',
};

function KpiCard({ icon, color, label, value, sub }) {
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${TINTS[color]} to-transparent bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${COLORS[color]}`}>{icon}</span>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-tight">{value}</p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      {sub ? <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}

function BalanceCard({ icon, color, title, subtitle, amount }) {
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${TINTS[color]} to-transparent bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${COLORS[color]}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">{title}</p>
          <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
        </div>
      </div>
      <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{amount}</p>
    </div>
  );
}

const MotionLink = motion.create(Link);

function AlertRow({ icon, color, label, value, to }) {
  const reduceMotion = useReducedMotion();
  return (
    <MotionLink
      to={to}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02] hover:border-slate-200 dark:hover:border-white/10 transition-colors group"
    >
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${COLORS[color]}`}>{icon}</span>
      <span className="text-sm text-slate-600 dark:text-slate-300 flex-1 min-w-0">{label}</span>
      <span className="text-base font-bold text-slate-900 dark:text-white tabular-nums">{value}</span>
      <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-400 transition-colors shrink-0" />
    </MotionLink>
  );
}
