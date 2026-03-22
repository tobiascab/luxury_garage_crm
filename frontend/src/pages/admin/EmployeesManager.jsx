import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';

export default function EmployeesManager() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' });

  useEffect(() => { loadEmployees(); }, []);
  const loadEmployees = async () => {
    try { const r = await api.get('/members?role=EMPLOYEE'); setEmployees(r.data.data || []); } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', { ...form, role: 'EMPLOYEE' });
      toast.success('Empleado creado');
      setShowCreate(false); setForm({ email: '', password: '', firstName: '', lastName: '', phone: '' });
      loadEmployees();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  return (
    <div className="page-content">
      <PageHeader title="👷 Empleados" subtitle={`${employees.length} empleados`}
        actions={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Crear Empleado</button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {employees.map((emp, i) => (
          <motion.div key={emp.id} className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className="card-body" style={{ textAlign: 'center', padding: '28px' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--gradient-agua)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontWeight: 800, fontSize: '1.2rem', color: 'white' }}>
                {emp.firstName?.[0]}{emp.lastName?.[0]}
              </div>
              <h3>{emp.firstName} {emp.lastName}</h3>
              <p className="text-sm text-muted">{emp.email}</p>
              {emp.phone && <p className="text-sm text-muted">{emp.phone}</p>}
              <div style={{ marginTop: '12px' }}>
                <StatusBadge status={emp.isActive !== false ? 'ACTIVE' : 'SUSPENDED'} />
              </div>
              <p className="text-xs text-muted" style={{ marginTop: '8px' }}>Desde: {new Date(emp.createdAt).toLocaleDateString('es-PY')}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="👷 Crear Empleado">
        <form onSubmit={handleCreate}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Apellido *</label><input className="form-input" required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
          </div>
          <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Contraseña *</label><input className="form-input" type="password" required minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Crear Empleado</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
