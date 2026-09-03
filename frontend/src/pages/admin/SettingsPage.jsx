import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Building2, MapPin, Phone, Mail, Clock, Calendar, Box,
  Globe, Save, Loader2, Settings as SettingsIcon, Shield, Bell,
  Briefcase, Landmark, Lock, KeyRound, Timer, Hash, FileText, ScrollText, Share2, Instagram, Facebook, MessageCircle, Music2, ExternalLink } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import FormField from '../../components/FormField';
import Skeleton from '../../components/Skeleton';

const TABS = [
  { id: 'general', icon: Building2, label: 'General', description: 'Datos del negocio' },
  { id: 'operation', icon: Clock, label: 'Operaciones', description: 'Horarios y capacidad' },
  { id: 'notifications', icon: Bell, label: 'Notificaciones', description: 'Canales de aviso' },
  { id: 'redes', icon: Share2, label: 'Redes', description: 'Instagram y demás' },
  { id: 'legal', icon: ScrollText, label: 'Legal', description: 'Términos y privacidad' },
  { id: 'security', icon: Shield, label: 'Seguridad', description: 'Tu contraseña' },
];

const DEFAULTS = {
  business_name: 'Luxury Garage',
  business_address: '',
  business_phone: '',
  business_email: '',
  tax_id: '',
  currency: 'PYG',
  timezone: 'America/Asuncion',
  opening_time: '07:00',
  closing_time: '18:00',
  working_days: 'Lun-Sáb',
  bays_count: 3,
  slot_duration_minutes: 60,
  email_notifications: true,
  whatsapp_notifications: true,
};

export default function SettingsPage() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapRow = reduceMotion ? undefined : { scale: 0.97 };
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings', { _noCache: true });
      const data = res.data.data || {};
      setForm({ ...DEFAULTS, ...data });
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo cargar la configuración');
    }
    setLoading(false);
  };

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      // Solo enviamos los ajustes del negocio (la seguridad usa su propio endpoint).
      const { business_name, business_address, business_phone, business_email, tax_id,
        currency, timezone, opening_time, closing_time, working_days, bays_count,
        slot_duration_minutes, email_notifications, whatsapp_notifications } = form;
      const payload = {
        business_name, business_address, business_phone, business_email, tax_id,
        currency, timezone, opening_time, closing_time, working_days,
        bays_count: Number(bays_count), slot_duration_minutes: Number(slot_duration_minutes),
        email_notifications, whatsapp_notifications,
      };
      const res = await api.put('/settings', payload);
      setForm({ ...DEFAULTS, ...(res.data.data || {}) });
      api.invalidate('/settings');
      toast.success('Configuración guardada');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar');
    }
    setSaving(false);
  };

  // Las pestañas Legal y Seguridad usan su propio endpoint/botón de guardado.
  const showSaveBar = activeTab !== 'security' && activeTab !== 'legal' && activeTab !== 'redes';

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <div className="admin-page-header mb-8">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-white">
            <span className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-600/20">
              <SettingsIcon size={20} />
            </span>
            Configuración
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Datos del negocio, operación y seguridad</p>
        </div>
        {showSaveBar && (
          <motion.button
            type="submit"
            form="settings-form"
            disabled={saving || loading}
            whileTap={saving || loading ? undefined : tap}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </motion.button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Nav */}
        <nav className="w-full lg:w-64 shrink-0 space-y-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <motion.button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                whileTap={tapRow}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-colors ${
                  active
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  active ? 'bg-white/15 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                }`}>
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${active ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{t.label}</span>
                  <span className={`block text-xs ${active ? 'text-white/70' : 'text-slate-400'}`}>{t.description}</span>
                </span>
              </motion.button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-48 rounded-lg" />
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'security' ? (
            <SecurityTab />
          ) : activeTab === 'redes' ? (
            <RedesTab />
          ) : activeTab === 'legal' ? (
            <LegalTab />
          ) : (
            <form id="settings-form" onSubmit={handleSave}>
              <>
                {activeTab === 'general' && (
                  <div key="general" className="space-y-6">
                    <Section icon={<Landmark size={16} />} title="Información del negocio">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Nombre comercial" name="business_name" value={form.business_name} onChange={(e) => set('business_name', e.target.value)} />
                        <FormField label="RUC" name="tax_id" value={form.tax_id} onChange={(e) => set('tax_id', e.target.value)} placeholder="80000000-0" />
                        <FormField className="md:col-span-2" label="Dirección" name="business_address" value={form.business_address} onChange={(e) => set('business_address', e.target.value)} placeholder="Av. ..." />
                        <FormField label="Teléfono" name="business_phone" value={form.business_phone} onChange={(e) => set('business_phone', e.target.value)} placeholder="+595 ..." />
                        <FormField label="Email de contacto" name="business_email" type="email" value={form.business_email} onChange={(e) => set('business_email', e.target.value)} placeholder="hola@..." />
                        <FormField as="select" label="Moneda" name="currency" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                          <option value="PYG">Guaraníes (₲)</option>
                          <option value="USD">Dólares (US$)</option>
                        </FormField>
                        <FormField label="Zona horaria" name="timezone" value={form.timezone} onChange={(e) => set('timezone', e.target.value)} />
                      </div>
                    </Section>
                  </div>
                )}

                {activeTab === 'operation' && (
                  <div key="operation" className="space-y-6">
                    <Section icon={<Box size={16} />} title="Horarios y capacidad">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Hora de apertura" name="opening_time" type="time" value={form.opening_time} onChange={(e) => set('opening_time', e.target.value)} />
                        <FormField label="Hora de cierre" name="closing_time" type="time" value={form.closing_time} onChange={(e) => set('closing_time', e.target.value)} />
                        <FormField label="Días laborales" name="working_days" value={form.working_days} onChange={(e) => set('working_days', e.target.value)} placeholder="Lun-Sáb" />
                        <FormField label="Bahías / boxes" name="bays_count" type="number" min={1} max={50} value={form.bays_count} onChange={(e) => set('bays_count', e.target.value)} />
                        <FormField label="Duración de turno (min)" name="slot_duration_minutes" type="number" min={10} max={480} value={form.slot_duration_minutes} onChange={(e) => set('slot_duration_minutes', e.target.value)} hint="Tiempo estimado por servicio" />
                      </div>
                    </Section>
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-sky-50 dark:bg-sky-500/5 border border-sky-200 dark:border-sky-500/20">
                      <Timer size={18} className="text-sky-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-sky-800 dark:text-sky-300">Cambiar la cantidad de bahías o los horarios afecta la disponibilidad de turnos.</p>
                    </div>
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div key="notifications" className="space-y-6">
                    <Section icon={<Bell size={16} />} title="Canales de notificación">
                      <div className="space-y-3">
                        <ToggleRow
                          icon={<Mail size={16} />}
                          title="Notificaciones por email"
                          description="Enviar avisos de turnos y membresías por correo"
                          checked={!!form.email_notifications}
                          onChange={(v) => set('email_notifications', v)}
                        />
                        <ToggleRow
                          icon={<Phone size={16} />}
                          title="Notificaciones por WhatsApp"
                          description="Avisos vía WhatsApp (requiere integración ARIZAR activa)"
                          checked={!!form.whatsapp_notifications}
                          onChange={(v) => set('whatsapp_notifications', v)}
                        />
                      </div>
                    </Section>
                  </div>
                )}
              </>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sección/card ────────────────────────────────────────────────────────────
function Section({ icon, title, children }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
      <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white mb-5">
        <span className="text-slate-400">{icon}</span>{title}
      </h3>
      {children}
    </div>
  );
}


// ── Redes sociales ──────────────────────────────────────────────────────────
// Se cargan acá y no en el código: cambiarlas no necesita un despliegue, y una red que no
// esté cargada sencillamente no aparece en la app (en vez de un ícono que no lleva a ningún lado).
const REDES_CAMPOS = [
  { id: 'instagram', label: 'Instagram', Icon: Instagram, placeholder: '@luxurygarage', ayuda: 'El usuario o el enlace del perfil' },
  { id: 'facebook', label: 'Facebook', Icon: Facebook, placeholder: 'luxurygarage.py', ayuda: 'El nombre de la página o su enlace' },
  { id: 'tiktok', label: 'TikTok', Icon: Music2, placeholder: '@luxurygarage', ayuda: 'El usuario o el enlace' },
  { id: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, placeholder: '0981 234 567', ayuda: 'El número al que te escriben' },
];

function RedesTab() {
  const [form, setForm] = useState({ instagram: '', facebook: '', tiktok: '', whatsapp: '' });
  const [inicial, setInicial] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/settings/redes', { _noCache: true });
      const d = r.data?.data || {};
      const next = { instagram: d.instagram || '', facebook: d.facebook || '', tiktok: d.tiktok || '', whatsapp: d.whatsapp || '' };
      setForm(next);
      setInicial(next);
    } catch {
      toast.error('No se pudieron cargar las redes');
    }
    setLoading(false);
  };

  const dirty = REDES_CAMPOS.some((c) => (form[c.id] || '') !== (inicial[c.id] || ''));

  const guardar = async () => {
    setSaving(true);
    try {
      const r = await api.put('/settings/redes', form);
      const d = r.data?.data || {};
      const next = { instagram: d.instagram || '', facebook: d.facebook || '', tiktok: d.tiktok || '', whatsapp: d.whatsapp || '' };
      setForm(next);
      setInicial(next);
      api.invalidate?.('/settings/redes');
      toast.success('Redes actualizadas');
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  const cargadas = REDES_CAMPOS.filter((c) => form[c.id]);

  return (
    <div className="space-y-5">
      <Section icon={<Share2 size={16} />} title="Dónde encontrarnos">
        <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2 mb-5">
          Aparecen en el pie de la página pública y en el perfil del cliente. La que dejes vacía no se muestra.
        </p>
        <div className="space-y-4">
          {REDES_CAMPOS.map(({ id, label, Icon, placeholder, ayuda }) => (
            <div key={id} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0 mt-6 text-slate-500 dark:text-slate-400">
                <Icon size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <FormField
                  label={label} name={id} value={form[id]} hint={ayuda} placeholder={placeholder}
                  onChange={(e) => setForm({ ...form, [id]: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {cargadas.length > 0 && (
        <Section icon={<ExternalLink size={16} />} title="Cómo se ven">
          <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2 mb-4">
            Tocá una para comprobar que abre donde tiene que abrir.
          </p>
          <div className="flex flex-wrap gap-2">
            {cargadas.map(({ id, label, Icon }) => (
              <a
                key={id} href={form[id]} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <Icon size={15} /> {label}
                <ExternalLink size={12} className="text-slate-400" />
              </a>
            ))}
          </div>
        </Section>
      )}

      <div className="flex justify-end">
        <button
          onClick={guardar} disabled={!dirty || saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary dark:bg-blue-600 text-white text-sm font-semibold shadow-sm disabled:opacity-40"
        >
          {saving ? 'Guardando...' : 'Guardar redes'}
        </button>
      </div>
    </div>
  );
}

// ── Toggle ──────────────────────────────────────────────────────────────────
function ToggleRow({ icon, title, description, checked, onChange }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={() => onChange(!checked)}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
    >
      <span className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>
      </span>
      <span className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <motion.span
          layout
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }}
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
    </motion.button>
  );
}

// ── Tab legal: Términos y Condiciones + Política de Privacidad ───────────────
const LEGAL_DOCS = [
  { name: 'terms', label: 'Términos y Condiciones', icon: <ScrollText size={16} />, placeholder: 'Escribí acá los Términos y Condiciones que verá el cliente…' },
  { name: 'privacy', label: 'Política de Privacidad', icon: <FileText size={16} />, placeholder: 'Escribí acá la Política de Privacidad (opcional)…' },
];

function formatLegalDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function LegalTab() {
  const reduceMotion = useReducedMotion();
  const [docs, setDocs] = useState({ terms: { text: '', updatedAt: null }, privacy: { text: '', updatedAt: null } });
  const [initial, setInitial] = useState({ terms: '', privacy: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [focusedDoc, setFocusedDoc] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings/legal', { _noCache: true });
      const data = res.data.data || {};
      const next = {
        terms: { text: data.terms?.text || '', updatedAt: data.terms?.updatedAt || null },
        privacy: { text: data.privacy?.text || '', updatedAt: data.privacy?.updatedAt || null },
      };
      setDocs(next);
      setInitial({ terms: next.terms.text, privacy: next.privacy.text });
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo cargar los documentos legales');
    }
    setLoading(false);
  };

  const setText = (name, text) => setDocs((prev) => ({ ...prev, [name]: { ...prev[name], text } }));

  const dirty = docs.terms.text !== initial.terms || docs.privacy.text !== initial.privacy;

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const payload = {};
      if (docs.terms.text !== initial.terms) payload.terms = docs.terms.text;
      if (docs.privacy.text !== initial.privacy) payload.privacy = docs.privacy.text;
      const res = await api.put('/settings/legal', payload);
      const data = res.data.data || {};
      const next = {
        terms: { text: data.terms?.text || '', updatedAt: data.terms?.updatedAt || null },
        privacy: { text: data.privacy?.text || '', updatedAt: data.privacy?.updatedAt || null },
      };
      setDocs(next);
      setInitial({ terms: next.terms.text, privacy: next.privacy.text });
      api.invalidate('/settings/legal');
      toast.success('Documentos legales guardados');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {LEGAL_DOCS.map((d) => (
          <div key={d.name} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-3">
            <Skeleton className="h-5 w-48 rounded" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/20">
        <ScrollText size={18} className="text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-sm text-indigo-800 dark:text-indigo-300">El texto que guardes acá es el que verán los clientes en la app, dentro de su perfil. Editalo cuando cambien tus condiciones de servicio.</p>
      </div>

      {LEGAL_DOCS.map((d) => {
        const updated = formatLegalDate(docs[d.name].updatedAt);
        return (
          <Section key={d.name} icon={d.icon} title={d.label}>
            <textarea
              value={docs[d.name].text}
              onChange={(e) => setText(d.name, e.target.value)}
              onFocus={() => setFocusedDoc(d.name)}
              onBlur={() => setFocusedDoc(null)}
              placeholder={d.placeholder}
              rows={14}
              className={`w-full rounded-xl border bg-slate-50/60 dark:bg-white/[0.02] px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all duration-200 resize-y leading-relaxed ${
                focusedDoc === d.name
                  ? 'border-primary ring-2 ring-primary/15'
                  : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            />
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              {updated ? `Última actualización: ${updated}` : 'Aún sin publicar'}
            </p>
          </Section>
        );
      })}

      <div className="flex justify-end">
        <motion.button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          whileTap={saving || !dirty ? undefined : (reduceMotion ? undefined : { scale: 0.96 })}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Guardando…' : 'Guardar documentos'}
        </motion.button>
      </div>
    </div>
  );
}

// ── Tab de seguridad: cambio de contraseña propia ────────────────────────────
function SecurityTab() {
  const reduceMotion = useReducedMotion();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e = {};
    if (!pw.current) e.current = 'Ingresá tu contraseña actual';
    if (!pw.next || pw.next.length < 8) e.next = 'Mínimo 8 caracteres';
    else if (!/[A-Z]/.test(pw.next)) e.next = 'Debe incluir al menos una mayúscula';
    else if (!/[0-9]/.test(pw.next)) e.next = 'Debe incluir al menos un número';
    if (pw.confirm !== pw.next) e.confirm = 'Las contraseñas no coinciden';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pw.current, newPassword: pw.next });
      toast.success('Contraseña actualizada');
      setPw({ current: '', next: '', confirm: '' });
      setErrors({});
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo actualizar la contraseña');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Section icon={<KeyRound size={16} />} title="Cambiar mi contraseña">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <FormField
            label="Contraseña actual" name="current" type="password" required
            value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })}
            error={errors.current} autoComplete="current-password"
          />
          <FormField
            label="Nueva contraseña" name="next" type="password" required
            value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })}
            error={errors.next} hint="Mínimo 8 caracteres, una mayúscula y un número" autoComplete="new-password"
          />
          <FormField
            label="Confirmar nueva contraseña" name="confirm" type="password" required
            value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            error={errors.confirm} autoComplete="new-password"
          />
          <motion.button
            type="submit"
            disabled={saving}
            whileTap={saving ? undefined : (reduceMotion ? undefined : { scale: 0.96 })}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            {saving ? 'Actualizando…' : 'Actualizar contraseña'}
          </motion.button>
        </form>
      </Section>
    </div>
  );
}
