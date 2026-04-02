import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useEffect, lazy, Suspense } from 'react';

import './index.css';

// Auth - Eager loaded (necesario para login)
import LuxuryLogin from './luxury-design/pages/Login';
import RegisterPage from './pages/RegisterPage';

// Luxury Context - Eager loaded (necesario para shell)
import { LuxuryUserProvider, useLuxuryUser } from './luxury-design/context/LuxuryUserContext';
import LuxuryLayout from './luxury-design/layouts/MainLayout';

// ═══════════════════════════════════════════════════════════════════
// LAZY LOADED COMPONENTS - Se cargan solo cuando se navega a ellos
// ═══════════════════════════════════════════════════════════════════

// Admin pages - Lazy
const Sidebar = lazy(() => import('./components/Sidebar'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const MembersManager = lazy(() => import('./pages/admin/MembersManager'));
const LeadsManager = lazy(() => import('./pages/admin/LeadsManager'));
const AppointmentsCalendar = lazy(() => import('./pages/admin/AppointmentsCalendar'));
const ServicesManager = lazy(() => import('./pages/admin/ServicesManager'));
const PlansManager = lazy(() => import('./pages/admin/PlansManager'));
const EmployeesManager = lazy(() => import('./pages/admin/EmployeesManager'));
const WashScans = lazy(() => import('./pages/admin/WashScans'));
const FinanceDashboard = lazy(() => import('./pages/admin/FinanceDashboard'));
const Reports = lazy(() => import('./pages/admin/Reports'));
const VehiclesAdmin = lazy(() => import('./pages/admin/VehiclesAdmin'));
const PromotionsManager = lazy(() => import('./pages/admin/PromotionsManager'));
const ReviewsAdmin = lazy(() => import('./pages/admin/ReviewsAdmin'));
const InventoryManager = lazy(() => import('./pages/admin/InventoryManager'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const ArizarPanel = lazy(() => import('./pages/admin/ArizarPanel'));
const Notifications = lazy(() => import('./pages/shared/Notifications'));

// Luxury Client & Employee Pages - Lazy
const LuxuryDashboard = lazy(() => import('./luxury-design/pages/Dashboard'));
const LuxuryGarage = lazy(() => import('./luxury-design/pages/Garage'));
const LuxuryQRPass = lazy(() => import('./luxury-design/pages/QRPass'));
const LuxuryBooking = lazy(() => import('./luxury-design/pages/Booking'));
const LuxuryPlanes = lazy(() => import('./luxury-design/pages/Planes'));
const LuxuryProfile = lazy(() => import('./luxury-design/pages/Profile'));
const LuxuryWallet = lazy(() => import('./luxury-design/pages/Billetera'));
const LuxuryReferrals = lazy(() => import('./luxury-design/pages/Referidos'));
const LuxuryExtraServices = lazy(() => import('./luxury-design/pages/ServiciosExtra'));
const LuxuryEmployeeDashboard = lazy(() => import('./luxury-design/pages/DashboardEmpleado'));
const LuxuryEmployeeScanner = lazy(() => import('./luxury-design/pages/EmpleadoScanner'));
const LuxuryEmployeeHistory = lazy(() => import('./luxury-design/pages/HistorialEmpleado'));
const LuxuryTarjetas = lazy(() => import('./luxury-design/pages/Tarjetas'));

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
          onUpdate={refreshProfile}
          onBookingComplete={refreshProfile}
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
  if (role === 'CLIENT') return <Navigate to="/" replace />;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
  return <Navigate to="/employee" replace />;
}

// ─────────────────────────────────────────────────────────
// Main routing tree
// ─────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* ── Public ── */}
      <Route path="/login" element={<LuxuryLogin />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* ── Luxury Shell (Client & Employee) ── */}
      <Route element={<ProtectedRoute roles={['CLIENT', 'EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']}><LuxuryShell /></ProtectedRoute>}>

        {/* Client Routes — EXACT paths as in LUXURY/src */}
        <Route path="/" element={<ProtectedRoute roles={['CLIENT', 'ADMIN', 'SUPER_ADMIN']}><LDashboard /></ProtectedRoute>} />
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
        <Route path="leads" element={<LeadsManager />} />
        <Route path="calendar" element={<AppointmentsCalendar />} />
        <Route path="services" element={<ServicesManager />} />
        <Route path="plans" element={<PlansManager />} />
        <Route path="employees" element={<EmployeesManager />} />
        <Route path="scans" element={<WashScans />} />
        <Route path="finance" element={<FinanceDashboard />} />
        <Route path="reports" element={<Reports />} />
        <Route path="vehicles" element={<VehiclesAdmin />} />
        <Route path="promotions" element={<PromotionsManager />} />
        <Route path="reviews" element={<ReviewsAdmin />} />
        <Route path="inventory" element={<InventoryManager />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="logs" element={<AuditLogs />} />
        <Route path="crm" element={<ArizarPanel />} />
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
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
