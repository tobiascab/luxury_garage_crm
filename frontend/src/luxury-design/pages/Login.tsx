import React, { useState, useEffect } from 'react';
import { useAnimationControls } from 'framer-motion';
import { Mail, Lock, LogIn, Sparkles, Eye, EyeOff } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

// next: a dónde ir después de loguear (ej. /planes desde la landing).
// Solo aceptamos rutas internas para evitar open-redirects.
const safeNext = (raw: string | null) =>
    raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
const destFor = (role: string, next: string | null) =>
    role === 'CLIENT' ? (next || '/inicio')
        : (role === 'ADMIN' || role === 'SUPER_ADMIN') ? '/admin'
            : '/employee';
import {
    motion,
    StaggerList,
    StaggerItem,
    Pressable,
    useReduce,
    springSoft,
    springSnappy,
} from '../lib/motion';
import MembershipRequestForm from '../components/MembershipRequestForm';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
    const [errorShake, setErrorShake] = useState(0); // contador: ++ en cada login fallido → retriggerea el shake
    const [showRequest, setShowRequest] = useState(false);
    const { login, user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const reduce = useReduce();
    const shakeControls = useAnimationControls();

    // Si ya hay sesión válida al abrir /login (caso típico al lanzar la PWA),
    // saltamos directo al panel sin mostrar el formulario.
    useEffect(() => {
        if (loading || !user) return;
        const next = safeNext(new URLSearchParams(location.search).get('next'));
        navigate(destFor((user.role || '').toUpperCase(), next), { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const userData = await login(email, password);
            toast.success(`¡Bienvenido, ${userData.firstName}!`);

            // Redirección por rol (respetando ?next= si vino de la landing).
            const next = safeNext(new URLSearchParams(location.search).get('next'));
            const dest = destFor(userData.role.toUpperCase(), next);

            setTimeout(() => {
                navigate(dest, { replace: true });
            }, 500);
        } catch (error: any) {
            console.error('Error al iniciar sesión:', error);
            toast.error(error.response?.data?.message || 'Error de conexión con el servidor');
            // Feedback visual de error: shake del formulario
            setErrorShake((n) => n + 1);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-500">
            {/* Visual Side */}
            <div className="hidden lg:block relative overflow-hidden bg-primary dark:bg-blue-900">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/95 to-primary-dark/95 dark:from-blue-900/95 dark:to-slate-900/95 z-10" />
                <img
                    src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80"
                    alt="Luxury Car"
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm opacity-60"
                />

                <div className="relative z-20 h-full flex flex-col justify-center px-16 2xl:px-24 text-white lg:max-w-3xl">
                    <StaggerList>
                        <StaggerItem>
                            <img src="/logo.png" alt="" className="w-24 h-24 object-contain mb-8 drop-shadow-2xl" />
                        </StaggerItem>
                        <StaggerItem>
                            <motion.div
                                className="mb-8 inline-flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20"
                                whileHover={reduce ? undefined : { scale: 1.04 }}
                                transition={springSnappy}
                            >
                                <motion.span
                                    animate={reduce ? undefined : { rotate: [0, 15, -10, 0] }}
                                    transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
                                    className="inline-flex"
                                >
                                    <Sparkles size={18} className="text-secondary" />
                                </motion.span>
                                <span className="text-sm font-bold tracking-widest uppercase">Membresía Exclusiva</span>
                            </motion.div>
                        </StaggerItem>
                        <StaggerItem>
                            <h2 className="text-6xl 2xl:text-7xl font-black italic tracking-tighter mb-4 leading-none">
                                BIENVENIDO A <br />
                                <span className="brand-wordmark">LUXURY GARAGE</span>
                            </h2>
                        </StaggerItem>
                        <StaggerItem>
                            <p className="text-xl text-white/70 max-w-md font-light leading-relaxed">
                                El club más exclusivo para el cuidado y gestión de vehículos de alta gama.
                            </p>
                        </StaggerItem>
                    </StaggerList>
                </div>

                {/* Floating Accents */}
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary/20 rounded-full blur-[100px]" />
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-[100px]" />
            </div>

            {/* Login Side */}
            <div className="flex items-center justify-center p-8 lg:p-12 bg-white dark:bg-slate-900 transition-colors">
                <motion.div
                    className="w-full max-w-md xl:max-w-lg"
                    key={errorShake}
                    animate={errorShake && !reduce ? { x: [0, -10, 10, -8, 8, -4, 0] } : undefined}
                    transition={{ duration: 0.45, ease: 'easeInOut' }}
                >
                    <StaggerList>
                        <StaggerItem>
                            <div className="text-center lg:text-left mb-8">
                                <div className="lg:hidden flex flex-col items-center gap-3 mb-6">
                                    <img src="/logo.png" alt="" className="w-20 h-20 object-contain" />
                                    <h1 className="text-3xl brand-wordmark">LUXURY GARAGE</h1>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1 transition-colors uppercase italic tracking-tighter">Iniciar Sesión</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Ingresa tus credenciales para acceder</p>
                            </div>
                        </StaggerItem>

                        <StaggerItem>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">Correo Electrónico</label>
                                    <motion.div
                                        className="relative group"
                                        animate={reduce ? undefined : { scale: focusedField === 'email' ? 1.015 : 1 }}
                                        transition={springSoft}
                                    >
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary dark:group-focus-within:text-blue-400 transition-colors" size={20} />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            onFocus={() => setFocusedField('email')}
                                            onBlur={() => setFocusedField((f) => (f === 'email' ? null : f))}
                                            className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 dark:focus:ring-blue-500/20 transition-all text-slate-900 dark:text-white text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                            placeholder="ejemplo@luxury.com"
                                            required
                                        />
                                    </motion.div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">Contraseña</label>
                                    <motion.div
                                        className="relative group"
                                        animate={reduce ? undefined : { scale: focusedField === 'password' ? 1.015 : 1 }}
                                        transition={springSoft}
                                    >
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary dark:group-focus-within:text-blue-400 transition-colors" size={18} />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onFocus={() => setFocusedField('password')}
                                            onBlur={() => setFocusedField((f) => (f === 'password' ? null : f))}
                                            className="w-full pl-11 pr-11 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 dark:focus:ring-blue-500/20 transition-all text-slate-900 dark:text-white text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                            placeholder="••••••••"
                                            required
                                        />
                                        <motion.button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            whileTap={reduce ? undefined : { scale: 0.85 }}
                                            transition={springSnappy}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary dark:hover:text-blue-400 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </motion.button>
                                    </motion.div>
                                </div>

                                <div className="flex justify-end px-1">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/olvide-contrasena')}
                                        className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-blue-400 hover:underline"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </div>

                                <Pressable
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black tracking-widest uppercase text-xs shadow-lg shadow-primary/20 dark:shadow-blue-500/20 transition-shadow hover:shadow-xl hover:shadow-primary/30 flex items-center justify-center gap-3 disabled:opacity-70"
                                >
                                    {isLoading ? (
                                        <motion.div
                                            className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                                        />
                                    ) : (
                                        <>
                                            <LogIn size={18} />
                                            Acceder al Sistema
                                        </>
                                    )}
                                </Pressable>
                            </form>
                        </StaggerItem>

                        <StaggerItem>
                            <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 text-center transition-colors">
                                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">¿Aún no eres miembro? <button type="button" onClick={() => setShowRequest(true)} className="text-primary dark:text-blue-400 font-black hover:underline tracking-tight">Solicitar Membresía</button></p>
                            </div>
                        </StaggerItem>
                    </StaggerList>
                </motion.div>
            </div>

            <MembershipRequestForm
                open={showRequest}
                onClose={() => setShowRequest(false)}
                source="login"
            />
        </div>
    );
}
