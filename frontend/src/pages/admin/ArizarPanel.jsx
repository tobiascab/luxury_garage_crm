import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bot, Activity, Users, Percent, Calendar,
  Settings, RefreshCcw, Send, Megaphone,
  Link as LinkIcon, List, CheckCircle2, AlertCircle,
  Copy, MessageSquare, Mail, Phone, Globe,
  Zap, Loader2, ShieldCheck, ChevronRight, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import FormField from '../../components/FormField';
import Skeleton, { SkeletonStats, SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import AnimatedNumber from '../../components/AnimatedNumber';

const TABS = [
  { id: 'dashboard', label: 'Estado', icon: Bot },
  { id: 'messages', label: 'Mensajería', icon: MessageSquare },
  { id: 'broadcast', label: 'Difusión', icon: Megaphone },
  { id: 'links', label: 'Captación', icon: LinkIcon },
  { id: 'logs', label: 'Auditoría', icon: List },
];

const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'sms', label: 'SMS', icon: Phone },
  { id: 'email', label: 'Email', icon: Mail },
];

const btnPrimary =
  'inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/20 disabled:opacity-60 disabled:cursor-not-allowed';
const btnSecondary =
  'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 transition-colors disabled:opacity-60';
const card =
  'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm';

export default function ArizarPanel() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapSmall = reduceMotion ? undefined : { scale: 0.9 };
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [tab, setTab] = useState('dashboard');

  const [members, setMembers] = useState([]);
  const [msgForm, setMsgForm] = useState({ userId: '', channel: 'whatsapp', message: '', subject: '' });
  const [broadcastForm, setBroadcastForm] = useState({ channel: 'whatsapp', message: '', subject: '', filter: 'active' });
  const [sending, setSending] = useState(false);

  const [registrationLink, setRegistrationLink] = useState('');

  useEffect(() => {
    loadStatus();
    loadLogs();
    loadMembers();
    loadRegistrationLink();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await api.get('/arizar/status', { _noCache: true });
      setStatus(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo cargar el estado de ARIZAR');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await api.get('/arizar/logs?limit=40', { _noCache: true });
      setLogs(res.data.data || []);
    } catch {
      toast.error('No se pudieron cargar los registros');
    } finally {
      setLogsLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const res = await api.get('/members?limit=200');
      setMembers(res.data.data || []);
    } catch {
      // selector vacío -> se muestra estado claro en el form
    }
  };

  const loadRegistrationLink = async () => {
    try {
      const res = await api.get('/arizar/registration-link');
      setRegistrationLink(res.data?.data?.link || '');
    } catch {
      setRegistrationLink('');
    }
  };

  const refreshAll = () => {
    api.invalidate('/arizar/status', '/arizar/logs');
    loadStatus();
    loadLogs();
    toast.success('Datos actualizados');
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/arizar/sync-all');
      toast.success(res.data.message || 'Sincronización completada');
      api.invalidate('/arizar/status');
      loadStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error sincronizando contactos');
    } finally {
      setSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await api.post('/arizar/test-connection');
      if (res.data.success) toast.success(res.data.message);
      else toast.error(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error de conexión');
    } finally {
      setTesting(false);
    }
  };

  const handleRegisterWebhooks = async () => {
    setRegistering(true);
    try {
      const res = await api.post('/arizar/register-webhooks');
      toast.success(res.data.message || 'Webhooks registrados');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error registrando webhooks');
    } finally {
      setRegistering(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msgForm.userId) return toast.error('Seleccioná un destinatario');
    if (!msgForm.message.trim()) return toast.error('El mensaje no puede estar vacío');
    setSending(true);
    try {
      const res = await api.post('/arizar/send-message', msgForm);
      toast.success(res.data.message || 'Mensaje enviado');
      setMsgForm((f) => ({ ...f, message: '', subject: '' }));
      api.invalidate('/arizar/logs');
      loadLogs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error enviando el mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastForm.message.trim()) return toast.error('El mensaje de campaña no puede estar vacío');
    setSending(true);
    try {
      const res = await api.post('/arizar/broadcast', broadcastForm);
      toast.success(res.data.message || 'Difusión enviada');
      api.invalidate('/arizar/logs');
      loadLogs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error enviando la difusión');
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    if (!registrationLink) return;
    navigator.clipboard.writeText(registrationLink);
    toast.success('Link copiado');
  };

  const shareWhatsApp = () => {
    if (!registrationLink) return toast.error('Link de registro no disponible');
    const msg = encodeURIComponent(
      `Registrate en Luxury Garage\n\nCreá tu cuenta:\n${registrationLink}\n\nLavados premium, membresías exclusivas y más.`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const copyValue = (val, label = 'Copiado') => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast.success(label);
  };

  // Solo miembros vinculados al CRM pueden recibir mensajes individuales
  const linkedMembers = members.filter((m) => m.arizarContactId);
  // Destinatarios reales de la difusión según el filtro
  const broadcastRecipients =
    broadcastForm.filter === 'active'
      ? linkedMembers.filter((m) => m.memberships?.some?.((ms) => ms.status === 'ACTIVE'))
      : linkedMembers;

  const configured = status?.configured;
  const online = status?.apiStatus === 'connected';

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-600/20">
            <Bot size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ARIZAR IA — CRM</h1>
            <p className="text-sm text-slate-500">Integración de contactos, mensajería y automatización</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button className={btnSecondary} onClick={refreshAll} whileTap={tap}>
            <RefreshCcw size={15} /> Refrescar
          </motion.button>
          <motion.button className={btnPrimary} onClick={handleSyncAll} disabled={syncing || !configured} whileTap={syncing || !configured ? undefined : tap}>
            {syncing ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
            {syncing ? 'Sincronizando…' : 'Sincronizar todo'}
          </motion.button>
        </div>
      </div>

      {/* ── Aviso de configuración ── */}
      {!loading && !configured && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
          <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            ARIZAR IA aún no está configurado. Definí <code className="font-mono text-xs">ARIZAR_LOCATION_ID</code> y el token de API en el servidor para habilitar la sincronización y la mensajería.
          </p>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/[0.03] rounded-xl w-fit mb-6 border border-slate-200 dark:border-white/5 overflow-x-auto max-w-full">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <motion.button
              key={t.id}
              onClick={() => setTab(t.id)}
              whileTap={tap}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {active && (
                reduceMotion ? (
                  <span className="absolute inset-0 rounded-lg bg-white dark:bg-slate-800 shadow-sm" />
                ) : (
                  <motion.span
                    layoutId="arizar-tab-pill"
                    className="absolute inset-0 rounded-lg bg-white dark:bg-slate-800 shadow-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                  />
                )
              )}
              <Icon size={15} className="relative" /> <span className="relative">{t.label}</span>
            </motion.button>
          );
        })}
      </div>

      <div>
          {/* ═══════ DASHBOARD ═══════ */}
          {tab === 'dashboard' && (
            <div className="space-y-6">
              {loading ? (
                <SkeletonStats count={4} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatTile
                    icon={Activity}
                    accent={online ? 'emerald' : 'rose'}
                    label="Conexión API"
                    value={configured ? (online ? 'Conectado' : 'Sin conexión') : 'Sin configurar'}
                    badge={online ? 'En línea' : 'Desconectado'}
                    badgeTone={online ? 'emerald' : 'rose'}
                  />
                  <StatTile
                    icon={Users}
                    accent="indigo"
                    label="Contactos sincronizados"
                    value={<AnimatedNumber value={status?.contacts?.synced} format="int" />}
                    sub={`de ${status?.contacts?.total ?? 0}`}
                  />
                  <StatTile
                    icon={Percent}
                    accent="violet"
                    label="Ratio de sincronización"
                    value={<AnimatedNumber value={status?.contacts?.percentage} format="percent" />}
                  />
                  <StatTile
                    icon={Calendar}
                    accent="amber"
                    label="Turnos registrados"
                    value={<AnimatedNumber value={status?.appointments} format="int" />}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Identificadores */}
                <div className={`${card} p-5 space-y-4`}>
                  <div className="flex items-center gap-2">
                    <Settings size={16} className="text-slate-400" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">Identificadores ARIZAR</h3>
                  </div>
                  {loading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-14 w-full rounded-xl" />
                      <Skeleton className="h-14 w-full rounded-xl" />
                      <Skeleton className="h-14 w-full rounded-xl" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <IdRow label="Location ID" value={status?.locationId} onCopy={() => copyValue(status?.locationId)} />
                      <IdRow label="Calendar ID" value={status?.calendarId} onCopy={() => copyValue(status?.calendarId)} />
                      <IdRow label="Pipeline ID" value={status?.pipelineId} onCopy={() => copyValue(status?.pipelineId)} />
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-indigo-500">Webhook</p>
                          <p className="text-xs font-mono text-indigo-600 dark:text-indigo-300 truncate">{status?.webhookUrl}</p>
                        </div>
                        <ShieldCheck size={18} className="text-indigo-500 shrink-0" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className={`${card} p-5 space-y-4`}>
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-slate-400" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">Acciones</h3>
                  </div>
                  <div className="space-y-3">
                    <ActionRow
                      icon={Bot}
                      title="Probar conexión API"
                      desc="Verifica el acceso a ARIZAR IA"
                      onClick={handleTestConnection}
                      loading={testing}
                      disabled={!configured}
                    />
                    <ActionRow
                      icon={Globe}
                      title="Refrescar webhooks"
                      desc="Re-registra los eventos del CRM"
                      onClick={handleRegisterWebhooks}
                      loading={registering}
                      disabled={!configured}
                    />
                    <ActionRow
                      icon={RefreshCcw}
                      title="Sincronizar todos los contactos"
                      desc="Empuja todos los clientes al CRM"
                      onClick={handleSyncAll}
                      loading={syncing}
                      disabled={!configured}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ MENSAJERÍA ═══════ */}
          {tab === 'messages' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className={`lg:col-span-2 ${card} p-5 space-y-5`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">Mensaje individual</h3>
                    <p className="text-sm text-slate-500">Enviá a un cliente vinculado al CRM</p>
                  </div>
                  <div className="flex gap-1.5">
                    {CHANNELS.map((ch) => {
                      const Icon = ch.icon;
                      const active = msgForm.channel === ch.id;
                      return (
                        <motion.button
                          key={ch.id}
                          type="button"
                          title={ch.label}
                          onClick={() => setMsgForm({ ...msgForm, channel: ch.id })}
                          whileTap={tapSmall}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                            active
                              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                              : 'bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                          }`}
                        >
                          <Icon size={15} />
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <form onSubmit={handleSendMessage} className="space-y-4">
                  <FormField
                    as="select"
                    label="Destinatario"
                    name="userId"
                    required
                    value={msgForm.userId}
                    onChange={(e) => setMsgForm({ ...msgForm, userId: e.target.value })}
                    hint={
                      linkedMembers.length === 0
                        ? 'No hay clientes vinculados al CRM todavía. Sincronizá contactos primero.'
                        : `${linkedMembers.length} cliente(s) vinculado(s) al CRM`
                    }
                  >
                    <option value="">Seleccionar cliente…</option>
                    {linkedMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} — {m.email}
                      </option>
                    ))}
                  </FormField>

                  {msgForm.channel === 'email' && (
                    <FormField
                      label="Asunto"
                      name="subject"
                      value={msgForm.subject}
                      onChange={(e) => setMsgForm({ ...msgForm, subject: e.target.value })}
                      placeholder="Ej: Confirmación de turno"
                    />
                  )}

                  <FormField
                    as="textarea"
                    label="Mensaje"
                    name="message"
                    required
                    rows={6}
                    value={msgForm.message}
                    onChange={(e) => setMsgForm({ ...msgForm, message: e.target.value })}
                    placeholder="Hola {{nombre}}, tu turno está confirmado."
                    hint="Variable disponible: {{nombre}}"
                  />

                  <motion.button type="submit" className={`${btnPrimary} w-full justify-center py-2.5`} disabled={sending || !configured} whileTap={sending || !configured ? undefined : tap}>
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {sending ? 'Enviando…' : 'Enviar mensaje'}
                  </motion.button>
                </form>
              </div>

              <div className={`${card} p-5 space-y-5`}>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Canales</h4>
                <ChannelHint icon={MessageSquare} tone="emerald" title="WhatsApp" desc="Recordatorios y promociones directas." />
                <ChannelHint icon={Phone} tone="sky" title="SMS" desc="Avisos cortos sin conexión a datos." />
                <ChannelHint icon={Mail} tone="indigo" title="Email" desc="Novedades y estados de cuenta." />
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] px-4 py-3">
                  <p className="text-xs text-slate-500">
                    Solo los clientes con contacto sincronizado en ARIZAR pueden recibir mensajes. Usá “Sincronizar todo” en la pestaña Estado.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ DIFUSIÓN ═══════ */}
          {tab === 'broadcast' && (
            <div className="max-w-3xl mx-auto">
              <div className={`${card} p-5 space-y-5`}>
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Megaphone size={18} />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">Difusión masiva</h3>
                    <p className="text-sm text-slate-500">Enviá un mensaje a tu base sincronizada en ARIZAR</p>
                  </div>
                </div>

                <form onSubmit={handleBroadcast} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      as="select"
                      label="Canal"
                      name="channel"
                      value={broadcastForm.channel}
                      onChange={(e) => setBroadcastForm({ ...broadcastForm, channel: e.target.value })}
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                    </FormField>
                    <FormField
                      as="select"
                      label="Segmento"
                      name="filter"
                      value={broadcastForm.filter}
                      onChange={(e) => setBroadcastForm({ ...broadcastForm, filter: e.target.value })}
                    >
                      <option value="active">Solo miembros activos</option>
                      <option value="all">Todos los clientes</option>
                    </FormField>
                  </div>

                  {broadcastForm.channel === 'email' && (
                    <FormField
                      label="Asunto"
                      name="b-subject"
                      value={broadcastForm.subject}
                      onChange={(e) => setBroadcastForm({ ...broadcastForm, subject: e.target.value })}
                      placeholder="Ej: Novedades de Luxury Garage"
                    />
                  )}

                  <FormField
                    as="textarea"
                    label="Mensaje de campaña"
                    name="b-message"
                    required
                    rows={7}
                    value={broadcastForm.message}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                    placeholder="Lanzamos nuevos servicios premium…"
                    hint="Variable disponible: {{nombre}}"
                  />

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Alcance estimado:{' '}
                        <AnimatedNumber className="font-semibold text-slate-900 dark:text-white tabular-nums" value={broadcastRecipients.length} format="int" />{' '}
                        contacto(s) vinculado(s)
                      </p>
                    </div>
                    <motion.button type="submit" className={btnPrimary} disabled={sending || !configured} whileTap={sending || !configured ? undefined : tap}>
                      {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      {sending ? 'Enviando…' : 'Lanzar campaña'}
                    </motion.button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ═══════ CAPTACIÓN ═══════ */}
          {tab === 'links' && (
            <div className="max-w-2xl">
              <div className={`${card} p-5 space-y-5`}>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Enlace de auto-registro</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Compartí este link para que nuevos clientes se registren y se vinculen automáticamente al CRM.
                  </p>
                </div>

                {registrationLink ? (
                  <>
                    <div className="relative">
                      <input
                        readOnly
                        value={registrationLink}
                        className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl pl-3.5 pr-11 py-2.5 text-sm font-mono text-slate-700 dark:text-slate-200 focus:outline-none"
                      />
                      <motion.button
                        type="button"
                        onClick={copyLink}
                        whileTap={tapSmall}
                        title="Copiar"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
                      >
                        <Copy size={15} />
                      </motion.button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <motion.button onClick={copyLink} className={`${btnSecondary} flex-1 justify-center`} whileTap={tap}>
                        <Copy size={15} /> Copiar link
                      </motion.button>
                      <motion.button onClick={shareWhatsApp} className={`${btnPrimary} flex-1 justify-center`} whileTap={tap}>
                        <MessageSquare size={15} /> Compartir por WhatsApp
                      </motion.button>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon="🔗"
                    title="Link no disponible"
                    message="No se pudo obtener el enlace de registro. Verificá la configuración del servidor."
                  />
                )}
              </div>
            </div>
          )}

          {/* ═══════ AUDITORÍA ═══════ */}
          {tab === 'logs' && (
            <>
              {logsLoading ? (
                <SkeletonTable rows={6} cols={5} />
              ) : logs.length === 0 ? (
                <div className={`${card} p-6`}>
                  <EmptyState
                    icon="📋"
                    title="Sin registros"
                    message="Las acciones de ARIZAR (sincronización, mensajes, difusiones) aparecerán acá."
                  />
                </div>
              ) : (
                <div className={`${card} overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/60 dark:bg-white/[0.02] text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                          <th className="px-5 py-3.5 font-medium">Fecha</th>
                          <th className="px-5 py-3.5 font-medium">Acción</th>
                          <th className="px-5 py-3.5 font-medium">Entidad</th>
                          <th className="px-5 py-3.5 font-medium">Usuario</th>
                          <th className="px-5 py-3.5 font-medium">Detalles</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => {
                          const isError = String(log.action || '').toLowerCase().includes('error');
                          return (
                            <tr
                              key={log.id}
                              className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                            >
                              <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap font-mono">
                                {new Date(log.createdAt).toLocaleString('es-PY')}
                              </td>
                              <td className="px-5 py-3.5">
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                                    isError
                                      ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                      : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{log.entity}</td>
                              <td className="px-5 py-3.5">
                                {log.user ? (
                                  <span className="text-slate-700 dark:text-slate-200">
                                    {log.user.firstName} {log.user.lastName}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Sistema</span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 max-w-[260px]">
                                <span className="block truncate text-xs font-mono text-slate-400">
                                  {log.detailsJson ? JSON.stringify(log.detailsJson) : '—'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
}

/* ── Subcomponentes ── */

const ACCENTS = {
  emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
  indigo: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  violet: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400',
  amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sky: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

const TONE_BADGE = {
  emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

function StatTile({ icon: Icon, accent = 'indigo', label, value, sub, badge, badgeTone }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${ACCENTS[accent]}`}>
          <Icon size={18} />
        </span>
        {badge && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${TONE_BADGE[badgeTone] || TONE_BADGE.emerald}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <div className="flex items-baseline gap-1.5 mt-1">
        <p className="text-xl font-semibold text-slate-900 dark:text-white tabular-nums">{value}</p>
        {sub && <p className="text-sm text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function IdRow({ label, value, onCopy }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="text-xs font-mono text-slate-700 dark:text-slate-200 truncate">{value || 'Pendiente'}</p>
      </div>
      {value && (
        <motion.button onClick={onCopy} whileTap={reduceMotion ? undefined : { scale: 0.9 }} className="shrink-0 text-slate-400 hover:text-indigo-600 transition-colors" title="Copiar">
          <Copy size={14} />
        </motion.button>
      )}
    </div>
  );
}

function ActionRow({ icon: Icon, title, desc, onClick, loading, disabled }) {
  const reduceMotion = useReducedMotion();
  const inert = loading || disabled;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={inert}
      whileTap={inert || reduceMotion ? undefined : { scale: 0.98 }}
      className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] px-4 py-3 text-left hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-8 h-8 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{title}</p>
          <p className="text-xs text-slate-400 truncate">{desc}</p>
        </div>
      </div>
      <ChevronRight size={15} className="text-slate-300 dark:text-slate-600 shrink-0" />
    </motion.button>
  );
}

function ChannelHint({ icon: Icon, tone, title, desc }) {
  return (
    <div className="flex gap-3">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ACCENTS[tone]}`}>
        <Icon size={16} />
      </span>
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-white">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
