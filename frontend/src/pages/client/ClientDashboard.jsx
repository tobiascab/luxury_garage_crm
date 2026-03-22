import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import StatCard from '../../components/StatCard';

export default function ClientDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await api.get('/dashboard/client');
      setData(res.data.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const membership = user?.memberships?.[0];
  const plan = membership?.plan;

  return (
    <div className="page-content">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <h1>👋 Hola, {user?.firstName}!</h1>
          <p className="text-muted">Bienvenido a tu portal Luxury Garage</p>
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="stats-grid">
        <StatCard
          icon="👑"
          title="Tu Plan"
          value={plan?.name || 'Sin plan'}
          color={plan?.name === 'VIP' ? '#F59E0B' : plan?.name === 'Premium' ? '#8B5CF6' : '#1E90FF'}
        />
        <StatCard
          icon="📅"
          title="Próximo Turno"
          value={data?.nextAppointment ? new Date(data.nextAppointment.startTime).toLocaleDateString('es-PY', { day: 'numeric', month: 'short' }) : 'Sin turnos'}
          color="#00D4FF"
        />
        <StatCard
          icon="🚿"
          title="Lavados este mes"
          value={`${data?.servicesThisMonth || 0}${plan?.servicesLimit ? `/${plan.servicesLimit}` : '/∞'}`}
          color="#10B981"
        />
        <StatCard
          icon="💰"
          title="Billetera"
          value={`₲${(data?.walletBalance || 0).toLocaleString()}`}
          color="#F59E0B"
        />
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Membership Card */}
        <motion.div className="card card-glass" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <div className="card-header">
            <h3>👑 Mi Membresía</h3>
            <StatusBadge status={membership?.status || 'PENDING'} />
          </div>
          <div className="card-body">
            {plan ? (
              <>
                <div className="membership-plan-name" style={{ background: plan.name === 'VIP' ? 'linear-gradient(135deg, #F59E0B, #FBBF24)' : plan.name === 'Premium' ? 'linear-gradient(135deg, #8B5CF6, #A78BFA)' : 'linear-gradient(135deg, #1E90FF, #00D4FF)' }}>
                  {plan.name}
                </div>
                <p className="text-sm text-muted" style={{ marginTop: '12px' }}>
                  Vence: {membership?.endDate ? new Date(membership.endDate).toLocaleDateString('es-PY') : '—'}
                </p>
                <div className="membership-progress">
                  <div className="progress-label">
                    <span>Uso del mes</span>
                    <span>{data?.servicesThisMonth || 0} servicios</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: plan.servicesLimit ? `${Math.min(100, ((data?.servicesThisMonth || 0) / plan.servicesLimit) * 100)}%` : '100%' }} />
                  </div>
                </div>
                <a href="/client/membership" className="btn btn-outline" style={{ marginTop: '12px', width: '100%', textAlign: 'center' }}>
                  Ver detalles →
                </a>
              </>
            ) : (
              <div className="empty-state-small">
                <p>No tenés membresía activa</p>
                <a href="/client/membership" className="btn btn-primary">Elegir Plan</a>
              </div>
            )}
          </div>
        </motion.div>

        {/* Next Appointment */}
        <motion.div className="card card-glass" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
          <div className="card-header">
            <h3>📅 Próximo Turno</h3>
          </div>
          <div className="card-body">
            {data?.nextAppointment ? (
              <div className="next-appointment">
                <div className="appointment-date">
                  <span className="day">{new Date(data.nextAppointment.startTime).getDate()}</span>
                  <span className="month">{new Date(data.nextAppointment.startTime).toLocaleDateString('es-PY', { month: 'short' })}</span>
                </div>
                <div className="appointment-details">
                  <strong>{data.nextAppointment.service?.name}</strong>
                  <p className="text-muted">
                    {new Date(data.nextAppointment.startTime).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-sm">
                    🚗 {data.nextAppointment.vehicle?.brand} {data.nextAppointment.vehicle?.model}
                  </p>
                </div>
                <StatusBadge status={data.nextAppointment.status} />
              </div>
            ) : (
              <div className="empty-state-small">
                <p>No tenés turnos programados</p>
                <a href="/client/book" className="btn btn-primary">Agendar Turno</a>
              </div>
            )}
          </div>
        </motion.div>

        {/* Vehicle */}
        <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="card-header">
            <h3>🚗 Mi Vehículo</h3>
            <a href="/client/vehicles" className="btn-link">Ver todos →</a>
          </div>
          <div className="card-body">
            {user?.vehicles?.[0] ? (
              <div className="vehicle-card-mini">
                <div className="vehicle-icon">🚗</div>
                <div>
                  <strong>{user.vehicles[0].brand} {user.vehicles[0].model}</strong>
                  <p className="text-muted">{user.vehicles[0].year} • {user.vehicles[0].color} • {user.vehicles[0].licensePlate}</p>
                  {user.vehicles[0].notes && <p className="text-sm vehicle-notes">📋 {user.vehicles[0].notes}</p>}
                </div>
              </div>
            ) : (
              <div className="empty-state-small">
                <p>Registrá tu vehículo</p>
                <a href="/client/vehicles" className="btn btn-primary">Agregar</a>
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="card-header">
            <h3>⚡ Acciones Rápidas</h3>
          </div>
          <div className="card-body">
            <div className="quick-actions">
              <a href="/client/book" className="quick-action-btn">
                <span className="qa-icon">📅</span>
                <span>Agendar Turno</span>
              </a>
              <a href="/client/history" className="quick-action-btn">
                <span className="qa-icon">📋</span>
                <span>Historial</span>
              </a>
              <a href="/client/referrals" className="quick-action-btn">
                <span className="qa-icon">🎁</span>
                <span>Invitar Amigo</span>
              </a>
              <a href="/client/wallet" className="quick-action-btn">
                <span className="qa-icon">💰</span>
                <span>Mi Billetera</span>
              </a>
              <a href="/client/card" className="quick-action-btn">
                <span className="qa-icon">💳</span>
                <span>Tarjeta QR</span>
              </a>
              <a href="/client/extras" className="quick-action-btn">
                <span className="qa-icon">✨</span>
                <span>Servicios Extra</span>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
