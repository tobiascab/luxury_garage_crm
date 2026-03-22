import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';

export default function ServicesManager() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', category: 'STANDARD', durationMinutes: 30, basePriceGs: 0, isAddon: false, isActive: true });

  useEffect(() => { loadServices(); }, []);

  const loadServices = async () => {
    try { const res = await api.get('/services'); setServices(res.data.data || []); } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/services/${editing.id}`, form); toast.success('Servicio actualizado'); }
      else { await api.post('/services', form); toast.success('Servicio creado'); }
      setShowModal(false); setEditing(null); loadServices();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description || '', category: s.category || 'STANDARD', durationMinutes: s.durationMinutes, basePriceGs: s.basePriceGs || 0, isAddon: s.isAddon, isActive: s.isActive });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este servicio?')) return;
    try { await api.delete(`/services/${id}`); toast.success('Eliminado'); loadServices(); } catch (e) { toast.error('Error'); }
  };

  const categories = { STANDARD: { label: 'Estándar', color: 'var(--blue)' }, PREMIUM: { label: 'Premium', color: 'var(--purple)' }, VIP: { label: 'VIP', color: 'var(--gold)' }, ADDON: { label: 'Adicional', color: 'var(--cyan)' } };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  return (
    <div className="page-content">
      <PageHeader title="✨ Gestión de Servicios" subtitle={`${services.length} servicios configurados`}
        actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: '', description: '', category: 'STANDARD', durationMinutes: 30, basePriceGs: 0, isAddon: false, isActive: true }); setShowModal(true); }}>+ Nuevo Servicio</button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {services.map((s, i) => (
          <motion.div key={s.id} className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            style={{ opacity: s.isActive ? 1 : 0.5, borderColor: !s.isActive ? 'var(--red-glow)' : undefined }}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ marginBottom: '4px' }}>{s.name}</h3>
                  <span className="badge" style={{ background: `${categories[s.category]?.color}20`, color: categories[s.category]?.color }}>
                    {categories[s.category]?.label || s.category}
                  </span>
                </div>
                {!s.isActive && <span className="badge badge-danger">Inactivo</span>}
              </div>
              <p className="text-sm text-muted" style={{ marginBottom: '12px', minHeight: '40px' }}>{s.description || 'Sin descripción'}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="text-sm">⏱️ {s.durationMinutes} min</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: s.basePriceGs > 0 ? 'var(--cyan)' : 'var(--green)' }}>
                  {s.basePriceGs > 0 ? `₲${s.basePriceGs.toLocaleString()}` : 'Incluido'}
                </span>
              </div>
              {s.isAddon && <span className="badge badge-warning" style={{ marginBottom: '12px' }}>Servicio adicional</span>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)} style={{ flex: 1 }}>✏️ Editar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(s.id)} style={{ color: 'var(--red)' }}>🗑️</button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? '✏️ Editar Servicio' : '✨ Nuevo Servicio'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Lavado Exterior Express" /></div>
          <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ resize: 'vertical' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="STANDARD">Estándar</option>
                <option value="PREMIUM">Premium</option>
                <option value="VIP">VIP</option>
                <option value="ADDON">Adicional</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Duración (min)</label><input className="form-input" type="number" min={5} value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: parseInt(e.target.value) })} /></div>
          </div>
          <div className="form-group"><label className="form-label">Precio Gs (0 = incluido en plan)</label><input className="form-input" type="number" min={0} value={form.basePriceGs} onChange={e => setForm({ ...form, basePriceGs: parseInt(e.target.value) })} /></div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isAddon} onChange={e => setForm({ ...form, isAddon: e.target.checked })} /> Servicio adicional (se paga aparte)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Activo
            </label>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editing ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
