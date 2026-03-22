import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import toast from 'react-hot-toast';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [todayJobs, setTodayJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadToday(); }, []);

  const loadToday = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.get(`/appointments?date=${today}&assignedTo=${user?.id}`);
      setTodayJobs(res.data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const startService = async (appointmentId) => {
    try {
      await api.post(`/appointments/${appointmentId}/start`);
      toast.success('¡Servicio iniciado!');
      loadToday();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const completeService = async (appointmentId) => {
    try {
      await api.post(`/appointments/${appointmentId}/complete`);
      toast.success('✅ ¡Servicio completado!');
      loadToday();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const pending = todayJobs.filter(j => j.status === 'CONFIRMED' || j.status === 'PENDING');
  const inProgress = todayJobs.filter(j => j.status === 'IN_PROGRESS');
  const completed = todayJobs.filter(j => j.status === 'COMPLETED');

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <h1>📋 Mi Agenda</h1>
          <p className="text-muted">Hoy: {new Date().toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </motion.div>

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--gold)' }}>
          <div className="stat-card-value" style={{ color: 'var(--gold)' }}>{pending.length}</div>
          <div className="stat-card-title">Pendientes</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--cyan)' }}>
          <div className="stat-card-value" style={{ color: 'var(--cyan)' }}>{inProgress.length}</div>
          <div className="stat-card-title">En proceso</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--green)' }}>
          <div className="stat-card-value" style={{ color: 'var(--green)' }}>{completed.length}</div>
          <div className="stat-card-title">Completados</div>
        </div>
      </div>

      {/* In Progress - Highlight */}
      {inProgress.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '12px', color: 'var(--cyan)' }}>🔧 En Proceso</h2>
          {inProgress.map(job => (
            <motion.div key={job.id} className="card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(30,144,255,0.05))', border: '1px solid rgba(0,212,255,0.3)', marginBottom: '12px' }}>
              <div className="card-body" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3>{job.service?.name}</h3>
                  <StatusBadge status={job.status} />
                </div>
                <p className="text-sm">👤 {job.user?.firstName} {job.user?.lastName}</p>
                <p className="text-sm">🚗 {job.vehicle?.brand} {job.vehicle?.model} — <strong style={{ color: 'var(--cyan)' }}>{job.vehicle?.licensePlate}</strong></p>
                {job.vehicle?.notes && <p className="text-sm" style={{ color: 'var(--gold)', marginTop: '4px' }}>📋 {job.vehicle.notes}</p>}
                <motion.button className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }} whileTap={{ scale: 0.98 }} onClick={() => completeService(job.id)}>
                  ✅ Finalizar Servicio
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '12px' }}>⏳ Pendientes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pending.map((job, i) => (
              <motion.div key={job.id} className="card card-glass" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div className="appointment-date">
                    <span className="day">{new Date(job.startTime).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }).split(':')[0]}</span>
                    <span className="month">{new Date(job.startTime).toLocaleTimeString('es-PY', { minute: '2-digit' }).split(':')[1]?.replace(/[^\d]/g, '')}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong>{job.service?.name}</strong>
                    <p className="text-sm text-muted">👤 {job.user?.firstName} {job.user?.lastName} • 🚗 {job.vehicle?.brand} {job.vehicle?.model}</p>
                    {job.vehicle?.notes && <p className="text-xs" style={{ color: 'var(--gold)' }}>📋 {job.vehicle.notes}</p>}
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => startService(job.id)}>▶️ Iniciar</button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 style={{ marginBottom: '12px', color: 'var(--green)' }}>✅ Completados</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {completed.map(job => (
              <div key={job.id} className="card card-glass" style={{ opacity: 0.6 }}>
                <div className="card-body" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: 'var(--green)', fontSize: '1.2rem' }}>✅</span>
                  <div style={{ flex: 1 }}>
                    <strong className="text-sm">{job.service?.name}</strong>
                    <span className="text-xs text-muted" style={{ marginLeft: '8px' }}>{job.user?.firstName} — {job.vehicle?.licensePlate}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {todayJobs.length === 0 && (
        <div className="card card-glass">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>Sin turnos asignados hoy</h3>
            <p className="text-muted">Descansá o consultá con el admin</p>
          </div>
        </div>
      )}
    </div>
  );
}
