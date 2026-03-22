import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';

export default function BookAppointment() {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/services'), api.get('/vehicles')])
      .then(([sRes, vRes]) => { setServices(sRes.data.data || []); setVehicles(vRes.data.data || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadSlots = async (date) => {
    setSelectedDate(date);
    try {
      const end = new Date(date); end.setDate(end.getDate() + 1);
      const res = await api.get(`/appointments/available-slots?startDate=${date}&endDate=${end.toISOString().split('T')[0]}`);
      setSlots(res.data.data?.slots || res.data.data || []);
    } catch { setSlots([]); }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post('/appointments', {
        serviceId: selectedService.id,
        vehicleId: selectedVehicle.id,
        date: selectedDate,
        startTime: selectedSlot,
        notes,
      });
      toast.success('¡Turno agendado exitosamente!');
      setTimeout(() => window.location.href = '/client/appointments', 1500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al agendar');
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const today = new Date().toISOString().split('T')[0];
  const steps = ['Servicio', 'Vehículo', 'Fecha y Hora', 'Confirmar'];

  return (
    <div className="page-content">
      <PageHeader title="📅 Agendar Turno" subtitle="Elegí tu servicio, vehículo y horario" />

      {/* Step Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px', justifyContent: 'center' }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <motion.div
              style={{
                width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step > i + 1 ? 'var(--green)' : step === i + 1 ? 'var(--gradient-agua)' : 'var(--bg-secondary)',
                border: '2px solid', borderColor: step >= i + 1 ? 'transparent' : 'var(--border)',
                color: step >= i + 1 ? 'white' : 'var(--text-muted)',
                fontSize: '0.8rem', fontWeight: 700,
              }}
              animate={{ scale: step === i + 1 ? 1.1 : 1 }}
            >
              {step > i + 1 ? '✓' : i + 1}
            </motion.div>
            <span className="text-sm" style={{ color: step === i + 1 ? 'var(--text-primary)' : 'var(--text-muted)', display: 'none' }}>{s}</span>
            {i < steps.length - 1 && <div style={{ width: '40px', height: '2px', background: step > i + 1 ? 'var(--green)' : 'var(--border)' }} />}
          </div>
        ))}
      </div>

      {/* Step 1: Service */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 style={{ marginBottom: '16px' }}>✨ Elegí un servicio</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {services.filter(s => s.isActive).map(s => (
              <motion.div key={s.id} className="card card-glass" whileHover={{ y: -4 }} style={{ cursor: 'pointer', borderColor: selectedService?.id === s.id ? 'var(--cyan)' : undefined }} onClick={() => { setSelectedService(s); setStep(2); }}>
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3>{s.name}</h3>
                    <span className="badge badge-info">{s.durationMinutes} min</span>
                  </div>
                  <p className="text-sm text-muted">{s.description}</p>
                  {s.basePriceGs > 0 && <p style={{ marginTop: '8px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--cyan)' }}>₲{s.basePriceGs.toLocaleString()}</p>}
                  {!s.isAddon && <span className="badge badge-success" style={{ marginTop: '8px' }}>Incluido en tu plan</span>}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Step 2: Vehicle */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 style={{ marginBottom: '16px' }}>🚗 Elegí tu vehículo</h2>
          {vehicles.length === 0 ? (
            <EmptyState icon="🚗" title="Sin vehículos" message="Primero registrá tu vehículo" action="Agregar Vehículo" onAction={() => window.location.href = '/client/vehicles'} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {vehicles.map(v => (
                <motion.div key={v.id} className="card card-glass" whileHover={{ y: -4 }} style={{ cursor: 'pointer', borderColor: selectedVehicle?.id === v.id ? 'var(--cyan)' : undefined }} onClick={() => { setSelectedVehicle(v); setStep(3); }}>
                  <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '2rem' }}>🚗</div>
                    <div>
                      <h3>{v.brand} {v.model}</h3>
                      <p className="text-sm text-muted">{v.year} • {v.color} • {v.licensePlate}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          <button className="btn btn-ghost" onClick={() => setStep(1)} style={{ marginTop: '16px' }}>← Volver</button>
        </motion.div>
      )}

      {/* Step 3: Date & Time */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 style={{ marginBottom: '16px' }}>📅 Elegí fecha y hora</h2>
          <div className="form-group">
            <label className="form-label">Fecha</label>
            <input type="date" className="form-input" min={today} value={selectedDate} onChange={(e) => loadSlots(e.target.value)} style={{ maxWidth: '300px' }} />
          </div>
          {selectedDate && (
            <div style={{ marginTop: '16px' }}>
              <p className="form-label">Horarios disponibles</p>
              {slots.length > 0 ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {slots.map(slot => {
                    const t = typeof slot === 'string' ? slot : slot.startTime;
                    const label = new Date(t).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <motion.button key={t} className={`btn ${selectedSlot === t ? 'btn-primary' : 'btn-outline'}`} whileHover={{ scale: 1.05 }} onClick={() => setSelectedSlot(t)}>
                        {label}
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted">No hay horarios disponibles para esta fecha. Probá otro día.</p>
              )}
            </div>
          )}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">Notas adicionales (opcional)</label>
            <textarea className="form-input" placeholder="Ej: Llego 5 min tarde, lavar solo exterior..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>← Volver</button>
            <button className="btn btn-primary" disabled={!selectedSlot} onClick={() => setStep(4)}>Continuar →</button>
          </div>
        </motion.div>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <h2 style={{ marginBottom: '16px' }}>✅ Confirmar Turno</h2>
          <div className="card card-glass">
            <div className="card-body" style={{ padding: '28px' }}>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div><p className="text-xs text-muted">Servicio</p><p style={{ fontWeight: 600, fontSize: '1.1rem' }}>{selectedService?.name}</p></div>
                <div><p className="text-xs text-muted">Vehículo</p><p style={{ fontWeight: 600 }}>{selectedVehicle?.brand} {selectedVehicle?.model} — {selectedVehicle?.licensePlate}</p></div>
                <div><p className="text-xs text-muted">Fecha y hora</p><p style={{ fontWeight: 600 }}>{new Date(selectedSlot).toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long' })} a las {new Date(selectedSlot).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</p></div>
                <div><p className="text-xs text-muted">Duración estimada</p><p style={{ fontWeight: 600 }}>{selectedService?.durationMinutes} minutos</p></div>
                {notes && <div><p className="text-xs text-muted">Notas</p><p>{notes}</p></div>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button className="btn btn-ghost" onClick={() => setStep(3)}>← Volver</button>
            <motion.button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={handleSubmit} disabled={submitting} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              {submitting ? <span className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : '📅 Confirmar Turno'}
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
