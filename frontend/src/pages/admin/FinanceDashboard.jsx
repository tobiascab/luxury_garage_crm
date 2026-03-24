import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Wallet,
  CreditCard, Calendar,
  ArrowUpRight, ArrowDownRight,
  Search, Filter, Download,
  MoreHorizontal, CheckCircle2,
  Clock, AlertCircle, Banknote,
  ShoppingBag, Loader2, Plus,
  ChevronLeft, ChevronRight,
  BarChart3, PieChart
} from 'lucide-react';
import api from '../../services/api';

export default function FinanceDashboard() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/admin').catch(() => ({ data: { data: {} } })),
      api.get('/payments?limit=50').catch(() => ({ data: { data: [] } })),
    ]).then(([dRes, pRes]) => {
      setData(dRes.data.data || {});
      setPayments(pRes.data.data || []);
    })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analizando registros contables...</p>
    </div>
  );

  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + (p.amountGs || 0), 0);
  const totalPending = payments.filter(p => p.status === 'PENDING').reduce((s, p) => s + (p.amountGs || 0), 0);

  const filteredPayments = payments.filter(p =>
    `${p.user?.firstName} ${p.user?.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    (p.concept && p.concept.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
              <Banknote size={24} />
            </div>
            Gestión Financiera
          </h1>
          <p>Supervisión de flujo de caja y rentabilidad operativa</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="h-12 px-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 flex items-center gap-2 transition-all hover:bg-slate-50 dark:hover:bg-slate-700">
            <Download size={14} /> EXPORTAR LIBRO
          </button>
          <button className="admin-btn-primary group h-12">
            <Plus size={18} className="transition-transform group-hover:rotate-90" /> REGISTRAR MOVIMIENTO
          </button>
        </div>
      </header>

      {/* Financial Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard
          label="Cobros Totales"
          value={`₲${totalPaid.toLocaleString('es-PY')}`}
          trend="+12.5%"
          trendColor="emerald"
          icon={<TrendingUp size={22} />}
          color="emerald"
          progress={85}
        />
        <StatCard
          label="Cuentas por Cobrar"
          value={`₲${totalPending.toLocaleString('es-PY')}`}
          trend="Estable"
          trendColor="amber"
          icon={<Clock size={22} />}
          color="amber"
          progress={32}
        />
        <StatCard
          label="Transacciones"
          value={payments.length.toString()}
          trend="+4 hoy"
          trendColor="indigo"
          icon={<ShoppingBag size={22} />}
          color="indigo"
          progress={64}
        />
        <StatCard
          label="Ticket Promedio"
          value={`₲${(totalPaid / (payments.filter(p => p.status === 'PAID').length || 1)).toLocaleString('es-PY', { maximumFractionDigits: 0 })}`}
          trend="+3% vs mes ant."
          trendColor="purple"
          icon={<PieChart size={22} />}
          color="purple"
          progress={50}
        />
      </div>

      {/* Transactions Section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white flex items-center gap-4">
            <div className="w-1.5 h-6 bg-primary rounded-full shadow-lg shadow-primary/20" />
            Movimientos Contables
          </h2>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="admin-search-wrapper flex-1 md:min-w-[400px]">
              <Search className="admin-search-icon" size={16} />
              <input
                className="admin-search-input"
                placeholder="Buscar por cliente, RUC o concepto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 text-slate-400 flex items-center justify-center transition-all hover:text-primary hover:border-primary/30 shadow-sm border-b-2 active:translate-y-0.5">
              <Filter size={18} />
            </button>
          </div>
        </div>

        <div className="admin-card !p-0 overflow-hidden border-b-4 border-b-slate-900/5 dark:border-b-white/5">
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ejecución</th>
                  <th>Socio / Cliente</th>
                  <th>Referencia</th>
                  <th>Medio</th>
                  <th>Estado</th>
                  <th className="text-right">Total Bruto</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredPayments.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.015 }}
                      className="group"
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex flex-col items-center justify-center">
                            <span className="text-[10px] font-black leading-none">{new Date(p.createdAt).getDate()}</span>
                            <span className="text-[7px] font-black uppercase text-slate-400 leading-none mt-1">{new Date(p.createdAt).toLocaleDateString('es-PY', { month: 'short' })}</span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-400">
                            {new Date(p.createdAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-white/5 flex items-center justify-center text-[9px] font-black group-hover:scale-110 transition-transform">
                            {p.user ? `${p.user.firstName?.[0]}${p.user.lastName?.[0]}` : <Users size={12} />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900 dark:text-white uppercase italic tracking-tight">
                              {p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Anónimo'}
                            </span>
                            <span className="text-[8px] font-bold text-slate-400 tracking-widest uppercase">ID: {p.user?.id?.substring(0, 6) || 'N/A'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg">
                          {p.concept || p.membership?.plan?.name || 'Venta Express'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="text-lg bg-white dark:bg-slate-900 w-8 h-8 rounded-lg shadow-sm flex items-center justify-center border border-slate-100 dark:border-white/5 group-hover:bg-primary group-hover:text-white transition-all transform group-hover:-rotate-12">
                            {p.method === 'CARD' ? <CreditCard size={14} /> : p.method === 'CASH' ? <Wallet size={14} /> : p.method === 'TRANSFER' ? <TrendingUp size={14} /> : <BarChart3 size={14} />}
                          </div>
                          <span className="text-[9px] font-black tracking-[0.1em] text-slate-400 uppercase">
                            {p.method || 'OTROS'}
                          </span>
                        </div>
                      </td>
                      <td>
                        {p.status === 'PAID' ? (
                          <div className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={10} className="mr-1.5" /> Liquidado
                          </div>
                        ) : p.status === 'PENDING' ? (
                          <div className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                            <Clock size={10} className="mr-1.5" /> Pendiente
                          </div>
                        ) : (
                          <div className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <AlertCircle size={10} className="mr-1.5" /> Fallido
                          </div>
                        )}
                      </td>
                      <td className="text-right">
                        <span className="text-sm font-black tabular-nums text-slate-900 dark:text-white">
                          ₲{(p.amountGs || 0).toLocaleString('es-PY')}
                        </span>
                      </td>
                      <td className="text-right">
                        <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary transition-all rounded-xl hover:bg-primary/5">
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          <footer className="p-6 bg-slate-50/50 dark:bg-white/5 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Mostrando <span className="text-slate-900 dark:text-white">{filteredPayments.length}</span> de <span className="text-slate-900 dark:text-white">{payments.length}</span> Transacciones
            </p>
            <div className="flex gap-2">
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[9px] font-black uppercase text-slate-400 hover:text-primary hover:border-primary/50 transition-all active:scale-95">
                <ChevronLeft size={16} /> ANTERIOR
              </button>
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[9px] font-black uppercase text-slate-400 hover:text-primary hover:border-primary/50 transition-all active:scale-95">
                SIGUIENTE <ChevronRight size={16} />
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, trend, trendColor, icon, color, progress }) {
  const colors = {
    emerald: 'bg-emerald-500 text-emerald-500',
    amber: 'bg-amber-500 text-amber-500',
    indigo: 'bg-indigo-600 text-indigo-600',
    purple: 'bg-purple-600 text-purple-600'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="admin-card !p-0 overflow-hidden relative group"
    >
      <div className="p-7">
        <div className="flex items-center justify-between mb-6">
          <div className={`w-12 h-12 rounded-[1.25rem] ${colors[color].split(' ')[0]}/10 ${colors[color].split(' ')[1]} flex items-center justify-center border border-${color}-500/20 shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all`}>
            {icon}
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-${trendColor}-500/10 text-${trendColor}-600 dark:text-${trendColor}-400 text-[10px] font-black uppercase shadow-sm border border-${trendColor}-500/10`}>
            {trend.includes('%') && (trend.startsWith('+') ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />)}
            {trend}
          </div>
        </div>

        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">{label}</p>
        <h3 className="text-3xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase leading-none mb-1 group-hover:translate-x-1 transition-transform tabular-nums">
          {value}
        </h3>
        <p className="text-[9px] font-bold text-slate-500/70 uppercase tracking-widest italic group-hover:text-primary transition-colors">Performance Auditoría Tiempo Real</p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-100 dark:bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={`h-full ${colors[color].split(' ')[0]}`}
        />
      </div>
    </motion.div>
  );
}
