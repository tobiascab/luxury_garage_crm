import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';

export default function AppointmentsCalendar() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [view, setView] = useState('day');

  useEffect(() => { loadAppointments(); }, [selectedDate]);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const start = new Date(selectedDate); start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate); end.setHours(23, 59, 59, 999);
      const res = await api.get(`/appointments?startDate=${start.toISOString()}&endDate=${end.toISOString()}`);
      setAppointments(res.data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 7);
  const dayAppointments = appointments.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const statusColors = { PENDING: 'var(--gold)', CONFIRMED: 'var(--blue)', IN_PROGRESS: 'var(--cyan)', COMPLETED: 'var(--green)', CANCELLED: 'var(--red)', NO_SHOW: 'var(--red)' };

  const changeDate = (offset) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="page-content">
      <PageHeader title="📅 Agenda de Turnos" subtitle={`${dayAppointments.length} turnos para ${new Date(selectedDate).toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long' })}`} />

      {/* Date Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button className="btn btn-outline btn-sm" onClick={() => changeDate(-1)}>← Anterior</button>
        <input type="date" className="form-input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ width: '180px' }} />
        <button className="btn btn-outline btn-sm" onClick={() => changeDate(1)}>Siguiente →</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}>Hoy</button>
      </div>

      {loading ? <div className="page-loading"><div className="loading-spinner" /></div> : (
        <div className="card card-glass" style={{ overflow: 'hidden' }}>
          {/* Timeline view */}
          <div style={{ position: 'relative', minHeight: '500px' }}>
            {hours.map(h => (
              <div key={h} style={{ display: 'flex', borderBottom: '1px solid var(--border)', minHeight: '60px' }}>
                <div style={{ width: '60px', padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, borderRight: '1px solid var(--border)', flexShrink: 0 }}>
                  {String(h).padStart(2, '0')}:00
                </div>
                <div style={{ flex: 1, padding: '4px 8px', position: 'relative', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {dayAppointments.filter(a => new Date(a.startTime).getHours() === h).map((a, i) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      style={{
                        background: `${statusColors[a.status] || 'var(--blue)'}15`,
                        border: `1px solid ${statusColors[a.status] || 'var(--blue)'}40`,
                        borderLeft: `3px solid ${statusColors[a.status] || 'var(--blue)'}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 12px',
                        fontSize: '0.8rem',
                        flex: '1 1 200px',
                        maxWidth: '300px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong>{new Date(a.startTime).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</strong>
                        <StatusBadge status={a.status} />
                      </div>
                      <p style={{ fontWeight: 600 }}>{a.service?.name}</p>
                      <p className="text-xs text-muted">
                        👤 {a.user?.firstName} {a.user?.lastName} • 🚗 {a.vehicle?.brand} {a.vehicle?.model}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
