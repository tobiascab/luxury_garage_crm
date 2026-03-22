import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';

export default function MyMembership() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const membership = user?.memberships?.[0];
  const currentPlan = membership?.plan;

  useEffect(() => {
    api.get('/plans').then(res => setPlans(res.data.data || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  return (
    <div className="page-content">
      <PageHeader title="👑 Mi Membresía" subtitle="Gestioná tu plan y beneficios" />

      {membership ? (
        <motion.div className="card card-glass" style={{ marginBottom: '24px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="card-body" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div className="membership-plan-name" style={{ background: currentPlan?.name === 'VIP' ? 'var(--gradient-gold)' : currentPlan?.name === 'Premium' ? 'var(--gradient-purple)' : 'var(--gradient-agua)', fontSize: '1.2rem', padding: '10px 28px' }}>
                {currentPlan?.name} {currentPlan?.name === 'VIP' ? '👑' : currentPlan?.name === 'Premium' ? '💎' : '⭐'}
              </div>
              <StatusBadge status={membership.status} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div><p className="text-xs text-muted">Precio mensual</p><p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem' }}>₲{currentPlan?.priceGs?.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted">Fecha inicio</p><p style={{ fontWeight: 600 }}>{new Date(membership.startDate).toLocaleDateString('es-PY')}</p></div>
              <div><p className="text-xs text-muted">Próxima renovación</p><p style={{ fontWeight: 600 }}>{new Date(membership.endDate).toLocaleDateString('es-PY')}</p></div>
              <div><p className="text-xs text-muted">Descuento extras</p><p style={{ fontWeight: 600, color: 'var(--green)' }}>{currentPlan?.discountPercent || 0}%</p></div>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="card card-glass" style={{ marginBottom: '24px' }}>
          <div className="card-body" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ fontSize: '3rem', marginBottom: '12px' }}>👑</p>
            <h3>No tenés membresía activa</h3>
            <p className="text-muted" style={{ marginBottom: '20px' }}>Elegí un plan para empezar a disfrutar</p>
          </div>
        </div>
      )}

      <h2 style={{ marginBottom: '16px' }}>📋 Planes Disponibles</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {plans.filter(p => p.isActive).map((p, i) => (
          <motion.div
            key={p.id}
            className="card card-glass"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -6, boxShadow: p.name === 'VIP' ? '0 12px 40px rgba(245,158,11,0.2)' : p.name === 'Premium' ? '0 12px 40px rgba(139,92,246,0.2)' : '0 12px 40px rgba(30,144,255,0.2)' }}
            style={{ borderColor: currentPlan?.id === p.id ? 'var(--cyan)' : undefined }}
          >
            <div className="card-body" style={{ padding: '28px', textAlign: 'center' }}>
              <div className="membership-plan-name" style={{ background: p.name === 'VIP' ? 'var(--gradient-gold)' : p.name === 'Premium' ? 'var(--gradient-purple)' : 'var(--gradient-agua)', marginBottom: '16px' }}>
                {p.name}
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, marginBottom: '4px' }}>₲{p.priceGs?.toLocaleString()}</p>
              <p className="text-muted text-sm" style={{ marginBottom: '20px' }}>/mes</p>
              <p className="text-sm" style={{ marginBottom: '16px', lineHeight: '1.8' }}>{p.description}</p>
              {currentPlan?.id === p.id ? (
                <span className="badge badge-success" style={{ fontSize: '0.8rem', padding: '6px 16px' }}>✅ Tu plan actual</span>
              ) : (
                <button className="btn btn-outline" style={{ width: '100%' }}>
                  {currentPlan && p.priceGs > currentPlan.priceGs ? 'Upgrade' : 'Elegir Plan'}
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
