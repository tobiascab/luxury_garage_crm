import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Activity, Users, Percent, Calendar,
  Settings, RefreshCcw, Send, Megaphone,
  Link, List, CheckCircle2, AlertCircle,
  Copy, ExternalLink, MessageSquare, Mail,
  Phone, Globe, Zap, Loader2, ShieldCheck,
  ChevronRight, Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function ArizarPanel() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tab, setTab] = useState('dashboard');

  // Message forms
  const [msgForm, setMsgForm] = useState({ userId: '', channel: 'whatsapp', message: '', subject: '' });
  const [broadcastForm, setBroadcastForm] = useState({ channel: 'whatsapp', message: '', subject: '', filter: 'active' });
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    loadStatus();
    loadLogs();
    loadMembers();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await api.get('/arizar/status');
      setStatus(res.data.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const loadLogs = async () => {
    try {
      const res = await api.get('/arizar/logs?limit=30');
      setLogs(res.data.data || []);
    } catch (err) { console.error(err); }
  };

  const loadMembers = async () => {
    try {
      const res = await api.get('/members?limit=100');
      setMembers(res.data.data || []);
    } catch (err) { console.error(err); }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/arizar/sync-all');
      toast.success(res.data.message);
      loadStatus();
    } catch (err) { toast.error('Error sincronizando'); }
    setSyncing(false);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await api.post('/arizar/test-connection');
      if (res.data.success) toast.success(res.data.message);
      else toast.error(res.data.message);
    } catch (err) { toast.error('Error de conexión'); }
    setTesting(false);
  };

  const handleRegisterWebhooks = async () => {
    try {
      const res = await api.post('/arizar/register-webhooks');
      toast.success(res.data.message);
    } catch (err) { toast.error('Error registrando webhooks'); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await api.post('/arizar/send-message', msgForm);
      toast.success(res.data.message);
      setMsgForm({ ...msgForm, message: '', subject: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Error enviando'); }
    setSending(false);
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await api.post('/arizar/broadcast', broadcastForm);
      toast.success(res.data.message);
    } catch (err) { toast.error('Error enviando broadcast'); }
    setSending(false);
  };

  const registrationLink = 'https://luxurygarage.arizar-ia.cloud/register';

  const copyLink = () => {
    navigator.clipboard.writeText(registrationLink);
    toast.success('Link copiado al portapapeles');
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`🚗 ¡Registrate en Luxury Garage!\n\nCreá tu cuenta gratis:\n${registrationLink}\n\n✨ Lavados premium, membresías exclusivas y más.`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Iniciando Red Neuronal...</p>
    </div>
  );

  const tabs = [
    { id: 'dashboard', label: 'Estatus', icon: <Bot size={16} /> },
    { id: 'messages', label: 'Mensajería', icon: <MessageSquare size={16} /> },
    { id: 'broadcast', label: 'Difusión', icon: <Megaphone size={16} /> },
    { id: 'links', label: 'Captación', icon: <Link size={16} /> },
    { id: 'logs', label: 'Auditoría', icon: <List size={16} /> },
  ];

  return (
    <div className="page-content">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
              <Bot size={24} />
            </div>
            ARIZAR IA — CRM
          </h1>
          <p>Motor de Crecimiento y Automatización de Clientes</p>
        </div>
        <div className="flex gap-2">
          <button className="admin-btn-outline" onClick={() => { loadStatus(); loadLogs(); toast.success('Sincronizado'); }}>
            <RefreshCcw size={14} className={syncing ? 'animate-spin' : ''} /> Refrescar
          </button>
          <button className="admin-btn-primary" onClick={handleSyncAll} disabled={syncing}>
            <Zap size={14} /> Sincronizar Todo
          </button>
        </div>
      </header>

      {/* Modern Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit mb-8 border border-slate-200 dark:border-white/5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`
              flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all
              ${tab === t.id
                ? 'bg-white dark:bg-slate-800 text-primary shadow-sm border border-slate-200 dark:border-white/10'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}
            `}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* ═══════ DASHBOARD TAB ═══════ */}
          {tab === 'dashboard' && (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="admin-card">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-2xl ${status?.configured ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                      <Activity size={20} />
                    </div>
                    <span className={`admin-badge ${status?.apiStatus === 'connected' ? 'admin-badge-success' : 'admin-badge-danger'}`}>
                      {status?.apiStatus === 'connected' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Estado de Conexión</p>
                  <p className="text-xl font-black italic text-slate-900 dark:text-white uppercase">
                    {status?.configured ? 'Integrado' : 'Sin Configurar'}
                  </p>
                </div>

                <div className="admin-card">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
                      <Users size={20} />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Contactos Sincronizados</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-black italic text-slate-900 dark:text-white">{status?.contacts?.synced || 0}</p>
                    <p className="text-xs font-bold text-slate-400">/ {status?.contacts?.total || 0}</p>
                  </div>
                </div>

                <div className="admin-card">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500">
                      <Percent size={20} />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Ratio de Sync</p>
                  <p className="text-2xl font-black italic text-purple-500">{status?.contacts?.percentage || 0}%</p>
                </div>

                <div className="admin-card">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                      <Calendar size={20} />
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Turnos Registrados</p>
                  <p className="text-2xl font-black italic text-slate-900 dark:text-white">{status?.appointments || 0}</p>
                </div>
              </div>

              {/* API Detail Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="admin-card space-y-6">
                  <div className="flex items-center gap-3">
                    <Settings size={18} className="text-primary" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Identificadores ARIZAR</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Location ID</p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">{status?.locationId || 'PENDIENTE'}</p>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(status?.locationId); toast.success('Copiado'); }} className="text-slate-400 hover:text-primary"><Copy size={14} /></button>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Calendar ID</p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">{status?.calendarId || 'PENDIENTE'}</p>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(status?.calendarId); toast.success('Copiado'); }} className="text-slate-400 hover:text-primary"><Copy size={14} /></button>
                    </div>
                    <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest">Webhook Status</p>
                        <p className="text-xs font-bold text-primary font-mono truncate max-w-[200px]">{status?.webhookUrl}</p>
                      </div>
                      <ShieldCheck size={20} className="text-primary" />
                    </div>
                  </div>
                </div>

                <div className="admin-card space-y-6">
                  <div className="flex items-center gap-3">
                    <Zap size={18} className="text-amber-500" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Acciones Rápidas</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <button onClick={handleTestConnection} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 hover:border-primary transition-all group">
                      <div className="flex items-center gap-3">
                        <Bot size={18} className="text-slate-400 group-hover:text-primary" />
                        <span className="text-xs font-black uppercase tracking-widest">Probar Conexión API</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                    <button onClick={handleRegisterWebhooks} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 hover:border-emerald-500 transition-all group">
                      <div className="flex items-center gap-3">
                        <Globe size={18} className="text-slate-400 group-hover:text-emerald-500" />
                        <span className="text-xs font-black uppercase tracking-widest">Refrescar Webhooks</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                    <div className="p-6 rounded-3xl bg-amber-500/5 border border-dashed border-amber-500/20 text-center space-y-2">
                      <AlertCircle size={24} className="text-amber-500 mx-auto" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Sincronización Crítica</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Se recomienda sincronizar contactos <br /> cada vez que se realice una carga masiva.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ MESSAGES TAB ═══════ */}
          {tab === 'messages' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 admin-card space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest mb-1">Nueva Comunicación</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Envío individual directo</p>
                  </div>
                  <div className="flex gap-2">
                    {['whatsapp', 'sms', 'email'].map(ch => (
                      <button
                        key={ch}
                        onClick={() => setMsgForm({ ...msgForm, channel: ch })}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${msgForm.channel === ch ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                      >
                        {ch === 'whatsapp' ? <MessageSquare size={16} /> : ch === 'sms' ? <Phone size={16} /> : <Mail size={16} />}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleSendMessage} className="space-y-6">
                  <div className="space-y-2">
                    <label className="admin-label">Seleccionar Miembro</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <select
                        className="admin-input pl-12"
                        value={msgForm.userId}
                        onChange={e => setMsgForm({ ...msgForm, userId: e.target.value })}
                        required
                      >
                        <option value="">Buscar socio...</option>
                        {members.map(m => (
                          <option key={m.id} value={m.id}>{m.firstName} {m.lastName} — {m.email}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {msgForm.channel === 'email' && (
                    <div className="space-y-2">
                      <label className="admin-label">Asunto del Email</label>
                      <input className="admin-input" value={msgForm.subject} onChange={e => setMsgForm({ ...msgForm, subject: e.target.value })} placeholder="Ej: Confirmación de Turno" />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="admin-label">Contenido del Mensaje</label>
                    <textarea
                      className="admin-input min-h-[160px] resize-none pt-4"
                      value={msgForm.message}
                      onChange={e => setMsgForm({ ...msgForm, message: e.target.value })}
                      required
                      placeholder="Hola {{nombre}}, tu turno para hoy a las {{hora}} está confirmado."
                    />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Etiquetas disponibles: {'{{nombre}}'}, {'{{monto}}'}, {'{{fecha}}'}</p>
                  </div>

                  <button type="submit" className="admin-btn-primary w-full py-4" disabled={sending}>
                    {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    {sending ? 'PROCESANDO ENVÍO...' : 'ENVIAR MENSAJE AHORA'}
                  </button>
                </form>
              </div>

              <div className="space-y-6">
                <div className="admin-card">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6">Guía de Canales</h4>
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                        <MessageSquare size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase italic tracking-tighter">WhatsApp</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-normal uppercase">Ideal para recordatorios urgentes y promociones directas.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                        <Mail size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase italic tracking-tighter">Email Marketing</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-normal uppercase">Novedades semanales y estados de cuenta.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ BROADCAST TAB ═══════ */}
          {tab === 'broadcast' && (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="admin-card border-primary/20 bg-primary/5 text-center p-12 space-y-4">
                <Megaphone size={40} className="text-primary mx-auto" />
                <h2 className="text-2xl font-black italic tracking-tighter uppercase italic">Transmisión Masiva</h2>
                <p className="max-w-md mx-auto text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                  Envía notificaciones a toda tu base de datos de manera simultánea a través de ARIZAR CRM.
                </p>
              </div>

              <div className="admin-card">
                <form onSubmit={handleBroadcast} className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="admin-label">Red de Envío</label>
                      <select className="admin-select" value={broadcastForm.channel} onChange={e => setBroadcastForm({ ...broadcastForm, channel: e.target.value })}>
                        <option value="whatsapp">WhatsApp Business</option>
                        <option value="sms">SMS Marketing</option>
                        <option value="email">Email Campaign</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="admin-label">Segmentación</label>
                      <select className="admin-select" value={broadcastForm.filter} onChange={e => setBroadcastForm({ ...broadcastForm, filter: e.target.value })}>
                        <option value="active">Solo Miembros Activos</option>
                        <option value="all">Toda la Base de Datos</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="admin-label">Mensaje de Campaña</label>
                    <textarea
                      className="admin-input min-h-[200px]"
                      value={broadcastForm.message}
                      onChange={e => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                      required
                      placeholder="Lanzamos nuestra nueva colección de servicios..."
                    />
                  </div>

                  <div className="flex items-center justify-between p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={24} className="text-emerald-500" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest">Validación de Lote</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tu campaña alcanzará a aproximadamente 120 personas.</p>
                      </div>
                    </div>
                    <button type="submit" className="admin-btn-primary px-10" disabled={sending}>
                      {sending ? 'EJECUTANDO DIFUSIÓN...' : 'LANZAR CAMPAÑA'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ═══════ LINKS TAB ═══════ */}
          {tab === 'links' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="admin-card space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest">Enlace de Auto-Registro</h3>
                  <p className="text-[11px] font-bold text-slate-500 leading-relaxed uppercase tracking-widest">
                    Comparte este enlace en tus redes sociales o estados para que los clientes se registren y se vinculen automáticamente a tu CRM.
                  </p>

                  <div className="group relative">
                    <input
                      className="admin-input pr-12 font-mono text-xs text-primary bg-primary/5 border-primary/20"
                      value={registrationLink}
                      readOnly
                    />
                    <button
                      onClick={copyLink}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary transition-all shadow-sm"
                    >
                      <Copy size={14} />
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={shareWhatsApp} className="flex-1 py-4 bg-[#25D366] text-white rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                      <MessageSquare size={16} /> Compartir por WhatsApp
                    </button>
                  </div>
                </div>

                <div className="admin-card space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest">Embudos de Entrada</h3>
                  <div className="space-y-3">
                    {[
                      { icon: <MessageSquare className="text-emerald-500" />, title: 'WhatsApp Automation', status: 'ACTIVO' },
                      { icon: <Globe className="text-blue-500" />, title: 'Landing de Ventas', status: 'ACTIVO' },
                      { icon: <ExternalLink className="text-purple-500" />, title: 'Referidos VIP', status: 'ACTIVO' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-3">
                          {item.icon}
                          <span className="text-xs font-black uppercase tracking-widest">{item.title}</span>
                        </div>
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em]">{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ LOGS TAB ═══════ */}
          {tab === 'logs' && (
            <div className="space-y-6">
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Operación</th>
                      <th>Entidad</th>
                      <th>Originador</th>
                      <th>Detalles del Nodo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.01 }}
                      >
                        <td className="text-[10px] font-mono font-bold text-slate-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td>
                          <span className={`admin-badge ${log.action.includes('error') ? 'admin-badge-danger' : 'admin-badge-success'}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="text-xs font-black uppercase tracking-widest">{log.entity}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[8px] font-black">
                              {log.user?.firstName?.[0]}
                            </div>
                            <span className="text-xs font-bold">{log.user?.firstName} {log.user?.lastName}</span>
                          </div>
                        </td>
                        <td className="max-w-[200px] truncate text-[10px] font-mono text-slate-400">
                          {JSON.stringify(log.details)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
