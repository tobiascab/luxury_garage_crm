import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../../services/api';
import StatCard from '../../components/StatCard';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/admin').then(res => setData(res.data.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const d = data || {};
  const COLORS = ['#1E90FF', '#8B5CF6', '#F59E0B'];
  const planData = d.planDistribution || [{ name: 'Básico', value: 0 }, { name: 'Premium', value: 0 }, { name: 'VIP', value: 0 }];
  const revenueData = d.monthlyRevenue || [];

  return (
    <div className="space-y-8 no-scrollbar">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h1 className="text-4xl font-headline font-black italic tracking-tighter text-slate-900 dark:text-white uppercase">📊 Dashboard</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-2">Métricas en tiempo real</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <StatCard icon="👥" title="Miembros Activos" value={d.activeMembers || 0} color="#0040e0" />
        <StatCard icon="💰" title="Ingresos Mes" value={`₲${(d.monthlyRevenue?.[0]?.revenue || 0).toLocaleString()}`} color="#10B981" />
        <StatCard icon="🆕" title="Nuevos Miembros" value={d.newThisMonth || 0} color="#8B5CF6" />
        <StatCard icon="📈" title="Retención" value={`${d.retentionRate || 0}%`} color="#F59E0B" />
        <StatCard icon="📅" title="Turnos Hoy" value={d.todayAppointments || 0} color="#2e5bff" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Chart */}
        <motion.div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6"><h3 className="text-sm font-black uppercase tracking-widest text-slate-400">📈 Ingresos</h3></div>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }} tickFormatter={v => `₲${(v / 1000000).toFixed(1)}M`} />
                <Tooltip cursor={{ fill: 'rgba(0,64,224,0.05)' }} contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 16, color: '#F0F4F8', fontWeight: 'bold' }} />
                <Bar dataKey="revenue" fill="#0040e0" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Plan Distribution */}
        <motion.div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6"><h3 className="text-sm font-black uppercase tracking-widest text-slate-400">📊 Planes</h3></div>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planData} cx="50%" cy="50%" outerRadius={100} innerRadius={60} dataKey="value" stroke="none">
                  {planData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 16, color: '#F0F4F8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
