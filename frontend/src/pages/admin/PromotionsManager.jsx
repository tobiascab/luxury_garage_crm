import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';

export default function PromotionsManager() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', type: 'PERCENTAGE', value: 10, maxUses: 100, validFrom: '', validUntil: '', isActive: true });

  useEffect(() => { loadPromos(); }, []);
  const loadPromos = async () => { try { const r = await api.get('/promotions'); setPromos(r.data.data || []); } catch (e) { console.error(e); } setLoading(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/promotions/${editing.id}`, form); toast.success('Promoción actualizada'); }
      else { await api.post('/promotions', form); toast.success('Promoción creada'); }
      setShowModal(false); setEditing(null); loadPromos();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ code: p.code, type: p.type || 'PERCENTAGE', value: p.value, maxUses: p.maxUses || 100, validFrom: p.validFrom?.split('T')[0] || '', validUntil: p.validUntil?.split('T')[0] || '', isActive: p.isActive });
    setShowModal(true);
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  return (
    <div className="page-content">
      <PageHeader title="🏷️ Promociones" subtitle={`${promos.length} cupones`}
        actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ code: '', type: 'PERCENTAGE', value: 10, maxUses: 100, validFrom: '', validUntil: '', isActive: true }); setShowModal(true); }}>+ Nuevo Cupón</button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {promos.map((p, i) => (
          <motion.div key={p.id} className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            style={{ opacity: p.isActive ? 1 : 0.5 }}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ background: 'var(--gradient-agua)', borderRadius: 'var(--radius-sm)', padding: '6px 14px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'white', letterSpacing: '2px' }}>{p.code}</span>
                </div>
                {!p.isActive && <span className="badge badge-danger">Inactivo</span>}
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 900, color: 'var(--green)', marginBottom: '8px' }}>
                {p.type === 'PERCENTAGE' ? `${p.value}% OFF` : `₲${p.value?.toLocaleString()} OFF`}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="text-sm text-muted">Usos: {p.usesCount || 0}/{p.maxUses}</span>
                <span className="text-sm text-muted">{p.validUntil ? `Hasta ${new Date(p.validUntil).toLocaleDateString('es-PY')}` : 'Sin vencimiento'}</span>
              </div>
              <div style={{ background: 'rgba(148,163,184,0.05)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, ((p.usesCount || 0) / (p.maxUses || 1)) * 100)}%`, background: 'var(--gradient-agua)', transition: 'width 0.5s' }} />
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)} style={{ width: '100%', marginTop: '12px' }}>✏️ Editar</button>
            </div>
          </motion.div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? '✏️ Editar Cupón' : '🏷️ Nuevo Cupón'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">Código *</label><input className="form-input" required value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="LUXURY20" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px', fontWeight: 700 }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="PERCENTAGE">Porcentaje (%)</option><option value="FIXED">Monto fijo (Gs)</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Valor</label><input className="form-input" type="number" min={1} value={form.value} onChange={e => setForm({ ...form, value: parseInt(e.target.value) })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div className="form-group"><label className="form-label">Usos máx</label><input className="form-input" type="number" min={1} value={form.maxUses} onChange={e => setForm({ ...form, maxUses: parseInt(e.target.value) })} /></div>
            <div className="form-group"><label className="form-label">Desde</label><input className="form-input" type="date" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Hasta</label><input className="form-input" type="date" value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })} /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', cursor: 'pointer' }}><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Activo</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editing ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
