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
  BarChart3, PieChart, Percent,
  Lock, Users
} from 'lucide-react';
import api from '../../services/api';

// Format Guaraníes — full number, no abbreviation (e.g. "₲ 500.000")
const fmtGs = (n) => {
  if (!n && n !== 0) return '₲ 0';
  return '₲ ' + Math.round(n).toLocaleString('es-PY');
};

export default function FinanceDashboard() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState('');
  const [commissionRate, setCommissionRate] = useState(0);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/admin').catch(() => ({ data: { data: {} } })),
      api.get('/payments?limit=50').catch(() => ({ data: { data: [] } })),
      api.get('/settings').catch(() => ({ data: { data: {} } })),
    ]).then(([dRes, pRes, sRes]) => {
      setData(dRes.data.data || {});
      setPayments(pRes.data.data || []);
      const settings = sRes.data.data || {};
      setCommissionRate(parseFloat(settings.arizar_commission_rate) || 0);
    })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Cargando datos financieros...</p>
    </div>
  );

  const paidPayments = payments.filter(p => p.status === 'PAID');
  const totalPaid = paidPayments.reduce((s, p) => s + (p.amountGs || 0), 0);
  const totalPending = payments.filter(p => p.status === 'PENDING').reduce((s, p) => s + (p.amountGs || 0), 0);
  const averageTicket = paidPayments.length > 0 ? totalPaid / paidPayments.length : 0;

  // Commission calculation
  const commissionTotal = commissionRate > 0 ? Math.round(totalPaid * (commissionRate / 100)) : 0;

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
          <p className="text-slate-500 dark:text-slate-400">Ingresos, cobros y comisiones — montos en Guaraníes (₲)</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="h-12 px-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2 transition-all hover:bg-slate-50 dark:hover:bg-slate-700">
            <Download size={14} /> Exportar
          </button>
          <button className="admin-btn-primary group h-12">
            <Plus size={18} className="transition-transform group-hover:rotate-90" /> Registrar Movimiento
          </button>
        </div>
      </header>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <FinanceCard
          label="Total Cobrado"
          value={fmtGs(totalPaid)}
          icon={<TrendingUp size={20} />}
          color="emerald"
        />
        <FinanceCard
          label="Pendiente de Cobro"
          value={fmtGs(totalPending)}
          icon={<Clock size={20} />}
          color="amber"
        />
        <FinanceCard
          label="Transacciones"
          value={payments.length.toString()}
          icon={<ShoppingBag size={20} />}
          color="indigo"
        />
        <FinanceCard
          label="Ticket Promedio"
          value={fmtGs(averageTicket)}
          icon={<PieChart size={20} />}
          color="purple"
        />
      </div>

      {/* ── ARIZAR IA COMMISSION CARD ── */}
      {commissionRate > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 p-6 rounded-3xl bg-gradient-to-r from-primary/5 via-indigo-500/5 to-purple-500/5 border border-primary/20 dark:border-primary/30"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-primary/30">
                <Percent size={28} />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Comisión ARIZAR IA</h3>
                  <span className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                    <Lock size={10} /> {commissionRate}%
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Comisión acumulada sobre los cobros realizados
                </p>
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">Base de cálculo</p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{fmtGs(totalPaid)}</p>
              </div>
              <div className="w-px h-12 bg-slate-200 dark:bg-slate-700" />
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">Comisión acumulada</p>
                <p className="text-2xl font-black text-primary">{fmtGs(commissionTotal)}</p>
              </div>
            </div>
          </div>

          {/* Breakdown per payment (last 5) */}
          {paidPayments.length > 0 && (
            <div className="mt-6 pt-5 border-t border-primary/10">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-3">Últimas comisiones generadas</p>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {paidPayments.slice(0, 5).map(p => {
                  const comm = Math.round((p.amountGs || 0) * (commissionRate / 100));
                  return (
                    <div key={p.id} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Cliente'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{p.concept || 'Membresía'}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-400">{fmtGs(p.amountGs || 0)}</span>
                        <span className="text-xs font-bold text-primary">→ {fmtGs(comm)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Transactions Section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-1 h-5 bg-primary rounded-full" />
            Movimientos
          </h2>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:min-w-[350px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-all"
                placeholder="Buscar por cliente o concepto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="admin-card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-6 py-4">Fecha</th>
                  <th className="text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-6 py-4">Cliente</th>
                  <th className="text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-6 py-4">Concepto</th>
                  <th className="text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-6 py-4">Medio</th>
                  <th className="text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-6 py-4">Estado</th>
                  <th className="text-right text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-6 py-4">Monto</th>
                  {commissionRate > 0 && (
                    <th className="text-right text-xs font-bold uppercase tracking-wider text-primary px-6 py-4">Comisión</th>
                  )}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredPayments.map((p, i) => {
                    const comm = commissionRate > 0 && p.status === 'PAID'
                      ? Math.round((p.amountGs || 0) * (commissionRate / 100))
                      : 0;
                    return (
                      <motion.tr
                        key={p.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.015 }}
                        className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center">
                              <span className="text-xs font-bold leading-none text-slate-900 dark:text-white">{new Date(p.createdAt).getDate()}</span>
                              <span className="text-[8px] font-semibold uppercase text-slate-400 leading-none mt-0.5">{new Date(p.createdAt).toLocaleDateString('es-PY', { month: 'short' })}</span>
                            </div>
                            <span className="text-xs text-slate-400">
                              {new Date(p.createdAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">
                              {p.user ? `${p.user.firstName?.[0]}${p.user.lastName?.[0]}` : '?'}
                            </div>
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Sin asignar'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {p.concept || p.membership?.plan?.name || 'Venta'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-400">
                              {p.method === 'CARD' ? <CreditCard size={13} /> : p.method === 'CASH' ? <Wallet size={13} /> : p.method === 'TRANSFER' ? <TrendingUp size={13} /> : <BarChart3 size={13} />}
                            </div>
                            <span className="text-xs font-semibold text-slate-400 uppercase">
                              {p.method === 'CARD' ? 'Tarjeta' : p.method === 'CASH' ? 'Efectivo' : p.method === 'TRANSFER' ? 'Transferencia' : p.method || 'Otro'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {p.status === 'PAID' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                              <CheckCircle2 size={12} /> Cobrado
                            </span>
                          ) : p.status === 'PENDING' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                              <Clock size={12} /> Pendiente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                              <AlertCircle size={12} /> Fallido
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                            {fmtGs(p.amountGs || 0)}
                          </span>
                        </td>
                        {commissionRate > 0 && (
                          <td className="px-6 py-4 text-right">
                            {p.status === 'PAID' ? (
                              <span className="text-sm font-bold tabular-nums text-primary">
                                {fmtGs(comm)}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-500 dark:text-slate-500">—</span>
                            )}
                          </td>
                        )}
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {filteredPayments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Banknote size={48} className="text-slate-400 dark:text-slate-600 mb-4" />
              <h3 className="text-base font-bold text-slate-400">Sin movimientos registrados</h3>
            </div>
          )}

          <footer className="p-5 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              Mostrando <span className="text-slate-900 dark:text-white font-bold">{filteredPayments.length}</span> de <span className="text-slate-900 dark:text-white font-bold">{payments.length}</span> transacciones
            </p>
            <div className="flex gap-2">
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-400 hover:text-primary transition-all">
                <ChevronLeft size={14} /> Anterior
              </button>
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-400 hover:text-primary transition-all">
                Siguiente <ChevronRight size={14} />
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function FinanceCard({ label, value, icon, color }) {
  const colorMap = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-500', border: 'border-indigo-500/20' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20' },
  };
  const c = colorMap[color] || colorMap.indigo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="admin-card group"
    >
      <div className="flex items-center justify-between mb-5">
        <div className={`w-12 h-12 rounded-2xl ${c.bg} ${c.text} flex items-center justify-center border ${c.border}`}>
          {icon}
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">{label}</p>
      <h3 className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
        {value}
      </h3>
    </motion.div>
  );
}
