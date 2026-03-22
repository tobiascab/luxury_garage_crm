import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import toast from 'react-hot-toast';

export default function MyProfile() {
  const { user, login } = useAuth();
  const [form, setForm] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '', phone: user?.phone || '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/auth/me', form);
      toast.success('Perfil actualizado');
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) return toast.error('Las contraseñas no coinciden');
    if (pwForm.newPassword.length < 8) return toast.error('Mínimo 8 caracteres');
    try {
      await api.post('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Contraseña actualizada');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  return (
    <div className="page-content">
      <PageHeader title="👤 Mi Perfil" subtitle="Gestioná tus datos personales" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="card-header"><h3>📝 Datos Personales</h3></div>
          <div className="card-body">
            <form onSubmit={handleSave}>
              <div className="form-group"><label className="form-label">Nombre</label><input className="form-input" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Apellido</label><input className="form-input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+595 9XX XXX XXX" /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.5 }} /></div>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: '100%' }}>{saving ? 'Guardando...' : 'Guardar Cambios'}</button>
            </form>
          </div>
        </motion.div>

        <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="card-header"><h3>🔒 Cambiar Contraseña</h3></div>
          <div className="card-body">
            <form onSubmit={handlePassword}>
              <div className="form-group"><label className="form-label">Contraseña actual</label><input type="password" className="form-input" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Nueva contraseña</label><input type="password" className="form-input" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Confirmar contraseña</label><input type="password" className="form-input" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} /></div>
              <button type="submit" className="btn btn-outline" style={{ width: '100%' }}>Cambiar Contraseña</button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
