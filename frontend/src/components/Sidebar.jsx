import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, useReducedMotion, MotionConfig } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import useScrollLock from '../hooks/useScrollLock';
import {
  LayoutDashboard, Users, Crown, Calendar, Sparkles,
  ClipboardList, HardHat, CircleDollarSign, BarChart3,
  Tag, Box, Car, Star, Bell, Settings, ScrollText,
  LogOut, Menu, ScanLine, CreditCard,
  Moon, Sun, Wallet, Calculator, MessageSquare,
  ChevronDown, PanelLeftClose, PanelLeftOpen, Search, X, FileSignature, ShoppingBag, Receipt } from 'lucide-react';

// Cada entrada es un MÓDULO grande (padre) que se abre en submódulos (acordeón).
const adminMenu = [
  {
    id: 'principal', label: 'Principal', icon: <LayoutDashboard size={18} />,
    items: [
      { to: '/admin', icon: <LayoutDashboard size={17} />, label: 'Dashboard', end: true },
      { to: '/admin/members', icon: <Users size={17} />, label: 'Miembros' },
      { to: '/admin/memberships', icon: <Crown size={17} />, label: 'Membresías' },
      { to: '/admin/solicitudes', icon: <ClipboardList size={17} />, label: 'Solicitudes' },
    ]
  },
  {
    id: 'operaciones', label: 'Operaciones', icon: <Sparkles size={18} />,
    items: [
      { to: '/admin/calendar', icon: <Calendar size={17} />, label: 'Agenda' },
      { to: '/admin/services', icon: <Sparkles size={17} />, label: 'Servicios' },
      { to: '/admin/plans', icon: <ClipboardList size={17} />, label: 'Planes' },
      { to: '/admin/employees', icon: <HardHat size={17} />, label: 'Empleados' },
      { to: '/admin/scans', icon: <ScanLine size={17} />, label: 'Escaneos' },
    ]
  },
  {
    id: 'finanzas', label: 'Finanzas & Stock', icon: <CircleDollarSign size={18} />,
    items: [
      { to: '/admin/finance', icon: <CircleDollarSign size={17} />, label: 'Finanzas' },
      { to: '/admin/cobros', icon: <CreditCard size={17} />, label: 'Cobros' },
      { to: '/admin/contratos', icon: <FileSignature size={17} />, label: 'Contratos' },
      { to: '/admin/expenses', icon: <Wallet size={17} />, label: 'Egresos' },
      { to: '/admin/accounting', icon: <Calculator size={17} />, label: 'Contabilidad' },
      { to: '/admin/reports', icon: <BarChart3 size={17} />, label: 'Reportes' },
      { to: '/admin/promotions', icon: <Tag size={17} />, label: 'Promociones' },
      { to: '/admin/inventory', icon: <Box size={17} />, label: 'Inventario' },
      { to: '/admin/catalogo', icon: <ShoppingBag size={17} />, label: 'Catálogo tienda' },
      { to: '/admin/caja', icon: <Receipt size={17} />, label: 'Caja del día' },
    ]
  },
  {
    id: 'sistema', label: 'Sistema', icon: <Settings size={18} />,
    items: [
      { to: '/admin/vehicles', icon: <Car size={17} />, label: 'Vehículos' },
      { to: '/admin/reviews', icon: <Star size={17} />, label: 'Reseñas' },
      { to: '/admin/notifications', icon: <Bell size={17} />, label: 'Notificaciones' },
      { to: '/admin/settings', icon: <Settings size={17} />, label: 'Configuración' },
      { to: '/admin/logs', icon: <ScrollText size={17} />, label: 'Logs Sistema' },
      { to: '/admin/crm', icon: <Bell size={17} />, label: 'Avisos Clientes' },
      { to: '/admin/chat-inbox', icon: <MessageSquare size={17} />, label: 'Chat Clientes' },
    ]
  },
];

const isItemActive = (item, pathname) =>
  item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/');

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.97 };
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Riel minimizado (solo desktop), persistido aparte del tema.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('admin-sidebar-collapsed') === '1');
  // Tema propio del admin (clave separada del shell cliente para no heredar
  // un estado volátil). Default: oscuro, coherente con el sidebar y la marca.
  const [dark, setDark] = useState(() => (localStorage.getItem('admin-theme') ?? 'dark') === 'dark');

  // Módulo padre que contiene la ruta activa → se abre solo.
  const activeGroupId = useMemo(
    () => adminMenu.find(g => g.items.some(it => isItemActive(it, location.pathname)))?.id,
    [location.pathname]
  );
  // Acordeón: un solo módulo abierto a la vez.
  const [openGroup, setOpenGroup] = useState(activeGroupId || adminMenu[0].id);
  // Buscador de módulos / submódulos.
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  // Al navegar, abrir el módulo de la ruta activa.
  useEffect(() => { if (activeGroupId) setOpenGroup(activeGroupId); }, [activeGroupId]);

  // Filtra por módulo (muestra todos sus submódulos) o por submódulo coincidente.
  const filteredMenu = useMemo(() => {
    if (!q) return adminMenu;
    return adminMenu
      .map(g => {
        if (g.label.toLowerCase().includes(q)) return g;
        const items = g.items.filter(it => it.label.toLowerCase().includes(q));
        return items.length ? { ...g, items } : null;
      })
      .filter(Boolean);
  }, [q]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Aplica/persiste el tema del admin sobre <html> cada vez que cambia.
  useEffect(() => {
    localStorage.setItem('admin-theme', dark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Persiste el estado minimizado del riel.
  useEffect(() => { localStorage.setItem('admin-sidebar-collapsed', collapsed ? '1' : '0'); }, [collapsed]);

  // Bloquea el scroll del fondo mientras el menú lateral móvil está abierto.
  useScrollLock(mobileOpen);

  const handleLogout = () => { logout(); navigate('/login'); };
  const toggleGroup = (id) => setOpenGroup(prev => (prev === id ? null : id));

  // En móvil (menú abierto) siempre mostramos la barra completa con etiquetas.
  const railed = collapsed && !mobileOpen;

  return (
    <div className="admin-shell flex min-h-screen">
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] lg:hidden animate-in fade-in duration-300" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar Aside */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen bg-slate-950 border-r border-white/[0.06] flex flex-col z-[105] transition-[width,transform] duration-300 ease-in-out w-64 ${railed ? 'lg:w-[76px]' : 'lg:w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 outline-none'}`}>
        {/* Logo Section */}
        <div className="px-3 pt-6 pb-5 border-b border-white/[0.06]">
          <div className={`flex items-center ${railed ? 'lg:flex-col lg:gap-3' : 'gap-2'}`}>
            <div className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 px-0.5" onClick={() => navigate('/admin')}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/logo.png" alt="" className="w-full h-full object-contain" />
              </div>
              {!railed && (
                <div className="min-w-0">
                  <h2 className="text-base leading-none brand-wordmark">LUXURY GARAGE</h2>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 mt-1.5">Admin Central</p>
                </div>
              )}
            </div>
            {/* Toggle minimizar (solo desktop) */}
            <motion.button
              onClick={() => setCollapsed(c => !c)}
              title={railed ? 'Expandir barra' : 'Minimizar barra'}
              aria-label={railed ? 'Expandir barra' : 'Minimizar barra'}
              whileTap={tap}
              className="hidden lg:flex w-8 h-8 shrink-0 rounded-lg items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              {railed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </motion.button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-1 no-scrollbar">
          {/* Buscador de módulos */}
          {!railed && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar módulo…"
                className="w-full h-10 pl-9 pr-8 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder-slate-500 focus:outline-none focus:border-primary/60 focus:bg-white/[0.06] transition-colors"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {(railed ? adminMenu : filteredMenu).map(group => {
            const searching = !railed && q.length > 0;
            const open = searching ? true : (!railed && openGroup === group.id);
            const groupActive = group.id === activeGroupId;
            return (
              <div key={group.id}>
                {/* Módulo grande (padre) */}
                <motion.button
                  type="button"
                  title={railed ? group.label : undefined}
                  onClick={() => (railed ? (setCollapsed(false), setOpenGroup(group.id)) : toggleGroup(group.id))}
                  whileTap={tap}
                  className={`w-full flex items-center rounded-lg text-[13px] font-semibold transition-colors duration-150 group/btn ${railed ? 'lg:justify-center px-0 py-2.5' : 'gap-3 pl-3.5 pr-3 py-2.5'} ${groupActive ? 'text-white bg-white/[0.05]' : 'text-slate-300 hover:text-white hover:bg-white/[0.03]'}`}
                >
                  <span className={groupActive ? 'text-primary' : 'text-slate-400 group-hover/btn:text-slate-200 transition-colors'}>
                    {group.icon}
                  </span>
                  {!railed && <span className="flex-1 text-left">{group.label}</span>}
                  {!railed && (
                    <ChevronDown size={15} className={`shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                  )}
                </motion.button>

                {/* Submódulos (acordeón con animación de altura) */}
                {!railed && (
                  <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <div className="mt-0.5 mb-1 space-y-0.5" aria-hidden={!open}>
                        {group.items.map(item => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            tabIndex={open ? 0 : -1}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) => `relative flex items-center gap-3 pl-11 pr-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 group/i active:scale-[0.98] motion-reduce:active:scale-100 ${
                              isActive ? 'bg-white/[0.07] text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                            }`}
                          >
                            {({ isActive }) => (
                              <>
                                {isActive &&
                                  (reduceMotion ? (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                                  ) : (
                                    <motion.span
                                      layoutId="sidebar-active-indicator"
                                      className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary"
                                      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                                    />
                                  ))}
                                <span className={isActive ? 'text-primary' : 'text-slate-500 group-hover/i:text-slate-300 transition-colors'}>
                                  {item.icon}
                                </span>
                                <span>{item.label}</span>
                              </>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {!railed && q && filteredMenu.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-[13px] font-medium text-slate-400">Sin resultados</p>
              <p className="text-[11px] text-slate-600 mt-1">No hay módulos para «{query}»</p>
            </div>
          )}
        </nav>

        {/* User / Footer */}
        <div className="px-3 py-4 border-t border-white/[0.06]">
          {railed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-slate-200 font-semibold uppercase text-xs shrink-0" title={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}>
                {user?.firstName?.[0] || 'A'}
              </div>
              <motion.button
                onClick={() => setDark(d => !d)}
                title={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                aria-label="Cambiar tema"
                whileTap={tap}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </motion.button>
              <motion.button
                onClick={handleLogout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                whileTap={tap}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut size={15} />
              </motion.button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-slate-200 font-semibold uppercase text-xs shrink-0">
                  {user?.firstName?.[0] || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">{user?.firstName} {user?.lastName}</p>
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider truncate">{user?.role?.replace('_', ' ')}</p>
                </div>
                <motion.button
                  onClick={() => setDark(d => !d)}
                  title={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                  aria-label="Cambiar tema"
                  whileTap={tap}
                  className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  {dark ? <Sun size={16} /> : <Moon size={16} />}
                </motion.button>
              </div>
              <motion.button
                onClick={handleLogout}
                whileTap={tap}
                className="w-full py-2.5 rounded-lg text-[12px] font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut size={15} /> Cerrar sesión
              </motion.button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col relative overflow-x-hidden">
        {/* Top bar / Header (Mobile) */}
        <header className={`sticky top-0 z-[90] lg:hidden flex items-center justify-between p-4 transition-all duration-300 ${scrolled ? 'bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-black/5 dark:border-white/5' : 'bg-transparent'}`}>
          <span className="font-headline font-black text-slate-900 dark:text-white tracking-widest text-xs uppercase italic">Luxury Admin</span>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setDark(d => !d)}
              aria-label="Cambiar tema"
              whileTap={tap}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-700"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </motion.button>
            <motion.button onClick={() => setMobileOpen(true)} whileTap={tap} className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg">
              <Menu size={20} />
            </motion.button>
          </div>
        </header>

        {/* reducedMotion="always": desactiva las animaciones de entrada
            (slide/stagger/scale) de framer-motion en TODO el panel admin.
            No afecta la app de clientes (usa otro layout). */}
        <MotionConfig reducedMotion="always">
          <div className="w-full">
            <Outlet />
          </div>
        </MotionConfig>
      </main>
    </div>
  );
}
