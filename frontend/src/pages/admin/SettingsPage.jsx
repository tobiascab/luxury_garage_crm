import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    business_name: 'Luxury Garage', business_address: '', business_phone: '',
    opening_time: '07:00', closing_time: '18:00', working_days: 'Lun-Sáb',
    bays_count: '3', timezone: 'America/Asuncion',
  });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/settings');
      const data = res.data.data || {};
      setSettings(data);
      setForm(prev => ({ ...prev, ...data }));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', form);
      toast.success('Configuración guardada');
    } catch (err) { toast.error('Error al guardar'); }
    setSaving(false);
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  return (
    <div className="page-content">
      <PageHeader title="⚙️ Configuración" subtitle="Datos del negocio y horarios" />

      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="card-header"><h3>🏢 Datos del Negocio</h3></div>
            <div className="card-body">
              <div className="form-group"><label className="form-label">Nombre</label><input className="form-input" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Dirección</label><input className="form-input" value={form.business_address} onChange={e => setForm({ ...form, business_address: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={form.business_phone} onChange={e => setForm({ ...form, business_phone: e.target.value })} /></div>
            </div>
          </motion.div>

          <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="card-header"><h3>🕐 Horario y Operación</h3></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group"><label className="form-label">Apertura</label><input className="form-input" type="time" value={form.opening_time} onChange={e => setForm({ ...form, opening_time: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Cierre</label><input className="form-input" type="time" value={form.closing_time} onChange={e => setForm({ ...form, closing_time: e.target.value })} /></div>
              </div>
              <div className="form-group"><label className="form-label">Días laborales</label><input className="form-input" value={form.working_days} onChange={e => setForm({ ...form, working_days: e.target.value })} placeholder="Lun-Sáb" /></div>
              <div className="form-group"><label className="form-label">Cantidad de bahías</label><input className="form-input" type="number" min={1} max={20} value={form.bays_count} onChange={e => setForm({ ...form, bays_count: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Zona horaria</label><input className="form-input" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} /></div>
            </div>
          </motion.div>
        </div>

        <motion.button type="submit" className="btn btn-primary btn-lg" disabled={saving} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '20px', width: '100%', maxWidth: '400px' }}>
          {saving ? 'Guardando...' : '💾 Guardar Configuración'}
        </motion.button>
      </form>
    </div>
  );
}
