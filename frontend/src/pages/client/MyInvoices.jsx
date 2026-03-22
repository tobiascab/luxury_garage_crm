import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';

export default function MyInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/payments').then(r => setInvoices(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const statusConfig = { PAID: { label: 'Pagado', color: 'var(--green)', icon: '✅' }, PENDING: { label: 'Pendiente', color: 'var(--gold)', icon: '⏳' }, FAILED: { label: 'Fallido', color: 'var(--red)', icon: '❌' }, REFUNDED: { label: 'Reembolsado', color: 'var(--purple)', icon: '↩️' } };

  return (
    <div className="page-content">
      <PageHeader title="🧾 Mis Facturas" subtitle={`${invoices.length} comprobantes`} />

      {invoices.length === 0 ? (
        <div className="card card-glass"><div className="empty-state"><div className="empty-state-icon">🧾</div><h3>Sin facturas</h3><p className="text-muted">Acá verás tus comprobantes de pago</p></div></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Método</th><th>Estado</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead>
            <tbody>
              {invoices.map((inv, i) => {
                const cfg = statusConfig[inv.status] || statusConfig.PENDING;
                return (
                  <motion.tr key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                    <td className="text-sm">{new Date(inv.createdAt).toLocaleDateString('es-PY')}</td>
                    <td>
                      <div>
                        <strong className="text-sm">{inv.concept || inv.membership?.plan?.name || 'Pago'}</strong>
                        {inv.arizarInvoiceId && <p className="text-xs text-muted">Factura: {inv.arizarInvoiceId.slice(0, 8)}...</p>}
                      </div>
                    </td>
                    <td className="text-sm">{inv.method === 'CARD' ? '💳 Tarjeta' : inv.method === 'CASH' ? '💵 Efectivo' : inv.method === 'TRANSFER' ? '🏦 Transferencia' : inv.method || '—'}</td>
                    <td><span className="badge" style={{ background: `${cfg.color}15`, color: cfg.color }}>{cfg.icon} {cfg.label}</span></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem' }}>₲{(inv.amountGs || 0).toLocaleString()}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
