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
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header"><h1>📊 Panel de Administración</h1><p className="text-muted">Luxury Garage — Métricas en tiempo real</p></div>
      </motion.div>

      <div className="stats-grid">
        <StatCard icon="👥" title="Miembros Activos" value={d.activeMembers || 0} trend="up" trendValue="+12%" color="#1E90FF" />
        <StatCard icon="💰" title="Ingresos del Mes" value={`₲${(d.monthlyRevenue?.[0]?.revenue || 0).toLocaleString()}`} color="#10B981" />
        <StatCard icon="🆕" title="Nuevos este mes" value={d.newThisMonth || 0} color="#00D4FF" />
        <StatCard icon="📈" title="Retención" value={`${d.retentionRate || 0}%`} color="#8B5CF6" />
        <StatCard icon="📅" title="Turnos Hoy" value={d.todayAppointments || 0} color="#F59E0B" />
      </div>

      <div className="dashboard-grid">
        {/* Revenue Chart */}
        <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="card-header"><h3>📈 Ingresos (últimos 6 meses)</h3></div>
          <div className="card-body" style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} tickFormatter={v => `₲${(v/1000000).toFixed(1)}M`} />
                <Tooltip contentStyle={{ background: '#111d33', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 8, color: '#F0F4F8' }} />
                <Bar dataKey="revenue" fill="url(#blueGradient)" radius={[6, 6, 0, 0]} />
                <defs><linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1E90FF" /><stop offset="100%" stopColor="#00D4FF" /></linearGradient></defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Plan Distribution */}
        <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="card-header"><h3>📊 Distribución por Plan</h3></div>
          <div className="card-body" style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {planData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#111d33', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 8, color: '#F0F4F8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Alerts */}
        <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="card-header"><h3>⚠️ Alertas</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--gold-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <span>⚠️</span>
                <div><p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{d.expiringThisWeek || 0} membresías vencen esta semana</p></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--red-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <span>🔴</span>
                <div><p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{d.lowStockItems || 0} insumos con stock bajo</p></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--cyan-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,212,255,0.2)' }}>
                <span>📅</span>
                <div><p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{d.pendingAppointments || 0} turnos pendientes de confirmar</p></div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="card-header"><h3>🕐 Actividad Reciente</h3></div>
          <div className="card-body">
            {(d.recentActivity || []).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(d.recentActivity || []).slice(0, 5).map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                    <span>{a.icon || '📝'}</span>
                    <span style={{ flex: 1 }}>{a.message}</span>
                    <span className="text-xs text-muted">{a.time}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '20px' }}>Sin actividad reciente</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
