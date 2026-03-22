import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => { loadLogs(); }, [page, filterAction]);

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filterAction) params.set('action', filterAction);
      const res = await api.get(`/audit?${params}`);
      setLogs(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const actionIcons = { UPDATE_SETTINGS: '⚙️', SHOP_CHARGE: '💳', LOGIN: '🔑', CREATE: '➕', UPDATE: '✏️', DELETE: '🗑️' };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  return (
    <div className="page-content">
      <PageHeader title="📋 Logs del Sistema" subtitle="Historial de acciones" />

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <input className="form-input" placeholder="Filtrar por acción..." value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }} style={{ maxWidth: '300px' }} />
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalles</th></tr></thead>
          <tbody>
            {logs.map((log, i) => (
              <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                <td className="text-sm text-muted">{new Date(log.createdAt).toLocaleString('es-PY')}</td>
                <td className="text-sm">{log.user ? `${log.user.firstName} ${log.user.lastName}` : '—'}</td>
                <td><span className="badge badge-default">{actionIcons[log.action] || '📝'} {log.action}</span></td>
                <td className="text-sm">{log.entity || '—'}</td>
                <td className="text-xs text-muted" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details ? JSON.stringify(log.details).slice(0, 60) : '—'}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {pagination.totalPages > 1 && (
          <div className="pagination">
            <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
            <span className="text-sm text-muted">Página {page} de {pagination.totalPages}</span>
            <button className="pagination-btn" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>→</button>
          </div>
        )}
      </div>
    </div>
  );
}
