import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import api from '../services/api';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref') || '';
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '',
    vehicleBrand: '', vehicleModel: '', vehicleYear: new Date().getFullYear(), vehicleColor: '', vehiclePlate: '',
  });

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return toast.error('Las contraseñas no coinciden');
    if (form.password.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres');
    setLoading(true);
    try {
      const payload = {
        email: form.email, password: form.password,
        firstName: form.firstName, lastName: form.lastName, phone: form.phone,
        referralCode,
      };
      if (form.vehicleBrand && form.vehicleModel) {
        payload.vehicle = { brand: form.vehicleBrand, model: form.vehicleModel, year: parseInt(form.vehicleYear), color: form.vehicleColor, licensePlate: form.vehiclePlate };
      }
      const res = await api.post('/auth/public-register', payload);
      if (res.data.success) {
        localStorage.setItem('luxury_token', res.data.data.token);
        localStorage.setItem('luxury_user', JSON.stringify(res.data.data.user));
        toast.success('¡Cuenta creada exitosamente! 🎉');
        setTimeout(() => navigate('/client'), 1000);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al registrar');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <Toaster position="top-center" toastOptions={{ style: { background: '#111d33', color: '#F0F4F8', border: '1px solid rgba(148,163,184,0.1)' } }} />

      {[...Array(6)].map((_, i) => (
        <motion.div key={i} style={{ position: 'absolute', width: 4 + i * 2, height: 4 + i * 2, borderRadius: '50%', background: i % 2 === 0 ? 'rgba(30,144,255,0.3)' : 'rgba(0,212,255,0.3)', top: `${15 + i * 14}%`, left: `${10 + i * 15}%` }}
          animate={{ y: [0, -30, 0], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 3 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }} />
      ))}

      <motion.div className="login-card" style={{ maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto' }}
        initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>

        <div className="login-logo">
          <motion.div className="login-logo-icon" initial={{ rotate: -10 }} animate={{ rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}>🚗</motion.div>
          <h1>LUXURY GARAGE</h1>
          <p>Creá tu cuenta premium</p>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '16px 0' }}>
          {[1, 2].map(s => (
            <div key={s} style={{ width: s === step ? '32px' : '8px', height: '8px', borderRadius: '4px', background: s <= step ? 'var(--primary)' : 'var(--glass-border)', transition: '0.3s' }} />
          ))}
        </div>

        <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); setStep(2); }} autoComplete="on">
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input className="form-input" placeholder="Juan" value={form.firstName} onChange={update('firstName')} required autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Apellido *</label>
                  <input className="form-input" placeholder="Pérez" value={form.lastName} onChange={update('lastName')} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" className="form-input" placeholder="tu@email.com" value={form.email} onChange={update('email')} required autoComplete="email" />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input type="tel" className="form-input" placeholder="+595 991 234 567" value={form.phone} onChange={update('phone')} autoComplete="tel" />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña *</label>
                <input type="password" className="form-input" placeholder="Mínimo 6 caracteres" value={form.password} onChange={update('password')} required autoComplete="new-password" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar Contraseña *</label>
                <input type="password" className="form-input" placeholder="Repetí tu contraseña" value={form.confirmPassword} onChange={update('confirmPassword')} required autoComplete="new-password" />
              </div>
              <motion.button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '8px' }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                Siguiente — Vehículo 🚗
              </motion.button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
                📋 Datos de tu vehículo <span style={{ color: 'var(--cyan)' }}>(opcional)</span>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Marca</label>
                  <input className="form-input" placeholder="Toyota" value={form.vehicleBrand} onChange={update('vehicleBrand')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Modelo</label>
                  <input className="form-input" placeholder="Hilux" value={form.vehicleModel} onChange={update('vehicleModel')} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Año</label>
                  <input type="number" className="form-input" value={form.vehicleYear} onChange={update('vehicleYear')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Color</label>
                  <input className="form-input" placeholder="Blanco" value={form.vehicleColor} onChange={update('vehicleColor')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Patente</label>
                  <input className="form-input" placeholder="ABC-1234" value={form.vehiclePlate} onChange={update('vehiclePlate')} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>← Volver</button>
                <motion.button type="submit" className="btn btn-primary btn-lg" style={{ flex: 2 }} disabled={loading}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {loading ? <span className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : '✨ Crear Cuenta'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </form>

        <motion.div style={{ textAlign: 'center', marginTop: '20px' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ¿Ya tenés cuenta? <a href="/login" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Iniciar Sesión</a>
          </p>
        </motion.div>

        <motion.p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          Powered by <span style={{ color: 'var(--cyan)' }}>ARIZAR IA</span>
        </motion.p>
      </motion.div>
    </div>
  );
}
