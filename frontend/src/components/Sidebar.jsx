import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const clientMenu = [
  { section: 'Principal', items: [
    { to: '/client', icon: '🏠', label: 'Dashboard', end: true },
    { to: '/client/membership', icon: '👑', label: 'Mi Membresía' },
    { to: '/client/vehicles', icon: '🚗', label: 'Mis Vehículos' },
  ]},
  { section: 'Servicios', items: [
    { to: '/client/book', icon: '📅', label: 'Agendar Turno' },
    { to: '/client/appointments', icon: '🕐', label: 'Mis Turnos' },
    { to: '/client/history', icon: '📋', label: 'Historial' },
    { to: '/client/extras', icon: '✨', label: 'Servicios Extra' },
  ]},
  { section: 'Cuenta', items: [
    { to: '/client/wallet', icon: '💰', label: 'Billetera / Shop' },
    { to: '/client/referrals', icon: '🎁', label: 'Referidos' },
    { to: '/client/invoices', icon: '🧾', label: 'Facturas' },
    { to: '/client/reviews', icon: '⭐', label: 'Calificaciones' },
    { to: '/client/notifications', icon: '🔔', label: 'Notificaciones' },
    { to: '/client/card', icon: '💳', label: 'Tarjeta QR' },
    { to: '/client/profile', icon: '👤', label: 'Mi Perfil' },
  ]},
];

const adminMenu = [
  { section: 'Principal', items: [
    { to: '/admin', icon: '📊', label: 'Dashboard', end: true },
    { to: '/admin/members', icon: '👥', label: 'Miembros' },
    { to: '/admin/leads', icon: '🎯', label: 'Leads' },
  ]},
  { section: 'Operaciones', items: [
    { to: '/admin/calendar', icon: '📅', label: 'Agenda' },
    { to: '/admin/services', icon: '✨', label: 'Servicios' },
    { to: '/admin/plans', icon: '📋', label: 'Planes' },
    { to: '/admin/employees', icon: '👷', label: 'Empleados' },
  ]},
  { section: 'Finanzas', items: [
    { to: '/admin/finance', icon: '💰', label: 'Finanzas' },
    { to: '/admin/reports', icon: '📈', label: 'Reportes' },
    { to: '/admin/promotions', icon: '🏷️', label: 'Promociones' },
    { to: '/admin/inventory', icon: '📦', label: 'Inventario' },
  ]},
  { section: 'Sistema', items: [
    { to: '/admin/vehicles', icon: '🚗', label: 'Vehículos' },
    { to: '/admin/reviews', icon: '⭐', label: 'Reseñas' },
    { to: '/admin/notifications', icon: '🔔', label: 'Notificaciones' },
    { to: '/admin/settings', icon: '⚙️', label: 'Configuración' },
    { to: '/admin/logs', icon: '📋', label: 'Logs' },
    { to: '/admin/crm', icon: '🤖', label: 'ARIZAR CRM' },
  ]},
];

const employeeMenu = [
  { section: 'Mi Trabajo', items: [
    { to: '/employee', icon: '📋', label: 'Mi Agenda', end: true },
    { to: '/employee/service', icon: '🔧', label: 'Servicio Activo' },
    { to: '/employee/history', icon: '📊', label: 'Mi Historial' },
    { to: '/employee/notifications', icon: '🔔', label: 'Notificaciones' },
    { to: '/employee/profile', icon: '👤', label: 'Mi Perfil' },
  ]},
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isEmbedded = window !== window.top; // detect iframe
  const [mobileOpen, setMobileOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);

  const menu = user?.role === 'CLIENT' ? clientMenu : ['SUPER_ADMIN', 'ADMIN'].includes(user?.role) ? adminMenu : employeeMenu;

  const handleLogout = () => { logout(); navigate('/login'); };

  const sidebarVisible = isEmbedded ? embedOpen : true;

  return (
    <div className={`app-layout ${isEmbedded ? 'embedded-mode' : ''} ${isEmbedded && !embedOpen ? 'sidebar-hidden' : ''}`}>
      {/* Overlay for mobile & embedded */}
      {(mobileOpen || (isEmbedded && embedOpen)) && (
        <div className="sidebar-overlay" onClick={() => { setMobileOpen(false); setEmbedOpen(false); }} />
      )}

      {/* Floating toggle button — always visible in embedded/mobile */}
      <button
        onClick={() => isEmbedded ? setEmbedOpen(!embedOpen) : setMobileOpen(!mobileOpen)}
        className={`menu-toggle-btn ${isEmbedded ? 'embedded-toggle' : 'mobile-menu-btn'}`}
      >
        {(isEmbedded ? embedOpen : mobileOpen) ? '✕' : '☰'}
      </button>

      <aside className={`sidebar ${mobileOpen ? 'open' : ''} ${isEmbedded && embedOpen ? 'open' : ''} ${isEmbedded && !embedOpen ? 'embedded-closed' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🚗</div>
          <div>
            <h2>LUXURY GARAGE</h2>
            <p>Membresías Premium</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menu.map((section, si) => (
            <div key={si} className="sidebar-section">
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => { setMobileOpen(false); if (isEmbedded) setEmbedOpen(false); }}
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  <span className="sidebar-link-text">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="sidebar-user-info">
            <strong>{user?.firstName} {user?.lastName}</strong>
            <span>{user?.role?.replace('_', ' ')}</span>
          </div>
          <button className="sidebar-logout" onClick={handleLogout} title="Cerrar sesión">🚪</button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: block !important; }
        }

        /* Embedded mode (inside ARIZAR IA iframe) */
        .embedded-toggle {
          display: block !important;
          position: fixed;
          top: 10px;
          left: 10px;
          z-index: 301;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 10px;
          padding: 8px 12px;
          color: white;
          cursor: pointer;
          font-size: 16px;
          box-shadow: 0 4px 20px rgba(99,102,241,0.4);
          transition: all 0.3s ease;
          line-height: 1;
        }
        .embedded-toggle:hover {
          transform: scale(1.08);
          box-shadow: 0 6px 28px rgba(99,102,241,0.6);
        }

        .embedded-mode .sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          z-index: 199;
        }

        .embedded-mode .sidebar {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .embedded-mode .sidebar.embedded-closed {
          transform: translateX(-100%);
          position: fixed;
          z-index: 200;
        }
        .embedded-mode .sidebar.open {
          transform: translateX(0);
          position: fixed;
          z-index: 200;
          box-shadow: 4px 0 40px rgba(0,0,0,0.6);
        }

        .embedded-mode.sidebar-hidden .main-content {
          margin-left: 0;
          width: 100%;
          padding-top: 56px;
        }

        .embedded-mode .page-header {
          padding-left: 52px;
        }
      `}</style>
    </div>
  );
}
