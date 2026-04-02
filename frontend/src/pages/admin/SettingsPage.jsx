import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, MapPin, Phone,
  Clock, Calendar, Box,
  Globe, Save, Loader2,
  Settings, Shield, Bell,
  Briefcase, Landmark,
  Percent, Lock, CheckCircle2,
  AlertTriangle, Info
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

  // Commission state
  const [commissionRate, setCommissionRate] = useState('');
  const [commissionLocked, setCommissionLocked] = useState(false);
  const [savingCommission, setSavingCommission] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/settings');
      const data = res.data.data || {};
      setSettings(data);
      setForm(prev => ({ ...prev, ...data }));

      // Check commission config
      if (data.arizar_commission_rate) {
        setCommissionRate(data.arizar_commission_rate);
        setCommissionLocked(true);
      }
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
      toast.success('Configuración guardada');
      api.invalidate('/settings');
    } catch (err) {
      toast.error('Error al guardar');
    }
    setSaving(false);
  };

  const handleSaveCommission = async () => {
    const rate = parseFloat(commissionRate);
    if (!rate || rate <= 0 || rate > 50) {
      toast.error('Ingresá un porcentaje válido (1-50%)');
      return;
    }
    if (!window.confirm(`¿Confirmar comisión del ${rate}%?\n\n⚠️ Una vez configurada, NO se podrá modificar.`)) return;

    setSavingCommission(true);
    try {
      await api.put('/settings', {
        arizar_commission_rate: String(rate),
        arizar_commission_locked: 'true',
        arizar_commission_set_at: new Date().toISOString(),
      });
      setCommissionLocked(true);
      toast.success(`Comisión de ${rate}% configurada permanentemente`);
      api.invalidate('/settings');
    } catch (err) {
      toast.error('Error al guardar comisión');
    }
    setSavingCommission(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Cargando configuración...</p>
    </div>
  );

  return (
    <div className="page-content pb-20">
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-lg">
              <Settings size={24} />
            </div>
            Configuración
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Datos del negocio, horarios y comisiones</p>
        </div>

        <button
          type="submit"
          form="settings-form"
          className="admin-btn-primary px-8 flex items-center gap-3"
          disabled={saving}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Guardando...' : 'Guardar Cambios'}
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
            description="Datos del negocio"
          />
          <SettingsNavItem
            active={activeTab === 'operation'}
            onClick={() => setActiveTab('operation')}
            icon={<Clock size={18} />}
            label="Operaciones"
            description="Horarios y capacidad"
          />
          <SettingsNavItem
            active={activeTab === 'commission'}
            onClick={() => setActiveTab('commission')}
            icon={<Percent size={18} />}
            label="Comisión ARIZAR"
            description="Porcentaje por venta"
          />
          <SettingsNavItem
            active={activeTab === 'notifications'}
            onClick={() => setActiveTab('notifications')}
            icon={<Bell size={18} />}
            label="Notificaciones"
            description="Alertas y avisos"
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
              {/* ── GENERAL ── */}
              {activeTab === 'general' && (
                <motion.div key="general" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                  <div className="admin-card">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-8 flex items-center gap-2">
                      <Landmark size={14} /> Información del Negocio
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <SettingsField icon={<Building2 size={16} />} label="Nombre Comercial" value={form.business_name} onChange={v => setForm({ ...form, business_name: v })} />
                      <SettingsField icon={<Briefcase size={16} />} label="RUC" value={form.tax_id || ''} onChange={v => setForm({ ...form, tax_id: v })} placeholder="80000000-0" />
                      <div className="md:col-span-2">
                        <SettingsField icon={<MapPin size={16} />} label="Dirección" value={form.business_address} onChange={v => setForm({ ...form, business_address: v })} />
                      </div>
                      <SettingsField icon={<Phone size={16} />} label="Teléfono" value={form.business_phone} onChange={v => setForm({ ...form, business_phone: v })} />
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Moneda</label>
                        <select
                          className="w-full h-14 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all"
                          value={form.currency}
                          onChange={e => setForm({ ...form, currency: e.target.value })}
                        >
                          <option value="PYG">Guaraníes (₲)</option>
                          <option value="USD">Dólares (US$)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── OPERATIONS ── */}
              {activeTab === 'operation' && (
                <motion.div key="operation" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                  <div className="admin-card">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-8 flex items-center gap-2">
                      <Box size={14} /> Horarios y Capacidad
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Hora Apertura</label>
                        <input type="time" className="w-full h-14 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all" value={form.opening_time} onChange={e => setForm({ ...form, opening_time: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Hora Cierre</label>
                        <input type="time" className="w-full h-14 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all" value={form.closing_time} onChange={e => setForm({ ...form, closing_time: e.target.value })} />
                      </div>
                      <SettingsField icon={<Calendar size={16} />} label="Días Laborales" value={form.working_days} onChange={v => setForm({ ...form, working_days: v })} placeholder="Lun-Sáb" />
                      <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">Bahías/Boxes</label>
                        <input type="number" min={1} max={20} className="w-full h-14 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all" value={form.bays_count} onChange={e => setForm({ ...form, bays_count: e.target.value })} />
                      </div>
                      <div className="md:col-span-2">
                        <SettingsField icon={<Globe size={16} />} label="Zona Horaria" value={form.timezone} onChange={v => setForm({ ...form, timezone: v })} />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20">
                    <div className="flex items-start gap-4">
                      <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        Cambiar la cantidad de bahías o los horarios afectará la disponibilidad de turnos inmediatamente.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── COMMISSION ── */}
              {activeTab === 'commission' && (
                <motion.div key="commission" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                  <div className="admin-card">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white shadow-lg">
                        <Percent size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Comisión ARIZAR IA</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Porcentaje aplicado sobre cada venta de membresía realizada a través del sistema</p>
                      </div>
                    </div>

                    {commissionLocked ? (
                      /* ── LOCKED STATE ── */
                      <div className="space-y-6">
                        <div className="p-8 rounded-2xl bg-gradient-to-br from-primary/5 to-indigo-600/5 border border-primary/20 text-center">
                          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <Lock size={32} className="text-primary" />
                          </div>
                          <div className="text-5xl font-black text-primary mb-2">{commissionRate}%</div>
                          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Comisión configurada</p>
                          <div className="flex items-center justify-center gap-2 mt-4 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={16} />
                            <span className="text-xs font-bold">Valor fijo — no modificable</span>
                          </div>
                        </div>

                        <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <h4 className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-3">¿Cómo funciona?</h4>
                          <ul className="space-y-2">
                            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                              Un cliente compra una membresía (ej: Plan Premium ₲500,000)
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                              Se calcula la comisión automáticamente: ₲500,000 × {commissionRate}% = ₲{(500000 * (parseFloat(commissionRate) / 100)).toLocaleString('es-PY')}
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                              La comisión queda registrada en el panel de Finanzas
                            </li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      /* ── UNLOCKED STATE — first time config ── */
                      <div className="space-y-6">
                        <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20">
                          <div className="flex items-start gap-4">
                            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-1">Configuración única</h4>
                              <p className="text-sm text-amber-700 dark:text-amber-400/80">
                                Una vez que confirmes el porcentaje de comisión, <strong>no se podrá modificar</strong>. Asegurate de ingresar el valor correcto.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4 block">
                            Porcentaje de comisión por venta
                          </label>
                          <div className="flex items-center justify-center gap-4 max-w-xs mx-auto">
                            <input
                              type="number"
                              step="0.5"
                              min="1"
                              max="50"
                              className="w-32 h-16 text-center text-3xl font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-2xl focus:outline-none focus:border-primary transition-all"
                              value={commissionRate}
                              onChange={e => setCommissionRate(e.target.value)}
                              placeholder="0"
                            />
                            <span className="text-3xl font-bold text-slate-400">%</span>
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
                            Por cada membresía vendida, ARIZAR IA recibe este porcentaje
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveCommission}
                          disabled={savingCommission || !commissionRate}
                          className="w-full h-14 rounded-2xl bg-primary text-white text-sm font-bold shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                        >
                          {savingCommission ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <>
                              <Lock size={18} /> Confirmar y Bloquear Comisión
                            </>
                          )}
                        </button>
                      </div>
                    )}
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

function SettingsField({ icon, label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">{label}</label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">{icon}</div>
        <input
          type={type}
          className="w-full h-14 pl-12 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function SettingsNavItem({ active, onClick, icon, label, description }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group
        ${active
        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xl'
        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
        ${active ? 'bg-white/10 dark:bg-slate-900/20 text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-600'}`}>
        {icon}
      </div>
      <div className="flex-1">
        <h4 className={`text-sm font-bold ${active ? '' : 'text-slate-900 dark:text-white'}`}>{label}</h4>
        <p className={`text-xs ${active ? 'opacity-60' : 'text-slate-400 dark:text-slate-500'}`}>{description}</p>
      </div>
    </button>
  );
}
