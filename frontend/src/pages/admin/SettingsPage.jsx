import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, MapPin, Phone,
  Clock, Calendar, Box,
  Globe, Save, Loader2,
  Settings, Shield, Bell,
  CreditCard, User, MoreVertical,
  Briefcase, Landmark, Smartphone
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [form, setForm] = useState({
    business_name: 'Luxury Garage',
    business_address: '',
    business_phone: '',
    opening_time: '07:00',
    closing_time: '18:00',
    working_days: 'Lun-Sáb',
    bays_count: '3',
    timezone: 'America/Asuncion',
    currency: 'PYG',
    tax_id: '',
    email_notifications: true
  });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/settings');
      const data = res.data.data || {};
      setSettings(data);
      setForm(prev => ({ ...prev, ...data }));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', form);
      toast.success('Configuración actualizada correctamente');
    } catch (err) {
      toast.error('Error al guardar los cambios');
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando Parámetros del Sistema...</p>
    </div>
  );

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
              <Settings size={24} />
            </div>
            Configuración Maestro
          </h1>
          <p>Gestión de identidad corporativa y reglas operativas</p>
        </div>

        <button
          type="submit"
          form="settings-form"
          className="admin-btn-primary px-8 flex items-center gap-3"
          disabled={saving}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'PROCESANDO...' : 'GUARDAR CAMBIOS'}
        </button>
      </header>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-72 space-y-2">
          <SettingsNavItem
            active={activeTab === 'general'}
            onClick={() => setActiveTab('general')}
            icon={<Building2 size={18} />}
            label="General"
            description="Identidad y datos fiscales"
          />
          <SettingsNavItem
            active={activeTab === 'operation'}
            onClick={() => setActiveTab('operation')}
            icon={<Clock size={18} />}
            label="Operaciones"
            description="Horarios y capacidad"
          />
          <SettingsNavItem
            active={activeTab === 'notifications'}
            onClick={() => setActiveTab('notifications')}
            icon={<Bell size={18} />}
            label="Notificaciones"
            description="Correo y alertas"
          />
          <SettingsNavItem
            active={activeTab === 'security'}
            onClick={() => setActiveTab('security')}
            icon={<Shield size={18} />}
            label="Seguridad"
            description="Accesos y auditoría"
          />
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <form id="settings-form" onSubmit={handleSave}>
            <AnimatePresence mode="wait">
              {activeTab === 'general' && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="admin-card border-indigo-500/10">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-8 flex items-center gap-2">
                      <Landmark size={14} /> Información de Identidad
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre Comercial</label>
                        <div className="relative">
                          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input
                            className="admin-search-input !pl-12 w-full"
                            value={form.business_name}
                            onChange={e => setForm({ ...form, business_name: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">RUC / Registro Fiscal</label>
                        <div className="relative">
                          <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input
                            className="admin-search-input !pl-12 w-full"
                            placeholder="80000000-0"
                            value={form.tax_id || ''}
                            onChange={e => setForm({ ...form, tax_id: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Dirección Matriz</label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input
                            className="admin-search-input !pl-12 w-full"
                            value={form.business_address}
                            onChange={e => setForm({ ...form, business_address: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Teléfono Principal</label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input
                            className="admin-search-input !pl-12 w-full"
                            value={form.business_phone}
                            onChange={e => setForm({ ...form, business_phone: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Moneda del Sistema</label>
                        <div className="relative">
                          <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <select
                            className="admin-search-input !pl-12 w-full appearance-none cursor-pointer"
                            value={form.currency}
                            onChange={e => setForm({ ...form, currency: e.target.value })}
                          >
                            <option value="PYG">Guaraníes (₲)</option>
                            <option value="USD">Dólares (US$)</option>
                            <option value="EUR">Euros (€)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'operation' && (
                <motion.div
                  key="operation"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="admin-card border-amber-500/10">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-8 flex items-center gap-2">
                      <Box size={14} /> Cronograma y Capacidad
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Hora de Apertura</label>
                        <div className="relative">
                          <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input
                            type="time"
                            className="admin-search-input !pl-12 w-full"
                            value={form.opening_time}
                            onChange={e => setForm({ ...form, opening_time: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Hora de Cierre</label>
                        <div className="relative">
                          <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input
                            type="time"
                            className="admin-search-input !pl-12 w-full"
                            value={form.closing_time}
                            onChange={e => setForm({ ...form, closing_time: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Días Laborales</label>
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input
                            className="admin-search-input !pl-12 w-full"
                            placeholder="Lun-Sáb"
                            value={form.working_days}
                            onChange={e => setForm({ ...form, working_days: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Capacidad (Bahías/Boxes)</label>
                        <div className="relative">
                          <Box className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input
                            type="number"
                            min={1} max={20}
                            className="admin-search-input !pl-12 w-full"
                            value={form.bays_count}
                            onChange={e => setForm({ ...form, bays_count: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Zona Horaria Servidor</label>
                        <div className="relative">
                          <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input
                            className="admin-search-input !pl-12 w-full"
                            value={form.timezone}
                            onChange={e => setForm({ ...form, timezone: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-[2rem] bg-indigo-600/5 border border-indigo-500/10">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Shield size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-1">Impacto en Turnos</h4>
                        <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-widest">
                          Cualquier cambio en la cantidad de bahías o los horarios de operación afectará la disponibilidad de calendarios para nuevos agendamientos inmediatamente.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>
      </div>
    </div>
  );
}

function SettingsNavItem({ active, onClick, icon, label, description }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-3xl border transition-all text-left group
            ${active
          ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-900/20'
          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-white/5 hover:border-slate-300 hover:bg-slate-50'}`}
    >
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors
            ${active ? 'bg-white/10 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400 group-hover:bg-slate-200'}`}>
        {icon}
      </div>
      <div className="flex-1">
        <h4 className={`text-[11px] font-black uppercase tracking-widest ${active ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{label}</h4>
        <p className={`text-[8px] font-bold uppercase tracking-widest ${active ? 'text-white/60' : 'text-slate-400'}`}>{description}</p>
      </div>
    </button>
  );
}
