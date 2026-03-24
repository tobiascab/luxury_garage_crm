import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  Users, TrendingUp, Sparkles, Calendar, Wallet,
  ArrowUpRight, ArrowDownRight, Bot, Zap, Clock, ShieldCheck,
  LayoutDashboard, Activity, Target, Layers, ChevronRight,
  ExternalLink, Briefcase, Star, MessageSquare
} from 'lucide-react';
import api from '../../services/api';

const COLORS = ['#3b82f6', '#818cf8', '#fbbf24', '#10b981'];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [arizarStatus, setArizarStatus] = useState('online');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const res = await api.get('/dashboard/admin');
      setData(res.data.data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Activity size={20} className="text-primary/40 animate-pulse" />
        </div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Analizando Red Operativa...</p>
    </div>
  );

  const d = data || {};
  const planData = d.planDistribution || [
    { name: 'Standard', value: 45 },
    { name: 'Premium', value: 30 },
    { name: 'VIP', value: 15 },
    { name: 'Elite', value: 10 }
  ];
  const revenueData = d.monthlyRevenue || [
    { month: 'Ene', revenue: 45000000 },
    { month: 'Feb', revenue: 52000000 },
    { month: 'Mar', revenue: 48000000 },
    { month: 'Abr', revenue: 61000000 },
    { month: 'May', revenue: 58000000 },
    { month: 'Jun', revenue: 75000000 }
  ];

  return (
    <div className="page-content no-scrollbar pb-12">
      {/* Header Section */}
      <header className="admin-page-header items-end">
        <div>
          <h1 className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-white shadow-2xl shadow-slate-900/40">
              <LayoutDashboard size={24} />
            </div>
            Terminal de Control
          </h1>
          <p>Supervisión analítica de Luxury Garage & Detailing</p>
        </div>

        {/* Arizar AI Status Badge */}
        <div className="flex items-center gap-6 px-6 py-4 rounded-[2rem] bg-slate-900/5 dark:bg-slate-800/20 border border-slate-200 dark:border-white/10 backdrop-blur-xl">
          <div className="flex -space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white border-2 border-white dark:border-slate-900 shadow-lg">
              <Bot size={20} />
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center text-white border-2 border-white dark:border-slate-900 shadow-lg">
              <Zap size={20} className="text-amber-400" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">ARIZAR NEURAL</span>
            </div>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sincronización Activa</span>
          </div>
        </div>
      </header>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
        <KPICard
          title="Miembros Activos"
          value={d.activeMembers || '128'}
          icon={<Users size={20} />}
          color="bg-blue-600"
          trend="+15.4%"
          up={true}
          delay={0.1}
        />
        <KPICard
          title="Ingresos Estimados"
          value={`₲${((revenueData[revenueData.length - 1]?.revenue || 0) / 1000000).toFixed(1)}M`}
          icon={<Wallet size={20} />}
          color="bg-emerald-600"
          trend="+8.2%"
          up={true}
          delay={0.2}
        />
        <KPICard
          title="Leads Calificados"
          value={d.newThisMonth || '42'}
          icon={<Zap size={20} />}
          color="bg-amber-500"
          trend="-3.1%"
          up={false}
          delay={0.3}
        />
        <KPICard
          title="Tasa de Retención"
          value={`${d.retentionRate || 98}%`}
          icon={<Target size={20} />}
          color="bg-indigo-600"
          trend="+2.4%"
          up={true}
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-12">
        {/* Main Performance Chart */}
        <div className="lg:col-span-2 admin-card h-[450px] flex flex-col group border-indigo-500/10">
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                <TrendingUp size={20} />
              </div>
              <div>
                <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Monitoreo de Crecimiento</h3>
                <h4 className="text-xl font-black italic tracking-tighter uppercase leading-none">Proyección de Ingresos</h4>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5">
              <button className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 shadow-sm text-[8px] font-black uppercase tracking-widest text-slate-900 dark:text-white">6 Meses</button>
              <button className="px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Histórico</button>
            </div>
          </div>

          <div className="flex-1 w-full px-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.08)" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                  dy={15}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                  tickFormatter={v => `₲${v / 1000000}M`}
                />
                <Tooltip
                  cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
                  contentStyle={{
                    background: '#0f172a',
                    border: 'none',
                    borderRadius: 20,
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)',
                    padding: '12px 16px'
                  }}
                  itemStyle={{
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    color: '#f8fafc'
                  }}
                  labelStyle={{
                    color: '#6366f1',
                    fontWeight: 900,
                    marginBottom: 4,
                    fontSize: 9,
                    textTransform: 'uppercase'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Ingresos Gs"
                  stroke="#6366f1"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-8">
          <div className="admin-card border-amber-500/10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Layers size={16} />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Membresías Activas</h3>
            </div>

            <div className="h-48 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={10}
                    dataKey="value"
                  >
                    {planData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: 'none',
                      borderRadius: 16,
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 900,
                      textTransform: 'uppercase'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {planData.map((p, i) => (
                <div key={i} className="flex flex-col p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 transition-all hover:border-primary/20">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{p.name}</span>
                  </div>
                  <span className="text-sm font-black italic tracking-tighter text-slate-900 dark:text-white leading-none">
                    {p.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative p-8 rounded-[2.5rem] bg-indigo-600 text-white shadow-2xl shadow-indigo-600/30 overflow-hidden group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-[50px] rounded-full translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 blur-[30px] rounded-full -translate-x-1/2 translate-y-1/2" />

            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mb-6">
                <Bot size={28} className="text-white" />
              </div>
              <h4 className="font-black italic text-2xl leading-tight uppercase tracking-tighter mb-2">ARIZAR AGENT</h4>
              <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-8 leading-relaxed opacity-80">
                Automatización basada en IA para mejorar la retención de tus clientes.
              </p>
              <button className="flex items-center justify-center gap-3 w-full py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl transform active:scale-95 transition-all group-hover:bg-indigo-50">
                Gestionar Agente <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Operative Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="admin-card !bg-white/40 dark:!bg-slate-900/40 backdrop-blur-md border-slate-200/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Calendar size={20} />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Próximo</span>
          </div>
          <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Cita Destacada</h5>
          <p className="text-sm font-black italic text-slate-900 dark:text-white uppercase truncate">Corvette C8 - Lavado</p>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
            <Clock size={12} className="text-indigo-500" />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">14:30 HS - BOX B</span>
          </div>
        </div>

        <div className="admin-card !bg-white/40 dark:!bg-slate-900/40 backdrop-blur-md border-slate-200/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Star size={20} />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Rating</span>
          </div>
          <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Satisfacción Promedio</h5>
          <p className="text-3xl font-black italic text-slate-900 dark:text-white tracking-tighter leading-none">4.9/5.0</p>
          <div className="flex items-center gap-1 mt-4 pt-4 border-t border-slate-100 dark:border-white/5 text-[9px] font-bold text-slate-500">
            <TrendingUp size={12} className="text-emerald-500" />
            <span className="uppercase tracking-widest">Subió 0.2 este mes</span>
          </div>
        </div>

        <div className="admin-card !bg-white/40 dark:!bg-slate-900/40 backdrop-blur-md border-slate-200/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <MessageSquare size={20} />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Leads</span>
          </div>
          <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Pendientes de Contacto</h5>
          <p className="text-3xl font-black italic text-slate-900 dark:text-white tracking-tighter leading-none">12</p>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
            <div className="flex -space-x-1.5 items-center">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-5 h-5 rounded-full border border-white dark:border-slate-900 bg-slate-300" />
              ))}
            </div>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">En espera</span>
          </div>
        </div>

        <div className="admin-card !bg-white/40 dark:!bg-slate-900/40 backdrop-blur-md border-slate-200/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Zap size={20} />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Campañas</span>
          </div>
          <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Retorno de Inversión</h5>
          <p className="text-3xl font-black italic text-slate-900 dark:text-white tracking-tighter leading-none">3.4x</p>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/5 text-[9px] font-bold text-rose-500">
            <Activity size={12} />
            <span className="uppercase tracking-widest">Rendimiento Óptimo</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, color, trend, up, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -8, boxShadow: '0 25px 40px -15px rgba(0,0,0,0.1)' }}
      className="admin-card group relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 bg-black dark:bg-white rounded-bl-[2rem] transition-all group-hover:scale-110">
        {icon}
      </div>

      <div className={`w-14 h-14 rounded-3xl ${color} text-white flex items-center justify-center mb-6 shadow-2xl ${color.replace('bg-', 'shadow-')}/30 transform group-hover:rotate-6 transition-transform duration-500`}>
        {icon}
      </div>

      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">{title}</h3>
        <p className="text-3xl font-black italic tracking-tighter text-slate-900 dark:text-white mb-3">{value}</p>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl w-fit ${up ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
          <div className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest`}>
            {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{trend}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
