import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import React, { useEffect } from 'react';

import './index.css';

// Auth
import LuxuryLogin from './luxury-design/pages/Login';
import RegisterPage from './pages/RegisterPage';

// Admin pages (kept as-is)
import Sidebar from './components/Sidebar';
import AdminDashboard from './pages/admin/AdminDashboard';
import MembersManager from './pages/admin/MembersManager';
import LeadsManager from './pages/admin/LeadsManager';
import AppointmentsCalendar from './pages/admin/AppointmentsCalendar';
import ServicesManager from './pages/admin/ServicesManager';
import PlansManager from './pages/admin/PlansManager';
import EmployeesManager from './pages/admin/EmployeesManager';
import FinanceDashboard from './pages/admin/FinanceDashboard';
import Reports from './pages/admin/Reports';
import VehiclesAdmin from './pages/admin/VehiclesAdmin';
import PromotionsManager from './pages/admin/PromotionsManager';
import ReviewsAdmin from './pages/admin/ReviewsAdmin';
import InventoryManager from './pages/admin/InventoryManager';
import SettingsPage from './pages/admin/SettingsPage';
import AuditLogs from './pages/admin/AuditLogs';
import ArizarPanel from './pages/admin/ArizarPanel';
import Notifications from './pages/shared/Notifications';

// Luxury Client & Employee Pages (from LUXURY/src)
import { LuxuryUserProvider, useLuxuryUser } from './luxury-design/context/LuxuryUserContext';
import LuxuryLayout from './luxury-design/layouts/MainLayout';
import LuxuryDashboard from './luxury-design/pages/Dashboard';
import LuxuryGarage from './luxury-design/pages/Garage';
import LuxuryQRPass from './luxury-design/pages/QRPass';
import LuxuryBooking from './luxury-design/pages/Booking';
import LuxuryPlanes from './luxury-design/pages/Planes';
import LuxuryProfile from './luxury-design/pages/Profile';
import LuxuryWallet from './luxury-design/pages/Billetera';
import LuxuryReferrals from './luxury-design/pages/Referidos';
import LuxuryExtraServices from './luxury-design/pages/ServiciosExtra';
import LuxuryEmployeeDashboard from './luxury-design/pages/DashboardEmpleado';
import LuxuryEmployeeScanner from './luxury-design/pages/EmpleadoScanner';
import LuxuryEmployeeHistory from './luxury-design/pages/HistorialEmpleado';

// ─────────────────────────────────────────────────────────
// HOC that injects luxury user data into every page component
// ─────────────────────────────────────────────────────────
const withLuxury = (Component) => {
  return (props) => {
    const { fullUser, loading, refreshProfile } = useLuxuryUser();
    const { logout } = useAuth();
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Cargando…</p>
        </div>
      );
    }
    return <Component user={fullUser} onLogout={logout} onUpdate={refreshProfile} onBookingComplete={refreshProfile} {...props} />;
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
