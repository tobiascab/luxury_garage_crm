import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import MainLayout from './layouts/MainLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Garage from './pages/Garage';
import Booking from './pages/Booking';
import Profile from './pages/Profile';
import Planes from './pages/Planes';
import Billetera from './pages/Billetera';
import Referidos from './pages/Referidos';
import ServiciosExtra from './pages/ServiciosExtra';
import QRPass from './pages/QRPass';
import EmpleadoScanner from './pages/EmpleadoScanner';

// Admin/Employee Pages
import DashboardEmpleado from './pages/DashboardEmpleado';
import HistorialEmpleado from './pages/HistorialEmpleado';

import { API_URL } from './config';

function ProtectedRoute({ children, isAuthenticated }: { children: any, isAuthenticated: boolean }) {
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);

  const handleLogin = (userData: any) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/api/users/${user.id}/full`);
      const data = await response.json();
      setUser(data);
    } catch (e) {
      console.error('Error refreshing user');
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          !isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/" replace />
        } />

        <Route path="/*" element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <MainLayout user={user}>
              <Routes>
                {user?.role === 'Empleado' ? (
                  <>
                    <Route path="/" element={<DashboardEmpleado user={user} />} />
                    <Route path="/scan" element={<EmpleadoScanner user={user} />} />
                    <Route path="/historial" element={<HistorialEmpleado user={user} />} />
                    <Route path="/perfil" element={<Profile user={user} onLogout={handleLogout} onUpdate={refreshUser} />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </>
                ) : (
                  <>
                    <Route path="/" element={<Dashboard user={user} />} />
                    <Route path="/garage" element={<Garage />} />
                    <Route path="/qr" element={<QRPass user={user} />} />
                    <Route path="/booking" element={<Booking user={user} onBookingComplete={refreshUser} />} />
                    <Route path="/planes" element={<Planes user={user} />} />
                    <Route path="/perfil" element={<Profile user={user} onLogout={handleLogout} onUpdate={refreshUser} />} />
                    <Route path="/billetera" element={<Billetera />} />
                    <Route path="/referidos" element={<Referidos user={user} />} />
                    <Route path="/servicios-extra" element={<ServiciosExtra />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </>
                )}
              </Routes>
            </MainLayout>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
