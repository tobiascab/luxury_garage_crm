import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';

export default function PlansManager() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', priceGs: 0, billingPeriod: 'MONTHLY', discountPercent: 0, isActive: true });

  useEffect(() => { loadPlans(); }, []);
  const loadPlans = async () => { try { const r = await api.get('/plans'); setPlans(r.data.data || []); } catch (e) { console.error(e); } setLoading(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/plans/${editing.id}`, form); toast.success('Plan actualizado'); }
      else { await api.post('/plans', form); toast.success('Plan creado'); }
      setShowModal(false); setEditing(null); loadPlans();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const openEdit = (p) => { setEditing(p); setForm({ name: p.name, description: p.description || '', priceGs: p.priceGs, billingPeriod: p.billingPeriod || 'MONTHLY', discountPercent: p.discountPercent || 0, isActive: p.isActive }); setShowModal(true); };

  const gradients = { 'Básico': 'var(--gradient-agua)', 'Premium': 'var(--gradient-purple)', 'VIP': 'var(--gradient-gold)' };
  const icons = { 'Básico': '⭐', 'Premium': '💎', 'VIP': '👑' };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  return (
    <div className="page-content">
      <PageHeader title="📋 Gestión de Planes" subtitle="Configurá los planes de membresía"
        actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: '', description: '', priceGs: 0, billingPeriod: 'MONTHLY', discountPercent: 0, isActive: true }); setShowModal(true); }}>+ Nuevo Plan</button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {plans.map((p, i) => (
          <motion.div key={p.id} className="card card-glass" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            whileHover={{ y: -8, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
            style={{ opacity: p.isActive ? 1 : 0.5, overflow: 'visible' }}>
            {/* Top gradient bar */}
            <div style={{ height: '4px', background: gradients[p.name] || 'var(--gradient-agua)', borderRadius: '16px 16px 0 0' }} />
            <div className="card-body" style={{ padding: '28px', textAlign: 'center' }}>
              <span style={{ fontSize: '2.5rem' }}>{icons[p.name] || '📋'}</span>
              <h2 style={{ marginTop: '12px', marginBottom: '4px' }}>{p.name}</h2>
              {!p.isActive && <span className="badge badge-danger">Inactivo</span>}
              <div style={{ margin: '20px 0' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 900 }}>₲{p.priceGs?.toLocaleString()}</span>
                <span className="text-muted" style={{ fontSize: '1rem' }}>/mes</span>
              </div>
              <p className="text-sm text-muted" style={{ minHeight: '48px', marginBottom: '16px' }}>{p.description}</p>
              {p.discountPercent > 0 && (
                <div style={{ background: 'var(--green-glow)', borderRadius: 'var(--radius-sm)', padding: '8px', marginBottom: '16px' }}>
                  <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: '0.85rem' }}>🏷️ {p.discountPercent}% descuento en extras</span>
                </div>
              )}
              <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => openEdit(p)}>✏️ Editar Plan</button>
            </div>
          </motion.div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? '✏️ Editar Plan' : '📋 Nuevo Plan'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">Nombre del Plan *</label><input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Premium" /></div>
          <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} style={{ resize: 'vertical' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group"><label className="form-label">Precio Gs/mes *</label><input className="form-input" type="number" min={0} required value={form.priceGs} onChange={e => setForm({ ...form, priceGs: parseInt(e.target.value) })} /></div>
            <div className="form-group"><label className="form-label">Descuento extras %</label><input className="form-input" type="number" min={0} max={100} value={form.discountPercent} onChange={e => setForm({ ...form, discountPercent: parseInt(e.target.value) })} /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Activo
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editing ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
