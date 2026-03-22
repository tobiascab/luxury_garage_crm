import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import Modal from '../../components/Modal';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';

export default function MyVehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ brand: '', model: '', year: new Date().getFullYear(), color: '', licensePlate: '', notes: '', isPrimary: false });

  useEffect(() => { loadVehicles(); }, []);

  const loadVehicles = async () => {
    try {
      const res = await api.get('/vehicles');
      setVehicles(res.data.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/vehicles/${editing.id}`, form);
        toast.success('Vehículo actualizado');
      } else {
        await api.post('/vehicles', form);
        toast.success('Vehículo agregado');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ brand: '', model: '', year: new Date().getFullYear(), color: '', licensePlate: '', notes: '', isPrimary: false });
      loadVehicles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar');
    }
  };

  const openEdit = (v) => {
    setEditing(v);
    setForm({ brand: v.brand, model: v.model, year: v.year, color: v.color, licensePlate: v.licensePlate, notes: v.notes || '', isPrimary: v.isPrimary });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este vehículo?')) return;
    try {
      await api.delete(`/vehicles/${id}`);
      toast.success('Vehículo eliminado');
      loadVehicles();
    } catch (err) { toast.error('Error al eliminar'); }
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  return (
    <div className="page-content">
      <PageHeader
        title="🚗 Mis Vehículos"
        subtitle="Registrá tus vehículos para agendar turnos más rápido"
        actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ brand: '', model: '', year: new Date().getFullYear(), color: '', licensePlate: '', notes: '', isPrimary: false }); setShowModal(true); }}>+ Agregar Vehículo</button>}
      />

      {vehicles.length === 0 ? (
        <EmptyState icon="🚗" title="Sin vehículos" message="Registrá tu vehículo para empezar a agendar turnos" action="Agregar Vehículo" onAction={() => setShowModal(true)} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {vehicles.map((v, i) => (
            <motion.div
              key={v.id}
              className="card card-glass"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
            >
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '2.5rem', width: '64px', height: '64px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    🚗
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: '2px' }}>{v.brand} {v.model}</h3>
                    <p className="text-muted text-sm">{v.year} • {v.color}</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--cyan)', fontSize: '1.1rem', letterSpacing: '1px' }}>{v.licensePlate}</p>
                  </div>
                  {v.isPrimary && <span className="badge badge-info">Principal</span>}
                </div>

                {v.notes && (
                  <div style={{ background: 'var(--gold-glow)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '16px' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 600, marginBottom: '2px' }}>📋 Notas de lavado:</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{v.notes}</p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(v)} style={{ flex: 1 }}>✏️ Editar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(v.id)} style={{ color: 'var(--red)' }}>🗑️</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? '✏️ Editar Vehículo' : '🚗 Agregar Vehículo'}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Marca *</label>
              <input className="form-input" placeholder="Toyota" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Modelo *</label>
              <input className="form-input" placeholder="Hilux" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Año *</label>
              <input className="form-input" type="number" min="1900" max="2030" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Color *</label>
              <input className="form-input" placeholder="Blanco" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Placa *</label>
            <input className="form-input" placeholder="ABC-123" value={form.licensePlate} onChange={(e) => setForm({ ...form, licensePlate: e.target.value.toUpperCase() })} required />
          </div>
          <div className="form-group">
            <label className="form-label">📋 Notas especiales para el lavado</label>
            <textarea className="form-input" placeholder="Ej: Rayón en puerta izquierda, cuidado con la antena, no usar productos abrasivos en el techo..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} style={{ resize: 'vertical' }} />
            <p className="text-xs text-muted" style={{ marginTop: '4px' }}>Indicá cualquier detalle que el lavador deba tener en cuenta</p>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" id="isPrimary" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
            <label htmlFor="isPrimary" className="form-label" style={{ margin: 0 }}>Vehículo principal</label>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editing ? 'Guardar Cambios' : 'Agregar Vehículo'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
