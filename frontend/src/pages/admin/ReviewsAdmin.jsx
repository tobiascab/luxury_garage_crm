import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';

export default function ReviewsAdmin() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/reviews').then(r => setReviews(r.data.data || [])).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const avg = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';

  return (
    <div className="page-content">
      <PageHeader title="⭐ Reseñas" subtitle={`${reviews.length} reseñas · Promedio: ${avg}★`} />

      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        {[5, 4, 3, 2, 1].map(star => {
          const count = reviews.filter(r => r.rating === star).length;
          const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
          return (
            <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="text-sm" style={{ width: '30px' }}>{star}★</span>
              <div style={{ flex: 1, height: '8px', background: 'var(--bg-secondary)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: star >= 4 ? 'var(--green)' : star === 3 ? 'var(--gold)' : 'var(--red)', borderRadius: '10px', transition: 'width 0.5s' }} />
              </div>
              <span className="text-xs text-muted" style={{ width: '30px' }}>{count}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {reviews.map((r, i) => (
          <motion.div key={r.id} className="card card-glass" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient-agua)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', color: 'white' }}>
                    {r.user?.firstName?.[0]}{r.user?.lastName?.[0]}
                  </div>
                  <div>
                    <strong className="text-sm">{r.user?.firstName} {r.user?.lastName}</strong>
                    <p className="text-xs text-muted">{r.serviceRecord?.service?.name}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', fontWeight: 800 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  <span className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString('es-PY')}</span>
                </div>
              </div>
              {r.comment && <p className="text-sm" style={{ marginTop: '8px' }}>{r.comment}</p>}
              {r.adminResponse && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '10px', marginTop: '8px', borderLeft: '3px solid var(--blue)' }}>
                  <p className="text-xs text-muted" style={{ marginBottom: '2px' }}>Respuesta del admin:</p>
                  <p className="text-sm">{r.adminResponse}</p>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
