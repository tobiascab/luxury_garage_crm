import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';

export default function FinanceDashboard() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/admin').catch(() => ({ data: { data: {} } })),
      api.get('/payments?limit=20').catch(() => ({ data: { data: [] } })),
    ]).then(([dRes, pRes]) => { setData(dRes.data.data || {}); setPayments(pRes.data.data || []); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const totalRevenue = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + (p.amountGs || 0), 0);
  const pendingRevenue = payments.filter(p => p.status === 'PENDING').reduce((s, p) => s + (p.amountGs || 0), 0);

  return (
    <div className="page-content">
      <PageHeader title="💰 Finanzas" subtitle="Ingresos y pagos del lavadero" />

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <StatCard icon="💰" title="Ingresos Cobrados" value={`₲${totalRevenue.toLocaleString()}`} color="#10B981" />
        <StatCard icon="⏳" title="Pendientes de Cobro" value={`₲${pendingRevenue.toLocaleString()}`} color="#F59E0B" />
        <StatCard icon="📊" title="Pagos Totales" value={payments.length} color="#1E90FF" />
        <StatCard icon="👑" title="Miembros Activos" value={data.activeMembers || 0} color="#8B5CF6" />
      </div>

      <h2 style={{ marginBottom: '16px' }}>📋 Últimos Pagos</h2>
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Fecha</th><th>Cliente</th><th>Concepto</th><th>Método</th><th>Estado</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead>
          <tbody>
            {payments.map((p, i) => (
              <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                <td className="text-sm">{new Date(p.createdAt).toLocaleDateString('es-PY')}</td>
                <td className="text-sm">{p.user ? `${p.user.firstName} ${p.user.lastName}` : '—'}</td>
                <td className="text-sm">{p.concept || p.membership?.plan?.name || 'Pago'}</td>
                <td className="text-sm">{p.method === 'CARD' ? '💳' : p.method === 'CASH' ? '💵' : p.method === 'TRANSFER' ? '🏦' : '—'} {p.method || ''}</td>
                <td><span className={`badge ${p.status === 'PAID' ? 'badge-success' : p.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>{p.status}</span></td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontWeight: 700 }}>₲{(p.amountGs || 0).toLocaleString()}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
