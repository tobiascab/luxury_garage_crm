import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';

export default function LeadsManager() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/referrals/all').then(r => setLeads(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const invited = leads.filter(l => l.status === 'INVITED');
  const registered = leads.filter(l => l.status === 'REGISTERED');
  const purchased = leads.filter(l => l.status === 'PURCHASED');
  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter);

  return (
    <div className="page-content">
      <PageHeader title="🎯 Leads / Prospectos" subtitle="Seguimiento de referidos y prospectos" />

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <StatCard icon="📨" title="Invitados" value={invited.length} color="#64748B" />
        <StatCard icon="📝" title="Registrados" value={registered.length} color="#1E90FF" />
        <StatCard icon="✅" title="Compraron" value={purchased.length} color="#10B981" />
        <StatCard icon="📊" title="Conversión" value={leads.length > 0 ? `${((purchased.length / leads.length) * 100).toFixed(0)}%` : '0%'} color="#F59E0B" />
      </div>

      <div className="tabs" style={{ marginBottom: '16px' }}>
        <button className={`tab-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todos ({leads.length})</button>
        <button className={`tab-btn ${filter === 'INVITED' ? 'active' : ''}`} onClick={() => setFilter('INVITED')}>Invitados ({invited.length})</button>
        <button className={`tab-btn ${filter === 'REGISTERED' ? 'active' : ''}`} onClick={() => setFilter('REGISTERED')}>Registrados ({registered.length})</button>
        <button className={`tab-btn ${filter === 'PURCHASED' ? 'active' : ''}`} onClick={() => setFilter('PURCHASED')}>Convertidos ({purchased.length})</button>
      </div>

      {filtered.length === 0 ? (
        <div className="card card-glass"><div className="empty-state"><div className="empty-state-icon">🎯</div><h3>Sin leads</h3><p className="text-muted">Los referidos de tus clientes aparecerán acá</p></div></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Contacto</th><th>Referido por</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>
              {filtered.map((l, i) => (
                <motion.tr key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                  <td><strong className="text-sm">{l.referredEmail || l.referredPhone || '—'}</strong></td>
                  <td className="text-sm">{l.referrer ? `${l.referrer.firstName} ${l.referrer.lastName}` : '—'}</td>
                  <td>
                    <span className={`badge ${l.status === 'PURCHASED' ? 'badge-success' : l.status === 'REGISTERED' ? 'badge-info' : 'badge-default'}`}>
                      {l.status === 'PURCHASED' ? '✅ Compró' : l.status === 'REGISTERED' ? '📝 Registrado' : '📨 Invitado'}
                    </span>
                  </td>
                  <td className="text-sm text-muted">{new Date(l.createdAt).toLocaleDateString('es-PY')}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
