import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Client pages
import ClientDashboard from './pages/client/ClientDashboard';
import MyMembership from './pages/client/MyMembership';
import MyVehicles from './pages/client/MyVehicles';
import BookAppointment from './pages/client/BookAppointment';
import MyAppointments from './pages/client/MyAppointments';
import ServiceHistory from './pages/client/ServiceHistory';
import ExtraServices from './pages/client/ExtraServices';
import MyWallet from './pages/client/MyWallet';
import MyReferrals from './pages/client/MyReferrals';
import MyInvoices from './pages/client/MyInvoices';
import MyReviews from './pages/client/MyReviews';
import DigitalCard from './pages/client/DigitalCard';

// Admin pages
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
import AuditLogs from './pages/admin/AuditLogs';
import SettingsPage from './pages/admin/SettingsPage';
import ArizarPanel from './pages/admin/ArizarPanel';

// Employee pages
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import ActiveService from './pages/employee/ActiveService';
import EmployeeHistory from './pages/employee/EmployeeHistory';

// Shared pages
import Notifications from './pages/shared/Notifications';
import MyProfile from './pages/shared/MyProfile';

import './luxury.css';

// Luxury Experience Components
import LuxuryLayout from './luxury-design/layouts/MainLayout';
import LuxuryClientDashboard from './luxury-design/pages/Dashboard';
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

import api from './services/api';
import React, { useState, useEffect } from 'react';

import { LuxuryUserProvider, useLuxuryUser } from './luxury-design/context/LuxuryUserContext';

const withLuxury = (Component) => {
  return (props) => {
    const { fullUser, refreshProfile } = useLuxuryUser();
    const { logout } = useAuth();
    return <Component
      user={fullUser}
      onLogout={logout}
      onUpdate={refreshProfile}
      onBookingComplete={refreshProfile}
      {...props}
    />;
  };
};

// Wrapped Components
const LClientDashboard = withLuxury(LuxuryClientDashboard);
const LGarage = withLuxury(LuxuryGarage);
const LQRPass = withLuxury(LuxuryQRPass);
const LBooking = withLuxury(LuxuryBooking);
const LPlanes = withLuxury(LuxuryPlanes);
const LProfile = withLuxury(LuxuryProfile);
const LWallet = withLuxury(LuxuryWallet);
const LReferrals = withLuxury(LuxuryReferrals);
const LExtraServices = withLuxury(LuxuryExtraServices);

const LEmployeeDashboard = withLuxury(LuxuryEmployeeDashboard);
const LEmployeeScanner = withLuxury(LuxuryEmployeeScanner);
const LEmployeeHistory = withLuxury(LuxuryEmployeeHistory);

function LuxuryExperience({ children }) {
  return (
    <LuxuryUserProvider>
      <div className="luxury-experience">
        <LuxuryLayout>
          {children}
        </LuxuryLayout>
      </div>
    </LuxuryUserProvider>
  );
}

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" />;
  return children;
}

function AppRoutes() {
  const { user, loading, logout } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* ═══════ LUXURY EXPERIENCE (CLIENT) ═══════ */}
      <Route path="/client" element={<ProtectedRoute roles={['CLIENT']}><LuxuryExperience><Outlet /></LuxuryExperience></ProtectedRoute>}>
        <Route index element={<LClientDashboard />} />
        <Route path="vehicles" element={<LGarage />} />
        <Route path="card" element={<LQRPass />} />
        <Route path="book" element={<LBooking />} />
        <Route path="membership" element={<LPlanes />} />
        <Route path="profile" element={<LProfile />} />
        <Route path="wallet" element={<LWallet />} />
        <Route path="referrals" element={<LReferrals />} />
        <Route path="extras" element={<LExtraServices />} />
        <Route path="*" element={<Navigate to="/client" replace />} />
      </Route>

      {/* ═══════ LUXURY EXPERIENCE (EMPLOYEE) ═══════ */}
      <Route path="/employee" element={<ProtectedRoute roles={['EMPLOYEE']}><LuxuryExperience><Outlet /></LuxuryExperience></ProtectedRoute>}>
        <Route index element={<LEmployeeDashboard />} />
        <Route path="service" element={<LEmployeeScanner />} />
        <Route path="history" element={<LEmployeeHistory />} />
        <Route path="profile" element={<LProfile />} />
        <Route path="*" element={<Navigate to="/employee" replace />} />
      </Route>


      {/* ═══════ ADMIN (ORIGINAL SIDEBAR) — solo mantenemos el admin ═══════ */}
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
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="logs" element={<AuditLogs />} />
        <Route path="crm" element={<ArizarPanel />} />
      </Route>


      {/* ═══════ ROOT ═══════ */}
      <Route path="/" element={
        loading ? <div className="page-loading"><div className="loading-spinner" /></div> :
          user ? <Navigate to={user.role === 'CLIENT' ? '/client' : ['SUPER_ADMIN', 'ADMIN'].includes(user.role) ? '/admin' : '/employee'} /> : <Navigate to="/login" />
      } />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="luxury-experience">
          <Toaster position="top-right" toastOptions={{
            duration: 3000,
            style: { background: '#111d33', color: '#F0F4F8', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '12px', fontFamily: 'Inter, sans-serif', backdropFilter: 'blur(10px)' },
            success: { iconTheme: { primary: '#10B981', secondary: '#F0F4F8' } },
            error: { iconTheme: { primary: '#EF4444', secondary: '#F0F4F8' } },
          }} />
          <AppRoutes />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
