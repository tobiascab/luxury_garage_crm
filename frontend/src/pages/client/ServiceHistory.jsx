import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import StatCard from '../../components/StatCard';

export default function ServiceHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const res = await api.get('/appointments?status=COMPLETED');
      setRecords(res.data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const thisMonth = records.filter(r => { const d = new Date(r.startTime); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const totalSpent = records.reduce((s, r) => s + (r.service?.basePriceGs || 0), 0);

  const filtered = filter === 'all' ? records : records.filter(r => {
    const d = new Date(r.startTime); const now = new Date();
    if (filter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (filter === '3months') { const three = new Date(); three.setMonth(three.getMonth() - 3); return d >= three; }
    return true;
  });

  return (
    <div className="page-content">
      <PageHeader title="📋 Historial de Servicios" subtitle={`${records.length} servicios realizados`} />

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <StatCard icon="🚿" title="Total de lavados" value={records.length} color="#1E90FF" />
        <StatCard icon="📅" title="Este mes" value={thisMonth.length} color="#00D4FF" />
        <StatCard icon="💰" title="Invertido total" value={`₲${totalSpent.toLocaleString()}`} color="#10B981" />
      </div>

      <div className="tabs" style={{ marginBottom: '20px' }}>
        <button className={`tab-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todos</button>
        <button className={`tab-btn ${filter === 'month' ? 'active' : ''}`} onClick={() => setFilter('month')}>Este mes</button>
        <button className={`tab-btn ${filter === '3months' ? 'active' : ''}`} onClick={() => setFilter('3months')}>Últimos 3 meses</button>
      </div>

      {filtered.length === 0 ? (
        <div className="card card-glass"><div className="empty-state"><div className="empty-state-icon">📋</div><h3>Sin historial</h3><p className="text-muted">Todavía no tenés servicios completados</p></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((r, i) => (
            <motion.div key={r.id} className="card card-glass" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', padding: '16px 20px' }}>
                <div className="appointment-date" style={{ background: 'var(--gradient-agua)' }}>
                  <span className="day">{new Date(r.startTime).getDate()}</span>
                  <span className="month">{new Date(r.startTime).toLocaleDateString('es-PY', { month: 'short' })}</span>
                </div>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <strong>{r.service?.name}</strong>
                  <p className="text-sm text-muted">🚗 {r.vehicle?.brand} {r.vehicle?.model} • {r.vehicle?.licensePlate}</p>
                  <p className="text-xs text-muted">
                    {new Date(r.startTime).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                    {r.endTime && ` — ${new Date(r.endTime).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <StatusBadge status="COMPLETED" />
                  {r.service?.basePriceGs > 0 && (
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--cyan)', marginTop: '4px' }}>₲{r.service.basePriceGs.toLocaleString()}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
