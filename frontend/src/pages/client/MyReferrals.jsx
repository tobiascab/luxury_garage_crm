import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import toast from 'react-hot-toast';

export default function MyReferrals() {
  const [data, setData] = useState({ referrals: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/referrals'), api.get('/referrals/stats').catch(() => ({ data: { data: {} } }))])
      .then(([rRes, sRes]) => setData({ referrals: rRes.data.data || [], stats: sRes.data.data || {} }))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const referralLink = `https://luxurygaraje.arizzar-ia.cloud/?ref=${btoa(String(Date.now()))}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  return (
    <div className="page-content">
      <PageHeader title="🎁 Mis Referidos" subtitle="Invitá amigos y ganá créditos" />

      <motion.div className="card card-glass" style={{ marginBottom: '24px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="card-body" style={{ textAlign: 'center', padding: '32px' }}>
          <h2 style={{ marginBottom: '8px' }}>🎁 Invitá y ganá</h2>
          <p className="text-muted" style={{ marginBottom: '20px' }}>Por cada amigo que compre una membresía, ganás lavados gratis y créditos</p>
          <div style={{ display: 'flex', gap: '8px', maxWidth: '500px', margin: '0 auto' }}>
            <input className="form-input" value={referralLink} readOnly style={{ fontSize: '0.8rem', textOverflow: 'ellipsis' }} />
            <motion.button className="btn btn-primary" onClick={copyLink} whileTap={{ scale: 0.95 }}>
              {copied ? '✅ Copiado' : '📋 Copiar'}
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card"><div className="stat-card-value">{data.stats.totalInvited || 0}</div><div className="stat-card-title">Invitados</div></div>
        <div className="stat-card"><div className="stat-card-value">{data.stats.totalConverted || 0}</div><div className="stat-card-title">Compraron</div></div>
        <div className="stat-card"><div className="stat-card-value" style={{ color: 'var(--green)' }}>₲{(data.stats.totalEarned || 0).toLocaleString()}</div><div className="stat-card-title">Créditos ganados</div></div>
      </div>

      {data.referrals.length > 0 && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Invitado</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>
              {data.referrals.map(r => (
                <tr key={r.id}>
                  <td>{r.referredEmail || r.referredPhone}</td>
                  <td><span className={`badge ${r.status === 'PURCHASED' ? 'badge-success' : r.status === 'REGISTERED' ? 'badge-info' : 'badge-default'}`}>{r.status === 'PURCHASED' ? '✅ Compró' : r.status === 'REGISTERED' ? '📝 Registrado' : '📨 Invitado'}</span></td>
                  <td className="text-sm text-muted">{new Date(r.createdAt).toLocaleDateString('es-PY')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
