import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');

  useEffect(() => { loadAppointments(); }, []);

  const loadAppointments = async () => {
    try {
      const res = await api.get('/appointments');
      setAppointments(res.data.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleCancel = async (id) => {
    if (!confirm('¿Cancelar este turno?')) return;
    try {
      await api.delete(`/appointments/${id}`);
      toast.success('Turno cancelado. El slot fue liberado.');
      loadAppointments();
    } catch (err) { toast.error('Error al cancelar'); }
  };

  const now = new Date();
  const upcoming = appointments.filter(a => new Date(a.startTime) >= now && a.status !== 'CANCELLED' && a.status !== 'COMPLETED');
  const past = appointments.filter(a => new Date(a.startTime) < now || a.status === 'COMPLETED' || a.status === 'CANCELLED');
  const display = tab === 'upcoming' ? upcoming : past;

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  return (
    <div className="page-content">
      <PageHeader
        title="📅 Mis Turnos"
        subtitle={`${upcoming.length} turnos próximos`}
        actions={<a href="/client/book" className="btn btn-primary">+ Agendar Turno</a>}
      />

      <div className="tabs">
        <button className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
          Próximos ({upcoming.length})
        </button>
        <button className={`tab-btn ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>
          Historial ({past.length})
        </button>
      </div>

      {display.length === 0 ? (
        <EmptyState
          icon={tab === 'upcoming' ? '📅' : '📋'}
          title={tab === 'upcoming' ? 'Sin turnos programados' : 'Sin historial'}
          message={tab === 'upcoming' ? 'Agendá tu próximo lavado' : 'Acá vas a ver el historial de tus servicios'}
          action={tab === 'upcoming' ? 'Agendar Turno' : undefined}
          onAction={tab === 'upcoming' ? () => window.location.href = '/client/book' : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {display.map((a, i) => (
            <motion.div
              key={a.id}
              className="card card-glass"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                {/* Date badge */}
                <div className="appointment-date">
                  <span className="day">{new Date(a.startTime).getDate()}</span>
                  <span className="month">{new Date(a.startTime).toLocaleDateString('es-PY', { month: 'short' })}</span>
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <h3 style={{ marginBottom: '4px' }}>{a.service?.name}</h3>
                  <p className="text-sm text-muted">
                    🕐 {new Date(a.startTime).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                    {' — '}
                    {new Date(a.endTime).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-sm" style={{ marginTop: '4px' }}>
                    🚗 {a.vehicle?.brand} {a.vehicle?.model} • {a.vehicle?.licensePlate}
                  </p>
                  {a.notes && <p className="text-xs text-muted" style={{ marginTop: '4px' }}>💬 {a.notes}</p>}
                </div>

                {/* Status + Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <StatusBadge status={a.status} />
                  {tab === 'upcoming' && a.status !== 'CANCELLED' && (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => handleCancel(a.id)}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
