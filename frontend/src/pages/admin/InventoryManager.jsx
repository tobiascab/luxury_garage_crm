import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';

export default function InventoryManager() {
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'LIMPIEZA', unit: 'unidad', currentStock: 0, minStockAlert: 5, costPerUnit: 0, supplier: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [itemsRes, alertsRes] = await Promise.all([api.get('/inventory'), api.get('/inventory/alerts').catch(() => ({ data: { data: [] } }))]);
      setItems(itemsRes.data.data || []);
      setAlerts(alertsRes.data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/inventory/${editing.id}`, form); toast.success('Actualizado'); }
      else { await api.post('/inventory', form); toast.success('Insumo creado'); }
      setShowModal(false); setEditing(null); loadData();
    } catch (err) { toast.error('Error'); }
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ name: item.name, category: item.category, unit: item.unit, currentStock: item.currentStock, minStockAlert: item.minStockAlert, costPerUnit: item.costPerUnit || 0, supplier: item.supplier || '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar?')) return;
    try { await api.delete(`/inventory/${id}`); toast.success('Eliminado'); loadData(); } catch (e) { toast.error('Error'); }
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  return (
    <div className="page-content">
      <PageHeader title="📦 Inventario" subtitle={`${items.length} insumos | ${alerts.length} alertas`}
        actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: '', category: 'LIMPIEZA', unit: 'unidad', currentStock: 0, minStockAlert: 5, costPerUnit: 0, supplier: '' }); setShowModal(true); }}>+ Nuevo Insumo</button>} />

      {alerts.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: 'var(--red-glow)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div>
            <p style={{ fontWeight: 600, color: 'var(--red)' }}>{alerts.length} insumo(s) con stock bajo</p>
            <p className="text-sm text-muted">{alerts.map(a => a.name).join(', ')}</p>
          </div>
        </motion.div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Insumo</th><th>Categoría</th><th>Stock</th><th>Mínimo</th><th>Costo/u</th><th>Proveedor</th><th>Acciones</th></tr></thead>
          <tbody>
            {items.map((item, i) => {
              const isLow = item.currentStock <= item.minStockAlert;
              return (
                <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td><span className="badge badge-default">{item.category}</span></td>
                  <td><span style={{ fontWeight: 700, color: isLow ? 'var(--red)' : 'var(--green)', fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{item.currentStock}</span> <span className="text-xs text-muted">{item.unit}</span></td>
                  <td className="text-muted">{item.minStockAlert}</td>
                  <td>₲{(item.costPerUnit || 0).toLocaleString()}</td>
                  <td className="text-sm">{item.supplier || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>✏️</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item.id)} style={{ color: 'var(--red)' }}>🗑️</button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? '✏️ Editar Insumo' : '📦 Nuevo Insumo'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jabón líquido" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="LIMPIEZA">Limpieza</option><option value="QUIMICOS">Químicos</option><option value="ACCESORIOS">Accesorios</option><option value="HERRAMIENTAS">Herramientas</option><option value="GENERAL">General</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Unidad</label><input className="form-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="litro, unidad, kg" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div className="form-group"><label className="form-label">Stock actual</label><input className="form-input" type="number" min={0} value={form.currentStock} onChange={e => setForm({ ...form, currentStock: parseInt(e.target.value) })} /></div>
            <div className="form-group"><label className="form-label">Alerta mínima</label><input className="form-input" type="number" min={0} value={form.minStockAlert} onChange={e => setForm({ ...form, minStockAlert: parseInt(e.target.value) })} /></div>
            <div className="form-group"><label className="form-label">Costo/u Gs</label><input className="form-input" type="number" min={0} value={form.costPerUnit} onChange={e => setForm({ ...form, costPerUnit: parseInt(e.target.value) })} /></div>
          </div>
          <div className="form-group"><label className="form-label">Proveedor</label><input className="form-input" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editing ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
