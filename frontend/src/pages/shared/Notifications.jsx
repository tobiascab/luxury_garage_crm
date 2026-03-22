import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    try { const res = await api.get('/notifications'); setNotifications(res.data.data || []); } catch (e) { console.error(e); }
    setLoading(false);
  };

  const markRead = async (id) => {
    try { await api.put(`/notifications/${id}/read`); loadNotifications(); } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    await Promise.all(unread.map(n => api.put(`/notifications/${n.id}/read`).catch(() => {})));
    loadNotifications();
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const iconMap = { RENEWAL_REMINDER: '🔔', APPOINTMENT_REMINDER: '📅', WELCOME: '👋', PROMOTION: '🎁', SERVICE_COMPLETED: '✅', PAYMENT: '💳' };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  return (
    <div className="page-content">
      <PageHeader title="🔔 Notificaciones" subtitle={`${unreadCount} sin leer`}
        actions={unreadCount > 0 ? <button className="btn btn-outline btn-sm" onClick={markAllRead}>Marcar todas como leídas</button> : null} />

      {notifications.length === 0 ? (
        <div className="card card-glass"><div className="empty-state"><div className="empty-state-icon">🔔</div><h3>Sin notificaciones</h3><p className="text-muted">Acá vas a ver tus avisos y recordatorios</p></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              className="card card-glass"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => !n.isRead && markRead(n.id)}
              style={{ cursor: !n.isRead ? 'pointer' : 'default', borderColor: !n.isRead ? 'rgba(30,144,255,0.2)' : undefined }}
            >
              <div className="card-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ fontSize: '1.5rem', opacity: n.isRead ? 0.5 : 1 }}>{iconMap[n.type] || '📩'}</div>
                <div style={{ flex: 1, opacity: n.isRead ? 0.6 : 1 }}>
                  <p style={{ fontWeight: n.isRead ? 400 : 600, marginBottom: '2px' }}>{n.title}</p>
                  <p className="text-sm text-muted">{n.message}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p className="text-xs text-muted">{new Date(n.createdAt).toLocaleDateString('es-PY')}</p>
                  {!n.isRead && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', marginTop: '4px', marginLeft: 'auto' }} />}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
