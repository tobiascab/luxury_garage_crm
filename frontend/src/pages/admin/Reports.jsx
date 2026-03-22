import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';

export default function Reports() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    api.get('/dashboard/admin').then(r => setData(r.data.data || {})).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const revenueData = data.monthlyRevenue || [
    { month: 'Ene', revenue: 0, members: 0 }, { month: 'Feb', revenue: 0, members: 0 },
    { month: 'Mar', revenue: 0, members: 0 }, { month: 'Abr', revenue: 0, members: 0 },
    { month: 'May', revenue: 0, members: 0 }, { month: 'Jun', revenue: 0, members: 0 },
  ];

  const servicesData = data.serviceBreakdown || [
    { name: 'Lavado Ext.', count: 0 }, { name: 'Completo', count: 0 },
    { name: 'Premium', count: 0 }, { name: 'Detailing', count: 0 },
  ];

  return (
    <div className="page-content">
      <PageHeader title="📈 Reportes" subtitle="Análisis de rendimiento del negocio" />

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <StatCard icon="💰" title="Ingresos Totales" value={`₲${(data.totalRevenue || 0).toLocaleString()}`} color="#10B981" />
        <StatCard icon="👥" title="Total Miembros" value={data.totalMembers || 0} color="#1E90FF" />
        <StatCard icon="🚿" title="Servicios Realizados" value={data.totalServices || 0} color="#00D4FF" />
        <StatCard icon="⭐" title="Rating Promedio" value={`${data.avgRating || 0}★`} color="#F59E0B" />
      </div>

      <div className="dashboard-grid">
        {/* Revenue Chart */}
        <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="card-header"><h3>💰 Ingresos Mensuales</h3></div>
          <div className="card-body" style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} tickFormatter={v => `₲${(v/1000000).toFixed(1)}M`} />
                <Tooltip contentStyle={{ background: '#111d33', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 8, color: '#F0F4F8' }} formatter={v => `₲${v.toLocaleString()}`} />
                <Bar dataKey="revenue" fill="url(#reportGradient)" radius={[6, 6, 0, 0]} />
                <defs><linearGradient id="reportGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#059669" /></linearGradient></defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Members Growth */}
        <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="card-header"><h3>👥 Crecimiento de Miembros</h3></div>
          <div className="card-body" style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#111d33', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 8, color: '#F0F4F8' }} />
                <Line type="monotone" dataKey="members" stroke="#1E90FF" strokeWidth={3} dot={{ fill: '#1E90FF', strokeWidth: 2, r: 5 }} activeDot={{ r: 7, fill: '#00D4FF' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Service Breakdown */}
        <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="card-header"><h3>🔧 Servicios más populares</h3></div>
          <div className="card-body" style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={servicesData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 12 }} width={100} />
                <Tooltip contentStyle={{ background: '#111d33', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 8, color: '#F0F4F8' }} />
                <Bar dataKey="count" fill="url(#svcGradient)" radius={[0, 6, 6, 0]} />
                <defs><linearGradient id="svcGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#8B5CF6" /><stop offset="100%" stopColor="#A78BFA" /></linearGradient></defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Key Metrics */}
        <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="card-header"><h3>📊 Métricas Clave</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gap: '16px' }}>
              {[
                { label: 'Ticket Promedio', value: `₲${(data.avgTicket || 0).toLocaleString()}`, color: 'var(--green)' },
                { label: 'Retención Mensual', value: `${data.retentionRate || 0}%`, color: 'var(--blue)' },
                { label: 'Tasa de Conversión', value: `${data.conversionRate || 0}%`, color: 'var(--cyan)' },
                { label: 'Servicios/día (prom)', value: `${data.avgServicesPerDay || 0}`, color: 'var(--purple)' },
                { label: 'Churn Rate', value: `${data.churnRate || 0}%`, color: 'var(--red)' },
              ].map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                  <span className="text-sm text-muted">{m.label}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
