import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const clientMenu = [
  {
    section: 'Principal', items: [
      { to: '/client', icon: '🏠', label: 'Dashboard', end: true },
      { to: '/client/membership', icon: '👑', label: 'Mi Membresía' },
      { to: '/client/vehicles', icon: '🚗', label: 'Mis Vehículos' },
    ]
  },
  {
    section: 'Servicios', items: [
      { to: '/client/book', icon: '📅', label: 'Agendar Turno' },
      { to: '/client/appointments', icon: '🕐', label: 'Mis Turnos' },
      { to: '/client/history', icon: '📋', label: 'Historial' },
      { to: '/client/extras', icon: '✨', label: 'Servicios Extra' },
    ]
  },
  {
    section: 'Cuenta', items: [
      { to: '/client/wallet', icon: '💰', label: 'Billetera / Shop' },
      { to: '/client/referrals', icon: '🎁', label: 'Referidos' },
      { to: '/client/invoices', icon: '🧾', label: 'Facturas' },
      { to: '/client/reviews', icon: '⭐', label: 'Calificaciones' },
      { to: '/client/notifications', icon: '🔔', label: 'Notificaciones' },
      { to: '/client/card', icon: '💳', label: 'Tarjeta QR' },
      { to: '/client/profile', icon: '👤', label: 'Mi Perfil' },
    ]
  },
];

const adminMenu = [
  {
    section: 'Principal', items: [
      { to: '/admin', icon: '📊', label: 'Dashboard', end: true },
      { to: '/admin/members', icon: '👥', label: 'Miembros' },
      { to: '/admin/leads', icon: '🎯', label: 'Leads' },
    ]
  },
  {
    section: 'Operaciones', items: [
      { to: '/admin/calendar', icon: '📅', label: 'Agenda' },
      { to: '/admin/services', icon: '✨', label: 'Servicios' },
      { to: '/admin/plans', icon: '📋', label: 'Planes' },
      { to: '/admin/employees', icon: '👷', label: 'Empleados' },
    ]
  },
  {
    section: 'Finanzas', items: [
      { to: '/admin/finance', icon: '💰', label: 'Finanzas' },
      { to: '/admin/reports', icon: '📈', label: 'Reportes' },
      { to: '/admin/promotions', icon: '🏷️', label: 'Promociones' },
      { to: '/admin/inventory', icon: '📦', label: 'Inventario' },
    ]
  },
  {
    section: 'Sistema', items: [
      { to: '/admin/vehicles', icon: '🚗', label: 'Vehículos' },
      { to: '/admin/reviews', icon: '⭐', label: 'Reseñas' },
      { to: '/admin/notifications', icon: '🔔', label: 'Notificaciones' },
      { to: '/admin/settings', icon: '⚙️', label: 'Configuración' },
      { to: '/admin/logs', icon: '📋', label: 'Logs' },
      { to: '/admin/crm', icon: '🤖', label: 'ARIZAR CRM' },
    ]
  },
];

const employeeMenu = [
  {
    section: 'Mi Trabajo', items: [
      { to: '/employee', icon: '📋', label: 'Mi Agenda', end: true },
      { to: '/employee/service', icon: '🔧', label: 'Servicio Activo' },
      { to: '/employee/history', icon: '📊', label: 'Mi Historial' },
      { to: '/employee/notifications', icon: '🔔', label: 'Notificaciones' },
      { to: '/employee/profile', icon: '👤', label: 'Mi Perfil' },
    ]
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const menu = user?.role === 'CLIENT' ? clientMenu : ['SUPER_ADMIN', 'ADMIN'].includes(user?.role) ? adminMenu : employeeMenu;

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Overlay for mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Floating toggle button for mobile */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed bottom-6 right-6 z-[110] lg:hidden w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-transform"
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar Content */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-slate-900 border-r border-white/5 flex flex-col z-[105] transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 rotate-3">
              <span className="text-2xl">🚗</span>
            </div>
            <div>
              <h2 className="text-xl font-headline font-black italic tracking-tighter text-white leading-none">LUXURY GARAGE</h2>
              <p className="text-[9px] font-black uppercase tracking-widest text-primary mt-1">Admin Central</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-8 space-y-8 no-scrollbar">
          {menu.map((section, si) => (
            <div key={si} className="space-y-2">
              <h4 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">{section.section}</h4>
              <div className="space-y-1">
                {section.items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group ${isActive ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className={`text-lg transition-transform group-hover:scale-110`}>{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-6 bg-white/5 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-primary font-black uppercase text-xs">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1">
              <p className="text-xs font-black text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
          >
            <span>🚪</span> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="max-w-7xl mx-auto w-full p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
