import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Target, Calendar, Sparkles,
  ClipboardList, HardHat, CircleDollarSign, BarChart3,
  Tag, Box, Car, Star, Bell, Settings, ScrollText,
  Bot, LogOut, Menu, X, ChevronRight, Search, ScanLine
} from 'lucide-react';

const adminMenu = [
  {
    section: 'Principal', items: [
      { to: '/admin', icon: <LayoutDashboard size={18} />, label: 'Dashboard', end: true },
      { to: '/admin/members', icon: <Users size={18} />, label: 'Miembros' },
      { to: '/admin/leads', icon: <Target size={18} />, label: 'Leads' },
    ]
  },
  {
    section: 'Operaciones', items: [
      { to: '/admin/calendar', icon: <Calendar size={18} />, label: 'Agenda' },
      { to: '/admin/services', icon: <Sparkles size={18} />, label: 'Servicios' },
      { to: '/admin/plans', icon: <ClipboardList size={18} />, label: 'Planes' },
      { to: '/admin/employees', icon: <HardHat size={18} />, label: 'Empleados' },
      { to: '/admin/scans', icon: <ScanLine size={18} />, label: 'Escaneos' },
    ]
  },
  {
    section: 'Finanzas & Stock', items: [
      { to: '/admin/finance', icon: <CircleDollarSign size={18} />, label: 'Finanzas' },
      { to: '/admin/reports', icon: <BarChart3 size={18} />, label: 'Reportes' },
      { to: '/admin/promotions', icon: <Tag size={18} />, label: 'Promociones' },
      { to: '/admin/inventory', icon: <Box size={18} />, label: 'Inventario' },
    ]
  },
  {
    section: 'Sistema', items: [
      { to: '/admin/vehicles', icon: <Car size={18} />, label: 'Vehículos' },
      { to: '/admin/reviews', icon: <Star size={18} />, label: 'Reseñas' },
      { to: '/admin/notifications', icon: <Bell size={18} />, label: 'Notificaciones' },
      { to: '/admin/settings', icon: <Settings size={18} />, label: 'Configuración' },
      { to: '/admin/logs', icon: <ScrollText size={18} />, label: 'Logs Sistema' },
      { to: '/admin/crm', icon: <Bell size={18} />, label: 'Avisos Clientes' },
    ]
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="admin-shell flex min-h-screen">
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] lg:hidden animate-in fade-in duration-300" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar Aside */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-slate-900 border-r border-white/5 flex flex-col z-[105] transition-transform duration-500 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 outline-none'}`}>
        {/* Logo Section */}
        <div className="p-8">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/admin')}>
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 rotate-3 group-hover:rotate-0 transition-transform duration-300">
              <Car size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-headline font-black italic tracking-tighter text-white leading-none">LUXURY GARAGE</h2>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary mt-1">Admin Central</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-8 no-scrollbar">
          {adminMenu.map((section, si) => (
            <div key={si} className="space-y-1">
              <h4 className="px-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4 flex items-center gap-2">
                <span className="w-1 h-1 bg-slate-700 rounded-full" /> {section.section}
              </h4>
              <div className="space-y-1">
                {section.items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `
                      flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 group
                      ${isActive
                        ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'}
                    `}
                    onClick={() => setMobileOpen(false)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`transition-transform duration-300 group-hover:scale-110 ${location.pathname === item.to ? 'text-white' : 'text-slate-400 group-hover:text-primary'}`}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {location.pathname === item.to && <ChevronRight size={14} className="opacity-50" />}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User / Footer */}
        <div className="p-6 bg-white/5 border-t border-white/5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-primary font-black uppercase text-xs shadow-inner">
              {user?.firstName?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-red-500/20 group"
          >
            <LogOut size={14} className="group-hover:-translate-x-1 transition-transform" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col relative overflow-x-hidden">
        {/* Top bar / Header (Mobile) */}
        <header className={`sticky top-0 z-[90] lg:hidden flex items-center justify-between p-4 transition-all duration-300 ${scrolled ? 'bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-black/5 dark:border-white/5' : 'bg-transparent'}`}>
          <span className="font-headline font-black text-slate-900 dark:text-white tracking-widest text-xs uppercase italic">Luxury Admin</span>
          <button onClick={() => setMobileOpen(true)} className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg">
            <Menu size={20} />
          </button>
        </header>

        <div className="w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
