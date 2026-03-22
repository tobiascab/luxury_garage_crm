import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, Sparkles, Car, Eye, EyeOff } from 'lucide-react';

import { API_URL } from '../config';

interface LoginProps {
    onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                onLogin(data.user);
            } else {
                alert(data.message || 'Credenciales incorrectas');
            }
        } catch (error) {
            console.error('Error al iniciar sesión:', error);
            alert('Error de conexión con el servidor');
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

                <div className="relative z-20 h-full flex flex-col justify-center px-16 text-white">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="mb-8 inline-flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                            <Sparkles size={18} className="text-secondary" />
                            <span className="text-sm font-bold tracking-widest uppercase">Membresía Exclusiva</span>
                        </div>
                        <h2 className="text-6xl font-black italic tracking-tighter mb-4 leading-none">
                            BIENVENIDO A <br />
                            <span className="text-secondary">LUXURY GARAGE</span>
                        </h2>
                        <p className="text-xl text-white/70 max-w-md font-light leading-relaxed">
                            El club más exclusivo para el cuidado y gestión de vehículos de alta gama.
                        </p>
                    </motion.div>
                </div>

                {/* Floating Accents */}
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary/20 rounded-full blur-[100px]" />
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-[100px]" />
            </div>

            {/* Login Side */}
            <div className="flex items-center justify-center p-8 bg-white dark:bg-slate-900 transition-colors">
                <div className="w-full max-w-md">
                    <div className="text-center lg:text-left mb-8">
                        <div className="lg:hidden flex justify-center mb-6">
                            <h1 className="text-3xl font-black tracking-tighter text-primary dark:text-blue-400 italic font-headline underline-offset-4 decoration-secondary transition-colors">LUXURY GARAGE</h1>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1 transition-colors uppercase italic tracking-tighter">Iniciar Sesión</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Ingresa tus credenciales para acceder</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">Correo Electrónico</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary dark:group-focus-within:text-blue-400 transition-colors" size={20} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 dark:focus:ring-blue-500/20 transition-all text-slate-900 dark:text-white text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                    placeholder="ejemplo@luxury.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">Contraseña</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary dark:group-focus-within:text-blue-400 transition-colors" size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-11 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 dark:focus:ring-blue-500/20 transition-all text-slate-900 dark:text-white text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary dark:hover:text-blue-400 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end px-1">
                            <button type="button" className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-blue-400 hover:underline">¿Olvidaste tu contraseña?</button>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black tracking-widest uppercase text-xs shadow-lg shadow-primary/20 dark:shadow-blue-500/20 transition-all active:scale-[0.98] hover:shadow-xl hover:shadow-primary/30 flex items-center justify-center gap-3 disabled:opacity-70"
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
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">¿Aún no eres miembro? <button className="text-primary dark:text-blue-400 font-black hover:underline tracking-tight">Solicitar Membresía</button></p>
                    </div>
                </div>
            </div>
        </div>
    );
}
