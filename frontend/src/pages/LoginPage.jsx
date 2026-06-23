import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, Sparkles, Eye, EyeOff } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    document.body.classList.add('luxury-experience');
    if (user && !authLoading) {
      const role = user.role.toUpperCase();
      const dest = role === 'CLIENT' ? '/client' : (role === 'ADMIN' || role === 'SUPER_ADMIN') ? '/admin' : '/employee';
      console.log('Redirecting to:', dest);
      navigate(dest, { replace: true });
    }
    return () => document.body.classList.remove('luxury-experience');
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Completá email y contraseña');
    setIsLoading(true);

    try {
      const userData = await login(email, password);
      toast.success(`¡Bienvenido, ${userData.firstName}!`);
      const role = userData.role.toUpperCase();
      const dest = role === 'CLIENT' ? '/client' : (role === 'ADMIN' || role === 'SUPER_ADMIN') ? '/admin' : '/employee';

      setTimeout(() => {
        navigate(dest, { replace: true });
        // Fallback for iframe contexts
        setTimeout(() => { if (window.location.pathname === '/login') window.location.href = dest; }, 800);
      }, 500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Credenciales incorrectas');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-500">

      {/* Visual Side */}
      <div className="hidden lg:block relative overflow-hidden bg-blue-700 dark:bg-blue-900 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700/95 to-blue-800/80 dark:from-blue-900/95 dark:to-slate-900/95 z-10" />
        <img
          src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80"
          alt="Luxury Car"
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm opacity-60"
        />

        <div className="relative z-20 h-full flex flex-col justify-center px-16 text-white text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <img src="/logo.png" alt="Luxury Garage" className="w-24 h-24 object-contain mb-8 drop-shadow-2xl" />
            <div className="mb-8 inline-flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
              <Sparkles size={18} className="text-amber-400" />
              <span className="text-sm font-bold tracking-widest uppercase">Membresía Exclusiva</span>
            </div>
            <h2 className="text-6xl font-black italic tracking-tighter mb-4 leading-none uppercase">
              BIENVENIDO A <br />
              <span className="text-amber-400">LUXURY GARAGE</span>
            </h2>
            <p className="text-xl text-white/70 max-w-md font-light leading-relaxed">
              El club más exclusivo para el cuidado y gestión de vehículos de alta gama.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Login Side */}
      <div className="flex items-center justify-center p-8 bg-white dark:bg-slate-900 transition-colors">
        <div className="w-full max-w-md">
          <div className="text-center lg:text-left mb-8">
            <div className="lg:hidden flex flex-col items-center gap-3 mb-6">
              <img src="/logo.png" alt="Luxury Garage" className="w-20 h-20 object-contain" />
              <h1 className="text-2xl font-black tracking-tighter text-blue-600 dark:text-blue-400 italic font-headline transition-colors">LUXURY GARAGE</h1>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1 transition-colors uppercase italic tracking-tighter">Iniciar Sesión</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Ingresa tus credenciales para acceder</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">Correo Electrónico</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 dark:text-white text-sm font-bold placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none"
                  placeholder="ejemplo@luxury.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">Contraseña</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 dark:text-white text-sm font-bold placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end px-1">
              <button type="button" className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:underline">¿Olvidaste tu contraseña?</button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-blue-600 dark:bg-blue-600 text-white rounded-2xl font-black tracking-widest uppercase text-xs shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] hover:shadow-xl flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={18} />
                  Acceder al Sistema
                </>
              )}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 text-center transition-colors">
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">¿Aún no eres miembro? <button className="text-blue-600 dark:text-blue-400 font-black hover:underline tracking-tight">Solicitar Membresía</button></p>
          </div>
          <p className="text-center mt-6 text-[10px] text-slate-300 uppercase tracking-widest font-black">Powered by ARIZAR IA</p>
        </div>
      </div>
    </div>
  );
}
