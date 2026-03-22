import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import toast from 'react-hot-toast';

export default function ActiveService() {
  const { user } = useAuth();
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [timer, setTimer] = useState(0);

  useEffect(() => { loadActive(); }, []);

  useEffect(() => {
    if (!active) return;
    const started = new Date(active.serviceRecord?.startedAt || active.startTime);
    const interval = setInterval(() => {
      setTimer(Math.floor((Date.now() - started.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);

  const loadActive = async () => {
    try {
      const res = await api.get(`/appointments?status=IN_PROGRESS&assignedTo=${user?.id}`);
      const current = (res.data.data || [])[0] || null;
      setActive(current);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const complete = async () => {
    if (!active) return;
    try {
      await api.post(`/appointments/${active.id}/complete`, { notes });
      toast.success('✅ ¡Servicio completado!');
      setActive(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  if (!active) return (
    <div className="page-content">
      <PageHeader title="🔧 Servicio Activo" />
      <div className="card card-glass"><div className="empty-state"><div className="empty-state-icon">🔧</div><h3>Sin servicio activo</h3><p className="text-muted">Iniciá un servicio desde tu agenda para verlo acá</p><a href="/employee" className="btn btn-primary" style={{ marginTop: '12px' }}>Ir a mi agenda</a></div></div>
    </div>
  );

  const estimated = active.service?.durationMinutes || 30;
  const progress = Math.min(100, (timer / 60 / estimated) * 100);

  return (
    <div className="page-content">
      <PageHeader title="🔧 Servicio en Proceso" />

      <motion.div className="card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(30,144,255,0.04))', border: '1px solid rgba(0,212,255,0.25)', marginBottom: '20px' }}>
        <div className="card-body" style={{ padding: '32px', textAlign: 'center' }}>
          {/* Timer */}
          <div style={{ marginBottom: '24px' }}>
            <p className="text-sm text-muted" style={{ marginBottom: '8px' }}>Tiempo transcurrido</p>
            <motion.div
              style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', fontWeight: 900, color: progress > 100 ? 'var(--red)' : 'var(--cyan)' }}
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {formatTime(timer)}
            </motion.div>
            <p className="text-xs text-muted">Estimado: {estimated} min</p>
          </div>

          {/* Progress bar */}
          <div style={{ maxWidth: '400px', margin: '0 auto 24px' }}>
            <div className="progress-bar" style={{ height: '8px' }}>
              <motion.div
                className="progress-fill"
                style={{ width: `${progress}%`, background: progress > 100 ? 'var(--red)' : 'var(--gradient-agua)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-xs text-muted" style={{ marginTop: '6px' }}>{progress.toFixed(0)}% completado</p>
          </div>

          {/* Service Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
            <div><p className="text-xs text-muted">Servicio</p><p style={{ fontWeight: 600 }}>{active.service?.name}</p></div>
            <div><p className="text-xs text-muted">Cliente</p><p style={{ fontWeight: 600 }}>{active.user?.firstName} {active.user?.lastName}</p></div>
            <div><p className="text-xs text-muted">Vehículo</p><p style={{ fontWeight: 600 }}>{active.vehicle?.brand} {active.vehicle?.model}</p></div>
            <div><p className="text-xs text-muted">Placa</p><p style={{ fontWeight: 600, color: 'var(--cyan)', fontFamily: 'var(--font-display)' }}>{active.vehicle?.licensePlate}</p></div>
          </div>

          {/* Vehicle notes */}
          {active.vehicle?.notes && (
            <div style={{ background: 'var(--gold-glow)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', padding: '12px', marginTop: '20px', maxWidth: '400px', margin: '20px auto 0', textAlign: 'left' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 700 }}>⚠️ Notas del vehículo:</p>
              <p className="text-sm">{active.vehicle.notes}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Completion */}
      <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="card-header"><h3>✅ Finalizar Servicio</h3></div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Observaciones del servicio</label>
            <textarea className="form-input" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Ej: Se encontró rayón nuevo en puerta trasera derecha. Se aplicó cera extra en el capó." style={{ resize: 'vertical' }} />
          </div>
          <motion.button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={complete} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            ✅ Completar Servicio
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
