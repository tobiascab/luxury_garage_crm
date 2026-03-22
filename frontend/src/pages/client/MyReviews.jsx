import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import toast from 'react-hot-toast';

export default function MyReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rating: 5, comment: '' });
  const [pendingServices, setPendingServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/reviews/my'),
      api.get('/appointments?status=COMPLETED&noReview=true').catch(() => ({ data: { data: [] } }))
    ]).then(([rr, pr]) => { setReviews(rr.data.data || []); setPendingServices(pr.data.data || []); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedService) return toast.error('Seleccioná un servicio');
    try {
      await api.post('/reviews', { serviceRecordId: selectedService.id, rating: form.rating, comment: form.comment });
      toast.success('¡Gracias por tu calificación!');
      setShowForm(false); setForm({ rating: 5, comment: '' }); setSelectedService(null);
      const rr = await api.get('/reviews/my'); setReviews(rr.data.data || []);
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  return (
    <div className="page-content">
      <PageHeader title="⭐ Mis Calificaciones" subtitle={`${reviews.length} reseñas`}
        actions={pendingServices.length > 0 ? <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Calificar Servicio</button> : null} />

      {/* Write Review */}
      {showForm && (
        <motion.div className="card card-glass" style={{ marginBottom: '24px' }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="card-header"><h3>✍️ Nueva Calificación</h3></div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              {pendingServices.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Servicio a calificar</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pendingServices.slice(0, 5).map(s => (
                      <div key={s.id} onClick={() => setSelectedService(s)} style={{ padding: '12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${selectedService?.id === s.id ? 'var(--cyan)' : 'var(--border)'}`, cursor: 'pointer', background: selectedService?.id === s.id ? 'var(--cyan-glow)' : 'transparent' }}>
                        <strong className="text-sm">{s.service?.name}</strong>
                        <span className="text-xs text-muted" style={{ marginLeft: '8px' }}>{new Date(s.startTime).toLocaleDateString('es-PY')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Calificación</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <motion.button key={star} type="button" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => setForm({ ...form, rating: star })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '2rem', color: star <= form.rating ? 'var(--gold)' : 'var(--text-muted)', transition: 'color 0.2s' }}>
                      ★
                    </motion.button>
                  ))}
                </div>
              </div>
              <div className="form-group"><label className="form-label">Comentario (opcional)</label><textarea className="form-input" value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} rows={3} placeholder="Contanos tu experiencia..." style={{ resize: 'vertical' }} /></div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Enviar Calificación</button>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      {/* Past reviews */}
      {reviews.length === 0 ? (
        <div className="card card-glass"><div className="empty-state"><div className="empty-state-icon">⭐</div><h3>Sin calificaciones</h3><p className="text-muted">Después de cada servicio podrás dejar tu opinión</p></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reviews.map((r, i) => (
            <motion.div key={r.id} className="card card-glass" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <div className="card-body" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <strong className="text-sm">{r.serviceRecord?.service?.name || 'Servicio'}</strong>
                    <span className="text-xs text-muted" style={{ marginLeft: '8px' }}>{new Date(r.createdAt).toLocaleDateString('es-PY')}</span>
                  </div>
                  <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '2px' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                </div>
                {r.comment && <p className="text-sm" style={{ marginTop: '6px' }}>{r.comment}</p>}
                {r.adminResponse && (
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '10px', marginTop: '10px', borderLeft: '3px solid var(--blue)' }}>
                    <p className="text-xs text-muted">💬 Respuesta de Luxury Garage:</p>
                    <p className="text-sm">{r.adminResponse}</p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
