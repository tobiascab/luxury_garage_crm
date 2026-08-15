import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useEffect, useRef, lazy, Suspense, Component } from 'react';

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
// Registro de todas las factories lazy para poder PRECARGARLAS en idle (ver preloadLazyModules).
const _lazyFactories = [];

// Importa el chunk con REINTENTOS antes de rendirse. Al navegar muy rápido entre módulos, un
// import() puede fallar de forma transitoria (red, chunk a medio bajar, SW): reintentar con un
// pequeño backoff lo resuelve sin recargar toda la página. Solo si TODOS los reintentos fallan
// recargamos UNA vez (assets viejos tras deploy). Cachea el módulo, así la 2da navegación es instantánea.
async function importWithRetry(factory, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const mod = await factory();
      sessionStorage.removeItem('chunk-reloaded'); // cargó bien → reset
      return mod;
    } catch (err) {
      const isLast = i === attempts - 1;
      if (!isLast) {
        await new Promise((r) => setTimeout(r, 250 * (i + 1))); // 250ms, 500ms…
        continue;
      }
      if (!sessionStorage.getItem('chunk-reloaded')) {
        sessionStorage.setItem('chunk-reloaded', '1');
        window.location.reload();
        return new Promise(() => { }); // colgar hasta que recargue
      }
      throw err;
    }
  }
}

function lazyWithReload(factory) {
  _lazyFactories.push(factory);
  return lazy(() => importWithRetry(factory));
}

// Precarga TODOS los chunks lazy en tiempo ocioso (tras montar el shell logueado). Así, cuando
// el usuario cambia de módulo, el chunk ya está en caché y la vista aparece al instante — se
// elimina el "no carga al navegar rápido". import() cachea la promesa, no vuelve a bajar nada.
let _preloadStarted = false;
function preloadLazyModules() {
  if (_preloadStarted) return; // una sola vez por sesión de página
  _preloadStarted = true;
  const run = () => { for (const f of _lazyFactories) { try { f(); } catch { /* noop */ } } };
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 1500);
  }
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
const Cobros = lazyWithReload(() => import('./pages/admin/Cobros'));
const ContractsManager = lazyWithReload(() => import('./pages/admin/ContractsManager'));
const AuditLogs = lazyWithReload(() => import('./pages/admin/AuditLogs'));
const ArizarPanel = lazyWithReload(() => import('./pages/admin/ArizarPanel'));
const ChatInbox = lazyWithReload(() => import('./pages/admin/ChatInbox'));
// Panel admin de notificaciones: usamos el componente COMPLETO (con Eliminar + KPIs),
// no el simple de shared/ que dejaba muertos DELETE /notifications/:id y /admin/stats.
const Notifications = lazyWithReload(() => import('./pages/admin/Notifications'));

// Luxury Client & Employee Pages - Lazy
const LuxuryDashboard = lazyWithReload(() => import('./luxury-design/pages/Dashboard'));
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
// Alta obligatoria del cliente (tarjeta + plan + primer cobro). Bloquea la app hasta completarse.
const LuxuryOnboarding = lazyWithReload(() => import('./luxury-design/pages/Onboarding'));

// Landing pública (marketing) — solo la baja un visitante del navegador sin sesión.
const Landing = lazyWithReload(() => import('./luxury-design/pages/Landing'));

// Recuperación de contraseña y confirmación de correo (públicas: se llega desde el mail).
const OlvidePassword = lazyWithReload(() =>
  import('./luxury-design/pages/RecuperarPassword').then((m) => ({ default: m.OlvidePassword })));
const RestablecerPassword = lazyWithReload(() =>
  import('./luxury-design/pages/RecuperarPassword').then((m) => ({ default: m.RestablecerPassword })));
const VerificarCorreo = lazyWithReload(() =>
  import('./luxury-design/pages/RecuperarPassword').then((m) => ({ default: m.VerificarCorreo })));

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
      <OnboardingGate>
        <LuxuryLayout>
          <Outlet />
        </LuxuryLayout>
      </OnboardingGate>
    </LuxuryUserProvider>
  );
}

// ─────────────────────────────────────────────────────────
// Alta obligatoria: un CLIENTE sin membresía activa no entra a la app hasta
// registrar su tarjeta, elegir plan y pagar el primer mes (débito adelantado).
// `onboardingRequired` lo decide el backend (GET /luxury/profile/full) y ya viene
// en false para empleados y admins. Única salida sin completar: cerrar sesión.
// ─────────────────────────────────────────────────────────
function OnboardingGate({ children }) {
  const { fullUser, loading, refreshProfile } = useLuxuryUser();
  const { logout } = useAuth();

  // Sin datos todavía: no decidimos nada (evita el parpadeo del alta a un cliente que sí tiene plan).
  if (loading && !fullUser) return <PageLoader />;

  if (fullUser?.onboardingRequired) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LuxuryOnboarding
          user={fullUser}
          onDone={() => refreshProfile(true)}
          onLogout={logout}
        />
      </Suspense>
    );
  }

  return children;
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
      {/* Recuperar contraseña / confirmar correo: se entra desde el enlace del mail, sin sesión. */}
      <Route path="/olvide-contrasena" element={<Suspense fallback={<PageLoader />}><OlvidePassword /></Suspense>} />
      <Route path="/restablecer" element={<Suspense fallback={<PageLoader />}><RestablecerPassword /></Suspense>} />
      <Route path="/verificar-correo" element={<Suspense fallback={<PageLoader />}><VerificarCorreo /></Suspense>} />

      {/* ── Luxury Shell (Client & Employee) ── */}
      <Route element={<ProtectedRoute roles={['CLIENT', 'EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']}><LuxuryShell /></ProtectedRoute>}>

        {/* Client Routes — EXACT paths as in LUXURY/src */}
        {/* Dashboard del cliente: movido de "/" a "/inicio" (la raíz ahora es el RootGate público). */}
        <Route path="/inicio" element={<ProtectedRoute roles={['CLIENT', 'ADMIN', 'SUPER_ADMIN']}><LDashboard /></ProtectedRoute>} />
        <Route path="/booking" element={<ProtectedRoute roles={['CLIENT', 'ADMIN', 'SUPER_ADMIN']}><LBooking /></ProtectedRoute>} />
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
        <Route path="cobros" element={<Cobros />} />
        <Route path="contratos" element={<ContractsManager />} />
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

// Precarga los chunks lazy en cuanto hay sesión (idle). Vive dentro del AuthProvider
// para poder leer el usuario. Cubre a cliente, empleado y admin por igual.
function PreloadOnAuth() {
  const { user } = useAuth();
  useEffect(() => { if (user) preloadLazyModules(); }, [user]);
  return null;
}

// ─────────────────────────────────────────────────────────
// Si mientras el usuario tenía la app abierta se publicó una versión nueva, el service
// worker la deja preparada (ver main.jsx) y acá se aplica al cambiar de módulo: es el
// único momento donde recargar no interrumpe nada. Sin esto, la app seguía pidiendo
// archivos de la versión anterior —que ya no existen— y el módulo quedaba en blanco.
// ─────────────────────────────────────────────────────────
function AplicarActualizacionPendiente() {
  const location = useLocation();
  const primeraRuta = useRef(location.pathname);

  useEffect(() => {
    if (!window.__actualizacionPendiente) return;
    if (location.pathname === primeraRuta.current) return; // todavía no navegó
    window.__actualizacionPendiente = false;
    window.location.reload();
  }, [location.pathname]);

  return null;
}

// ─────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PreloadOnAuth />
        <AplicarActualizacionPendiente />
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
