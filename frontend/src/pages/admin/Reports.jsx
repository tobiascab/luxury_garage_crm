import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line,
  AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import {
  TrendingUp, Users, Wrench, Star,
  DollarSign, PieChart as PieIcon,
  Filter, Download, Calendar,
  ArrowUpRight, ArrowDownRight,
  Target, Zap, Activity, Globe,
  Briefcase, Loader2, ChevronRight,
  LayoutDashboard
} from 'lucide-react';
import api from '../../services/api';

export default function Reports() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    api.get('/dashboard/admin')
      .then(r => setData(r.data.data || {}))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Generando Reporte Ejecutivo...</p>
    </div>
  );

  const revenueData = data.monthlyRevenue || [
    { month: 'Enero', revenue: 42000000, members: 110 },
    { month: 'Febrero', revenue: 48000000, members: 125 },
    { month: 'Marzo', revenue: 51000000, members: 138 },
    { month: 'Abril', revenue: 59000000, members: 152 },
    { month: 'Mayo', revenue: 64000000, members: 168 },
    { month: 'Junio', revenue: 72000000, members: 185 },
  ];

  const servicesData = data.serviceBreakdown || [
    { name: 'Lavado Exterior', count: 320 },
    { name: 'Limpieza Completa', count: 245 },
    { name: 'Ceramic Coating', count: 85 },
    { name: 'Detailing Int.', count: 120 },
    { name: 'Mantenimiento VIP', count: 150 },
  ];

  return (
    <div className="page-content pb-10">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <TrendingUp size={24} />
            </div>
            Análisis y Reportes
          </h1>
          <p>Inteligencia de negocio y métricas de rendimiento operativo</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-white/5">
            <button className="px-4 py-2 rounded-xl bg-white dark:bg-slate-700 shadow-sm text-[9px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Mensual</button>
            <button className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Trimestral</button>
            <button className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Anual</button>
          </div>
          <button className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xl shadow-slate-900/20 hover:-translate-y-1 transition-all">
            <Download size={18} />
          </button>
        </div>
      </header>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <ReportKPICard
          title="Ingresos Totales"
          value={`₲${(data.totalRevenue || 452000000).toLocaleString()}`}
          trend="+12.5%"
          up={true}
          icon={<DollarSign size={20} />}
          color="bg-emerald-500"
          delay={0.1}
        />
        <ReportKPICard
          title="Miembros de Élite"
          value={data.totalMembers || '185'}
          trend="+8%"
          up={true}
          icon={<Users size={20} />}
          color="bg-blue-500"
          delay={0.2}
        />
        <ReportKPICard
          title="Servicios Ejecutados"
          value={data.totalServices || '1,420'}
          trend="+22%"
          up={true}
          icon={<Wrench size={20} />}
          color="bg-purple-500"
          delay={0.3}
        />
        <ReportKPICard
          title="Promedio Cliente"
          value={`${data.avgRating || '4.9'} ★`}
          trend="+0.2"
          up={true}
          icon={<Star size={20} />}
          color="bg-amber-400"
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart Card */}
        <div className="lg:col-span-2 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="admin-card !p-8 border-emerald-500/10 h-[450px] flex flex-col"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Flujo Operativo</h3>
                  <h4 className="text-xl font-black italic tracking-tighter uppercase leading-none">Crecimiento de Ingresos</h4>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-lg uppercase tracking-widest">En alza</span>
              </div>
            </div>

            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.05)" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} tickFormatter={v => `₲${(v / 1000000).toFixed(0)}M`} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 16, color: '#F0F4F8', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}
                    itemStyle={{ fontWeight: 900, textTransform: 'uppercase', fontSize: 11 }}
                    formatter={v => [`₲${v.toLocaleString()}`, 'Igresos']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#revenueGradient)" animationDuration={1500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Members Growth */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="admin-card h-[380px] flex flex-col"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Target size={16} />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Expansión de Miembros</h3>
              </div>

              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.05)" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 900 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 900 }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 12, color: '#fff' }} />
                    <Line type="monotone" dataKey="members" stroke="#3b82f6" strokeWidth={4} dot={{ fill: '#3b82f6', r: 5, strokeWidth: 3 }} activeDot={{ r: 8, fill: '#60a5fa' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Service Distribution Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="admin-card h-[380px] flex flex-col"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <PieIcon size={16} />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Volumen de Servicios</h3>
              </div>

              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={servicesData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.05)" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 900 }} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 900 }} width={80} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 12 }} />
                    <Bar dataKey="count" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Sidebar Analytics */}
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
            className="admin-card overflow-hidden"
          >
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
              <Zap size={14} className="text-primary" /> Métricas Estratégicas
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {[
                { label: 'Ticket Promedio', value: `₲${(data.avgTicket || 345000).toLocaleString()}`, color: 'text-emerald-500', icon: <DollarSign size={14} /> },
                { label: 'Retención Mensual', value: `${data.retentionRate || 95}%`, color: 'text-blue-500', icon: <Activity size={14} /> },
                { label: 'Conversión de Leads', value: `${data.conversionRate || 18.5}%`, color: 'text-indigo-500', icon: <Target size={14} /> },
                { label: 'Servicios Diarios (Prom)', value: `${data.avgServicesPerDay || 12.4}`, color: 'text-purple-500', icon: <Briefcase size={14} /> },
                { label: 'Tasa de Churn', value: `${data.churnRate || 2.1}%`, color: 'text-red-500', icon: <ArrowDownRight size={14} /> },
              ].map((m, i) => (
                <div key={i} className="flex justify-between items-center py-5 group hover:bg-slate-50 dark:hover:bg-white/5 px-2 -mx-2 transition-all rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="text-slate-400">{m.icon}</div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">{m.label}</span>
                  </div>
                  <span className={`text-sm font-black italic tracking-tighter ${m.color} uppercase`}>
                    {m.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <button className="w-full py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:-translate-y-1 transition-all flex items-center justify-center gap-3">
                Analizar Operaciones <ChevronRight size={14} />
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
            className="p-8 rounded-[2.5rem] bg-indigo-600 text-white shadow-2xl shadow-indigo-600/30 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-[60px] rounded-full translate-x-1/2 -translate-y-1/2" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-6">
                <Globe size={24} />
              </div>
              <h4 className="font-black italic text-xl uppercase tracking-tighter mb-2 leading-none">Market Intelligence</h4>
              <p className="text-[9px] font-bold text-indigo-100/70 uppercase tracking-widest leading-relaxed mb-8">
                Compara tus resultados con el promedio regional y optimiza tus precios dinámicamente.
              </p>
              <button className="flex items-center justify-center gap-3 w-full py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:-translate-y-1 active:scale-95 transition-all">
                Explorar Mercado <ArrowUpRight size={14} />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function ReportKPICard({ title, value, trend, up, icon, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -5 }}
      className="admin-card group"
    >
      <div className="flex justify-between items-start mb-6">
        <div className={`w-12 h-12 rounded-2xl ${color} text-white flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform duration-500`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${up ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
          {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {trend}
        </div>
      </div>
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{title}</h3>
        <p className="text-2xl font-black italic tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
          {value}
        </p>
      </div>
    </motion.div>
  );
}
