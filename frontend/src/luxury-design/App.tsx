import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import MainLayout from './layouts/MainLayout';

// Non-tab pages (rendered as children of MainLayout)
import Garage from './pages/Garage';
import Billetera from './pages/Billetera';
import Referidos from './pages/Referidos';
import ServiciosExtra from './pages/ServiciosExtra';

// Auth
import Login from './pages/Login';

import api from '../services/api';

function ProtectedRoute({ children, isAuthenticated }: { children: any; isAuthenticated: boolean }) {
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
      const res = await api.get('/auth/me');
      if (res.data?.data) setUser(res.data.data);
    } catch (e) {
      console.error('Error refreshing user');
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route
          path="/login"
          element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/" replace />}
        />

        {/* Protected app */}
        <Route
          path="/*"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <MainLayout
                user={user}
                onLogout={handleLogout}
                onBookingComplete={refreshUser}
                onUpdate={refreshUser}
              >
                {/* Only NON-TAB routes go here — MainLayout handles tab pages via slider */}
                <Routes>
                  <Route path="/garage" element={<Garage />} />
                  <Route path="/billetera" element={<Billetera />} />
                  <Route path="/referidos" element={<Referidos user={user} />} />
                  <Route path="/servicios-extra" element={<ServiciosExtra />} />
                  {/* Tab routes fallback — MainLayout renders them, no redirect needed */}
                  <Route path="*" element={null} />
                </Routes>
              </MainLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
