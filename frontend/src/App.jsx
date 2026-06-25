import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useEffect, lazy, Suspense, Component } from 'react';

import './index.css';

// Auth - Eager loaded (necesario para login)
import LuxuryLogin from './luxury-design/pages/Login';
import RegisterPage from './pages/RegisterPage';

// Luxury Context - Eager loaded (necesario para shell)
import { LuxuryUserProvider, useLuxuryUser } from './luxury-design/context/LuxuryUserContext';
import LuxuryLayout from './luxury-design/layouts/MainLayout';

// ═══════════════════════════════════════════════════════════════════
// Carga perezosa robusta + Error Boundary global
// Tras un deploy nuevo, el navegador/SW puede tener un index/chunks viejos en
// memoria: al navegar a una página lazy, su import() falla → pantalla blanca.
// Acá lo interceptamos y recargamos UNA vez para bajar los assets frescos
// (se arregla solo, sin que el usuario tenga que recargar a mano).
// ═══════════════════════════════════════════════════════════════════
function lazyWithReload(factory) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem('chunk-reloaded'); // cargó bien → reset
      return mod;
    } catch (err) {
      if (!sessionStorage.getItem('chunk-reloaded')) {
        sessionStorage.setItem('chunk-reloaded', '1');
        window.location.reload();
        return new Promise(() => { }); // colgar hasta que recargue
      }
      throw err;
    }
  });
}

// Red de seguridad: si una vista falla al renderizar (no solo al cargar el chunk),
// mostramos un fallback con "Recargar" en vez de dejar la pantalla en blanco.
class ChunkErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) {
    const msg = String(error?.message || error || '');
    if (/Loading chunk|dynamically imported module|imported module script failed|ChunkLoadError/i.test(msg)) {
      if (!sessionStorage.getItem('chunk-reloaded')) {
        sessionStorage.setItem('chunk-reloaded', '1');
        window.location.reload();
      }
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No se pudo cargar esta sección.</p>
          <button
            onClick={() => { sessionStorage.removeItem('chunk-reloaded'); window.location.reload(); }}
            className="px-6 h-11 rounded-2xl bg-primary text-white text-sm font-bold"
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════
// LAZY LOADED COMPONENTS - Se cargan solo cuando se navega a ellos
// ═══════════════════════════════════════════════════════════════════

// Admin pages - Lazy
const Sidebar = lazyWithReload(() => import('./components/Sidebar'));
const AdminDashboard = lazyWithReload(() => import('./pages/admin/AdminDashboard'));
const MembersManager = lazyWithReload(() => import('./pages/admin/MembersManager'));
const MembershipsManager = lazyWithReload(() => import('./pages/admin/MembershipsManager'));
const LeadsManager = lazyWithReload(() => import('./pages/admin/LeadsManager'));
const MembershipRequestsManager = lazyWithReload(() => import('./pages/admin/MembershipRequestsManager'));
const AppointmentsCalendar = lazyWithReload(() => import('./pages/admin/AppointmentsCalendar'));
const ServicesManager = lazyWithReload(() => import('./pages/admin/ServicesManager'));
const PlansManager = lazyWithReload(() => import('./pages/admin/PlansManager'));
const EmployeesManager = lazyWithReload(() => import('./pages/admin/EmployeesManager'));
const WashScans = lazyWithReload(() => import('./pages/admin/WashScans'));
const FinanceDashboard = lazyWithReload(() => import('./pages/admin/FinanceDashboard'));
const ExpensesManager = lazyWithReload(() => import('./pages/admin/ExpensesManager'));
const AccountingReports = lazyWithReload(() => import('./pages/admin/AccountingReports'));
const Reports = lazyWithReload(() => import('./pages/admin/Reports'));
const VehiclesAdmin = lazyWithReload(() => import('./pages/admin/VehiclesAdmin'));
const PromotionsManager = lazyWithReload(() => import('./pages/admin/PromotionsManager'));
const ReviewsAdmin = lazyWithReload(() => import('./pages/admin/ReviewsAdmin'));
const InventoryManager = lazyWithReload(() => import('./pages/admin/InventoryManager'));
const SettingsPage = lazyWithReload(() => import('./pages/admin/SettingsPage'));
const CobrosStripe = lazyWithReload(() => import('./pages/admin/CobrosStripe'));
const AuditLogs = lazyWithReload(() => import('./pages/admin/AuditLogs'));
const ArizarPanel = lazyWithReload(() => import('./pages/admin/ArizarPanel'));
const ChatInbox = lazyWithReload(() => import('./pages/admin/ChatInbox'));
const Notifications = lazyWithReload(() => import('./pages/shared/Notifications'));

// Luxury Client & Employee Pages - Lazy
const LuxuryDashboard = lazyWithReload(() => import('./luxury-design/pages/Dashboard'));
const LuxuryGarage = lazyWithReload(() => import('./luxury-design/pages/Garage'));
const LuxuryQRPass = lazyWithReload(() => import('./luxury-design/pages/QRPass'));
const LuxuryBooking = lazyWithReload(() => import('./luxury-design/pages/Booking'));
const LuxuryPlanes = lazyWithReload(() => import('./luxury-design/pages/Planes'));
const LuxuryProfile = lazyWithReload(() => import('./luxury-design/pages/Profile'));
const LuxuryWallet = lazyWithReload(() => import('./luxury-design/pages/Billetera'));
const LuxuryReferrals = lazyWithReload(() => import('./luxury-design/pages/Referidos'));
const LuxuryExtraServices = lazyWithReload(() => import('./luxury-design/pages/ServiciosExtra'));
const LuxuryEmployeeDashboard = lazyWithReload(() => import('./luxury-design/pages/DashboardEmpleado'));
const LuxuryEmployeeScanner = lazyWithReload(() => import('./luxury-design/pages/EmpleadoScanner'));
const LuxuryEmployeeHistory = lazyWithReload(() => import('./luxury-design/pages/HistorialEmpleado'));
const LuxuryTarjetas = lazyWithReload(() => import('./luxury-design/pages/Tarjetas'));

// Landing pública (marketing) — solo la baja un visitante del navegador sin sesión.
const Landing = lazyWithReload(() => import('./luxury-design/pages/Landing'));

// ═══════════════════════════════════════════════════════════════════
// Loading Fallback Component
// ═══════════════════════════════════════════════════════════════════
function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Cargando…</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// HOC that injects luxury user data into every page component
// Optimizado: Renderiza el contenido inmediatamente sin bloquear
// ─────────────────────────────────────────────────────────
const withLuxury = (Component) => {
  return (props) => {
    const { fullUser, loading, refreshProfile } = useLuxuryUser();
    const { logout } = useAuth();

    // Solo bloqueamos con el loader de pantalla completa si NO hay datos EN ABSOLUTO
    // Si loading es true pero ya tenemos fullUser (de la caché), dejamos que renderice
    if (loading && !fullUser) {
      return <PageLoader />;
    }

    return (
      <Suspense fallback={<PageLoader />}>
        <Component
          user={fullUser}
          onLogout={logout}
          onUpdate={() => refreshProfile(true)}
          onBookingComplete={() => refreshProfile(true)}
          {...props}
        />
      </Suspense>
    );
  };
};

const LDashboard = withLuxury(LuxuryDashboard);
const LGarage = withLuxury(LuxuryGarage);
const LQRPass = withLuxury(LuxuryQRPass);
const LBooking = withLuxury(LuxuryBooking);
const LPlanes = withLuxury(LuxuryPlanes);
const LProfile = withLuxury(LuxuryProfile);
const LWallet = withLuxury(LuxuryWallet);
const LReferrals = withLuxury(LuxuryReferrals);
const LExtraServices = withLuxury(LuxuryExtraServices);
const LEmployeeDash = withLuxury(LuxuryEmployeeDashboard);
const LEmployeeScan = withLuxury(LuxuryEmployeeScanner);
const LEmployeeHistory = withLuxury(LuxuryEmployeeHistory);
const LTarjetas = withLuxury(LuxuryTarjetas);

// ─────────────────────────────────────────────────────────
// Sets the `luxury-experience` class on body and wraps
// everything in the Luxury user context + layout
// ─────────────────────────────────────────────────────────
function LuxuryShell() {
  useEffect(() => {
    document.body.classList.add('luxury-experience');
    return () => document.body.classList.remove('luxury-experience');
  }, []);

  return (
    <LuxuryUserProvider>
      <LuxuryLayout>
        <Outlet />
      </LuxuryLayout>
    </LuxuryUserProvider>
  );
}

// ─────────────────────────────────────────────────────────
// Role-based route guard
// ─────────────────────────────────────────────────────────
function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles) {
    const uRole = (user.role || '').toUpperCase();
    const allowed = roles.map(r => r.toUpperCase());
    const isEmployee = uRole === 'EMPLEADO' || uRole === 'EMPLOYEE';
    if (!allowed.includes(uRole) && !(isEmployee && allowed.includes('EMPLOYEE'))) {
      return <Navigate to="/login" replace />;
    }
  }
  return children;
}

// ─────────────────────────────────────────────────────────
// Root redirect based on role
// ─────────────────────────────────────────────────────────
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  const role = user.role?.toUpperCase();
  if (role === 'CLIENT') return <Navigate to="/inicio" replace />;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
  return <Navigate to="/employee" replace />;
}

// ─────────────────────────────────────────────────────────
// ¿La app corre como PWA instalada (standalone) y no en el navegador?
// Android/escritorio → display-mode; iOS Safari → navigator.standalone.
// ─────────────────────────────────────────────────────────
function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  // SOLO la PWA realmente instalada: display-mode standalone (Android/escritorio)
  // o navigator.standalone (iOS "Agregar a inicio"). NO usamos minimal-ui/fullscreen
  // porque los navegadores in-app (WhatsApp/Facebook/Instagram) a veces los reportan
  // y mandarían a login a un visitante normal en vez de mostrarle la landing.
  const mq = window.matchMedia;
  const standalone = !!mq && mq('(display-mode: standalone)').matches;
  const iosStandalone = window.navigator.standalone === true;
  return standalone || iosStandalone;
}

// ─────────────────────────────────────────────────────────
// Entrada de la raíz "/".
//  - Con sesión → su panel según rol.
//  - Sin sesión + NAVEGADOR → Landing pública de marketing (scroll/animaciones).
//  - Sin sesión + PWA INSTALADA → /login directo (la app nunca muestra la landing).
// ─────────────────────────────────────────────────────────
function RootGate() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (user) {
    const role = (user.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
    if (role === 'EMPLOYEE' || role === 'EMPLEADO') return <Navigate to="/employee" replace />;
    return <Navigate to="/inicio" replace />;
  }
  if (isStandalonePWA()) return <Navigate to="/login" replace />;
  return (
    <Suspense fallback={<PageLoader />}>
      <Landing />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────
// Main routing tree
// ─────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* ── Public ── */}
      <Route path="/" element={<RootGate />} />
      <Route path="/login" element={<LuxuryLogin />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* ── Luxury Shell (Client & Employee) ── */}
      <Route element={<ProtectedRoute roles={['CLIENT', 'EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']}><LuxuryShell /></ProtectedRoute>}>

        {/* Client Routes — EXACT paths as in LUXURY/src */}
        {/* Dashboard del cliente: movido de "/" a "/inicio" (la raíz ahora es el RootGate público). */}
        <Route path="/inicio" element={<ProtectedRoute roles={['CLIENT', 'ADMIN', 'SUPER_ADMIN']}><LDashboard /></ProtectedRoute>} />
        <Route path="/booking" element={<ProtectedRoute roles={['CLIENT', 'ADMIN', 'SUPER_ADMIN']}><LBooking /></ProtectedRoute>} />
        <Route path="/garage" element={<ProtectedRoute roles={['CLIENT', 'ADMIN', 'SUPER_ADMIN']}><LGarage /></ProtectedRoute>} />
        <Route path="/qr" element={<ProtectedRoute roles={['CLIENT', 'ADMIN', 'SUPER_ADMIN']}><LQRPass /></ProtectedRoute>} />
        <Route path="/planes" element={<ProtectedRoute roles={['CLIENT', 'ADMIN', 'SUPER_ADMIN']}><LPlanes /></ProtectedRoute>} />
        <Route path="/billetera" element={<ProtectedRoute roles={['CLIENT', 'ADMIN', 'SUPER_ADMIN']}><LWallet /></ProtectedRoute>} />
        <Route path="/referidos" element={<ProtectedRoute roles={['CLIENT', 'ADMIN', 'SUPER_ADMIN']}><LReferrals /></ProtectedRoute>} />
        <Route path="/servicios-extra" element={<ProtectedRoute roles={['CLIENT', 'ADMIN', 'SUPER_ADMIN']}><LExtraServices /></ProtectedRoute>} />
        <Route path="/perfil" element={<ProtectedRoute roles={['CLIENT', 'EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']}><LProfile /></ProtectedRoute>} />
        <Route path="/tarjetas" element={<ProtectedRoute roles={['CLIENT', 'ADMIN', 'SUPER_ADMIN']}><LTarjetas /></ProtectedRoute>} />

        {/* Employee Routes — EXACT paths as in LUXURY/src */}
        <Route path="/employee" element={<ProtectedRoute roles={['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']}><LEmployeeDash /></ProtectedRoute>} />
        <Route path="/scan" element={<ProtectedRoute roles={['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']}><LEmployeeScan /></ProtectedRoute>} />
        <Route path="/historial" element={<ProtectedRoute roles={['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']}><LEmployeeHistory /></ProtectedRoute>} />
      </Route>

      {/* ── Admin Section (Sidebar Layout) ── */}
      <Route path="/admin" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}><Sidebar /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="members" element={<MembersManager />} />
        <Route path="memberships" element={<MembershipsManager />} />
        <Route path="leads" element={<LeadsManager />} />
        <Route path="solicitudes" element={<MembershipRequestsManager />} />
        <Route path="calendar" element={<AppointmentsCalendar />} />
        <Route path="services" element={<ServicesManager />} />
        <Route path="plans" element={<PlansManager />} />
        <Route path="employees" element={<EmployeesManager />} />
        <Route path="scans" element={<WashScans />} />
        <Route path="finance" element={<FinanceDashboard />} />
        <Route path="cobros" element={<CobrosStripe />} />
        <Route path="expenses" element={<ExpensesManager />} />
        <Route path="accounting" element={<AccountingReports />} />
        <Route path="reports" element={<Reports />} />
        <Route path="vehicles" element={<VehiclesAdmin />} />
        <Route path="promotions" element={<PromotionsManager />} />
        <Route path="reviews" element={<ReviewsAdmin />} />
        <Route path="inventory" element={<InventoryManager />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="logs" element={<AuditLogs />} />
        <Route path="crm" element={<ArizarPanel />} />
        <Route path="chat-inbox" element={<ChatInbox />} />
      </Route>

      {/* ── Catch-all ── */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

// ─────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 2500,
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: '16px',
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 700,
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#10B981', secondary: '#f8fafc' } },
            error: { iconTheme: { primary: '#EF4444', secondary: '#f8fafc' } },
          }}
        />
        <ChunkErrorBoundary>
          <AppRoutes />
        </ChunkErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
