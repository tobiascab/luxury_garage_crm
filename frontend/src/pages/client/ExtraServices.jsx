import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import toast from 'react-hot-toast';

export default function ExtraServices() {
  const [services, setServices] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/services'), api.get('/vehicles')])
      .then(([sRes, vRes]) => { setServices(sRes.data.data || []); setVehicles(vRes.data.data || []); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const addons = services.filter(s => s.isAddon && s.isActive);
  const extras = services.filter(s => !s.isAddon && s.basePriceGs > 0 && s.isActive);

  return (
    <div className="page-content">
      <PageHeader title="✨ Servicios Extra" subtitle="Complementá tu lavado con servicios adicionales" />

      {/* Addon Services */}
      {addons.length > 0 && (
        <>
          <h2 style={{ marginBottom: '16px' }}>🔧 Servicios Adicionales</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {addons.map((s, i) => (
              <motion.div key={s.id} className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
                <div className="card-body" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h3>{s.name}</h3>
                    <span className="badge badge-warning">Addon</span>
                  </div>
                  <p className="text-sm text-muted" style={{ marginBottom: '16px', minHeight: '40px' }}>{s.description}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span className="text-sm">⏱️ {s.durationMinutes} min</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', color: 'var(--cyan)' }}>₲{s.basePriceGs?.toLocaleString()}</span>
                  </div>
                  <a href="/client/book" className="btn btn-primary" style={{ width: '100%', textAlign: 'center' }}>Agendar →</a>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Premium Services */}
      {extras.length > 0 && (
        <>
          <h2 style={{ marginBottom: '16px' }}>💎 Servicios Premium</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {extras.map((s, i) => (
              <motion.div key={s.id} className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}>
                <div style={{ height: '3px', background: 'var(--gradient-purple)' }} />
                <div className="card-body" style={{ padding: '24px' }}>
                  <h3 style={{ marginBottom: '8px' }}>{s.name}</h3>
                  <p className="text-sm text-muted" style={{ marginBottom: '16px' }}>{s.description}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span className="text-sm">⏱️ {s.durationMinutes} min</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', color: 'var(--purple)' }}>₲{s.basePriceGs?.toLocaleString()}</span>
                  </div>
                  <a href="/client/book" className="btn btn-outline" style={{ width: '100%', textAlign: 'center' }}>Agendar →</a>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {addons.length === 0 && extras.length === 0 && (
        <div className="card card-glass"><div className="empty-state"><div className="empty-state-icon">✨</div><h3>Sin servicios extra disponibles</h3><p className="text-muted">Todos los servicios están incluidos en tu plan</p></div></div>
      )}
    </div>
  );
}
