import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';

export default function EmployeeHistory() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/appointments?status=COMPLETED&assignedTo=${user?.id}`).then(r => setRecords(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const today = records.filter(r => { const d = new Date(r.startTime); const now = new Date(); return d.toDateString() === now.toDateString(); });
  const thisWeek = records.filter(r => { const d = new Date(r.startTime); const now = new Date(); const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); return d >= weekAgo; });

  return (
    <div className="page-content">
      <PageHeader title="📊 Mi Historial" subtitle={`${records.length} servicios completados`} />

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <StatCard icon="📅" title="Hoy" value={today.length} color="#10B981" />
        <StatCard icon="📆" title="Esta semana" value={thisWeek.length} color="#1E90FF" />
        <StatCard icon="📊" title="Total" value={records.length} color="#8B5CF6" />
      </div>

      {records.length === 0 ? (
        <div className="card card-glass"><div className="empty-state"><div className="empty-state-icon">📊</div><h3>Sin historial</h3><p className="text-muted">Tus servicios completados aparecerán acá</p></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {records.map((r, i) => (
            <motion.div key={r.id} className="card card-glass" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px' }}>
                <div style={{ color: 'var(--green)', fontSize: '1.2rem' }}>✅</div>
                <div style={{ flex: 1 }}>
                  <strong className="text-sm">{r.service?.name}</strong>
                  <p className="text-xs text-muted">👤 {r.user?.firstName} {r.user?.lastName} • 🚗 {r.vehicle?.brand} {r.vehicle?.model} ({r.vehicle?.licensePlate})</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p className="text-sm">{new Date(r.startTime).toLocaleDateString('es-PY')}</p>
                  <p className="text-xs text-muted">{new Date(r.startTime).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
