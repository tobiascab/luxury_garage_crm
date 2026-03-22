import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function ArizarPanel() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tab, setTab] = useState('dashboard');

  // Message form
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
    if (!confirm(`¿Enviar ${broadcastForm.channel.toUpperCase()} a todos los miembros ${broadcastForm.filter}?`)) return;
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

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
    { id: 'messages', label: '💬 Mensajes', icon: '💬' },
    { id: 'broadcast', label: '📢 Broadcast', icon: '📢' },
    { id: 'links', label: '🔗 Links', icon: '🔗' },
    { id: 'logs', label: '📋 Logs', icon: '📋' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="page-content">
      <div className="page-header">
        <h1>🤖 ARIZAR IA — CRM</h1>
        <p style={{ color: 'var(--text-muted)' }}>Integración completa con el ecosistema CRM</p>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '24px' }}>
        {tabs.map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ═══════ DASHBOARD TAB ═══════ */}
        {tab === 'dashboard' && (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Status Cards */}
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: status?.configured ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }}>
                  {status?.configured ? '🟢' : '🔴'}
                </div>
                <div className="stat-value">{status?.apiStatus === 'connected' ? 'Online' : status?.configured ? 'Config OK' : 'No Config'}</div>
                <div className="stat-label">Estado API</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📇</div>
                <div className="stat-value">{status?.contacts?.synced || 0}<span style={{ fontSize: '0.5em', color: 'var(--text-muted)' }}>/{status?.contacts?.total || 0}</span></div>
                <div className="stat-label">Contactos Sincronizados</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-value">{status?.contacts?.percentage || 0}%</div>
                <div className="stat-label">% Sincronización</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-value">{status?.appointments || 0}</div>
                <div className="stat-label">Turnos Totales</div>
              </div>
            </div>

            {/* Config Info */}
            <div className="card" style={{ marginBottom: '24px' }}>
              <h3>⚙️ Configuración</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div style={{ padding: '12px', background: 'var(--glass-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <small style={{ color: 'var(--text-muted)' }}>Location ID</small>
                  <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>{status?.locationId || '⚠️ Pendiente'}</p>
                </div>
                <div style={{ padding: '12px', background: 'var(--glass-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <small style={{ color: 'var(--text-muted)' }}>Calendar ID</small>
                  <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>{status?.calendarId || '⚠️ Pendiente'}</p>
                </div>
                <div style={{ padding: '12px', background: 'var(--glass-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <small style={{ color: 'var(--text-muted)' }}>Pipeline ID</small>
                  <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>{status?.pipelineId || '⚠️ Pendiente'}</p>
                </div>
                <div style={{ padding: '12px', background: 'var(--glass-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <small style={{ color: 'var(--text-muted)' }}>Webhook URL</small>
                  <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all', color: 'var(--cyan)' }}>{status?.webhookUrl}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={handleTestConnection} disabled={testing}>
                {testing ? '⏳ Probando...' : '🔌 Probar Conexión'}
              </button>
              <button className="btn btn-primary" onClick={handleSyncAll} disabled={syncing}>
                {syncing ? '⏳ Sincronizando...' : '🔄 Sync Todos los Contactos'}
              </button>
              <button className="btn btn-secondary" onClick={handleRegisterWebhooks}>
                🪝 Registrar Webhooks
              </button>
              <button className="btn btn-secondary" onClick={() => { loadStatus(); loadLogs(); toast.success('Datos actualizados'); }}>
                🔃 Refrescar
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══════ MESSAGES TAB ═══════ */}
        {tab === 'messages' && (
          <motion.div key="messages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="card">
              <h3>💬 Enviar Mensaje Individual</h3>
              <form onSubmit={handleSendMessage} style={{ marginTop: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Cliente</label>
                  <select className="form-input" value={msgForm.userId} onChange={e => setMsgForm({...msgForm, userId: e.target.value})} required>
                    <option value="">Seleccionar cliente...</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName} — {m.email} {m.arizarContactId ? '✅' : '⚠️'}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Canal</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['whatsapp', 'sms', 'email'].map(ch => (
                      <button key={ch} type="button" className={`btn ${msgForm.channel === ch ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setMsgForm({...msgForm, channel: ch})} style={{ flex: 1, textTransform: 'capitalize' }}>
                        {ch === 'whatsapp' ? '💬' : ch === 'sms' ? '📱' : '📧'} {ch}
                      </button>
                    ))}
                  </div>
                </div>
                {msgForm.channel === 'email' && (
                  <div className="form-group">
                    <label className="form-label">Asunto</label>
                    <input className="form-input" value={msgForm.subject} onChange={e => setMsgForm({...msgForm, subject: e.target.value})} placeholder="Asunto del email" />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Mensaje</label>
                  <textarea className="form-input" rows={4} value={msgForm.message} onChange={e => setMsgForm({...msgForm, message: e.target.value})} required
                    placeholder="Escribí tu mensaje... Usá {{nombre}} para personalizar" />
                </div>
                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? '⏳ Enviando...' : '🚀 Enviar'}
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {/* ═══════ BROADCAST TAB ═══════ */}
        {tab === 'broadcast' && (
          <motion.div key="broadcast" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="card">
              <h3>📢 Envío Masivo</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Envía un mensaje a todos los miembros con contacto CRM vinculado. Usá <code style={{ color: 'var(--cyan)' }}>{'{{nombre}}'}</code> para personalizar.</p>
              <form onSubmit={handleBroadcast}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Canal</label>
                    <select className="form-input" value={broadcastForm.channel} onChange={e => setBroadcastForm({...broadcastForm, channel: e.target.value})}>
                      <option value="whatsapp">💬 WhatsApp</option>
                      <option value="sms">📱 SMS</option>
                      <option value="email">📧 Email</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Filtro</label>
                    <select className="form-input" value={broadcastForm.filter} onChange={e => setBroadcastForm({...broadcastForm, filter: e.target.value})}>
                      <option value="active">Miembros Activos</option>
                      <option value="all">Todos</option>
                    </select>
                  </div>
                </div>
                {broadcastForm.channel === 'email' && (
                  <div className="form-group">
                    <label className="form-label">Asunto</label>
                    <input className="form-input" value={broadcastForm.subject} onChange={e => setBroadcastForm({...broadcastForm, subject: e.target.value})} placeholder="Asunto del email" />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Mensaje</label>
                  <textarea className="form-input" rows={5} value={broadcastForm.message} onChange={e => setBroadcastForm({...broadcastForm, message: e.target.value})} required
                    placeholder="Hola {{nombre}}, tenemos una oferta especial para vos..." />
                </div>
                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? '⏳ Enviando...' : '📢 Enviar Broadcast'}
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {/* ═══════ LINKS TAB ═══════ */}
        {tab === 'links' && (
          <motion.div key="links" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="card" style={{ marginBottom: '24px' }}>
              <h3>🔗 Link de Registro</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                Compartí este link con clientes para que se registren directamente en el portal.
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '12px', background: 'var(--glass-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <input className="form-input" value={registrationLink} readOnly style={{ flex: 1, margin: 0, border: 'none', background: 'transparent' }} />
                <button className="btn btn-primary" onClick={copyLink}>📋 Copiar</button>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button className="btn btn-primary" onClick={shareWhatsApp} style={{ background: '#25D366' }}>
                  💬 Compartir por WhatsApp
                </button>
              </div>
            </div>

            <div className="card">
              <h3>📱 Vías de Entrada de Clientes</h3>
              <div style={{ marginTop: '12px' }}>
                {[
                  { icon: '💬', title: 'WhatsApp → ARIZAR IA', desc: 'Bot automático captura lead → pago → auto-crear usuario', status: '✅ Activo (via webhook)' },
                  { icon: '🔗', title: 'Link de Registro', desc: 'Empleado/admin comparte link → cliente se registra → sync CRM', status: '✅ Activo' },
                  { icon: '👤', title: 'Crear desde Admin', desc: 'Admin/empleado crea cliente manualmente → envía credenciales por WhatsApp', status: '✅ Activo' },
                  { icon: '🌐', title: 'Landing de ARIZAR IA', desc: 'Funnel de venta → pago → webhook auto-crea usuario', status: '✅ Activo (via webhook)' },
                  { icon: '📝', title: 'Formulario Web', desc: 'Form submission webhook → auto-tag como lead', status: '✅ Activo (via webhook)' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '16px', padding: '16px', borderBottom: i < 4 ? '1px solid var(--glass-border)' : 'none', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <strong>{item.title}</strong>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '2px 0 0' }}>{item.desc}</p>
                    </div>
                    <span style={{ color: 'var(--success)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════ LOGS TAB ═══════ */}
        {tab === 'logs' && (
          <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>📋 Logs de Sincronización</h3>
                <button className="btn btn-secondary btn-sm" onClick={loadLogs}>🔃 Refrescar</button>
              </div>
              {logs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px' }}>No hay logs de sincronización aún</p>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Acción</th>
                        <th>Entidad</th>
                        <th>Usuario</th>
                        <th>Detalles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(log => (
                        <tr key={log.id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{new Date(log.createdAt).toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}</td>
                          <td>
                            <span className={`badge ${log.action.includes('error') ? 'badge-danger' : 'badge-success'}`}>
                              {log.action}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>{log.entity}</td>
                          <td style={{ fontSize: '0.85rem' }}>{log.user?.firstName} {log.user?.lastName}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {JSON.stringify(log.details).substring(0, 80)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
