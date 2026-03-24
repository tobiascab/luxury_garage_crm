import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('luxury_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    // Solo hacer logout automático si el token de sesión está rechazado (/auth/me)
    // Evita que un 401 de negocio (ej: QR inválido) cierre la sesión del empleado
    if (status === 401 && url.includes('/auth/me')) {
      localStorage.removeItem('luxury_token');
      localStorage.removeItem('luxury_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);


export default api;
