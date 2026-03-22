import React, { useState, useEffect, useRef } from 'react';
import { Home, Calendar, QrCode, CreditCard, User, Bell, ArrowLeft, ShieldCheck, CheckCircle2, X, Moon, Sun, History } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { API_URL } from '../config';
import { useLuxuryUser } from '../context/LuxuryUserContext';

interface Notification {
    id: string;
    type: 'success' | 'info' | 'reminder';
    title: string;
    body: string;
    date: string;
}

interface MainLayoutProps {
    children: React.ReactNode;
    user?: any;
}

export default function MainLayout({ children, user: userProp }: MainLayoutProps) {
    const { fullUser } = useLuxuryUser();
    const user = userProp ?? fullUser;
    const navigate = useNavigate();
    const location = useLocation();
    const [showNotifs, setShowNotifs] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [readIds, setReadIds] = useState<Set<string>>(new Set());
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
    const notifRef = useRef<HTMLDivElement>(null);

    const activeScreen = location.pathname === '/' ? 'dashboard' : (location.pathname.substring(1) || 'dashboard');
    const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

    // Sync with localStorage and HTML class
    useEffect(() => {
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    // Fetch notifications on mount and every 30 seconds
    useEffect(() => {
        if (!user?.id) return;
        const fetchNotifs = async () => {
            try {
                const res = await fetch(`${API_URL}/api/users/${user.id}/notifications`);
                const data = await res.json();
                setNotifications(data);
            } catch (_) { }
        };
        fetchNotifs();
        const interval = setInterval(fetchNotifs, 30000);
        return () => clearInterval(interval);
    }, [user?.id]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setShowNotifs(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleBellClick = () => {
        setShowNotifs(prev => !prev);
        if (!showNotifs) {
            setReadIds(new Set(notifications.map(n => n.id)));
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const typeColor = (type: string) => {
        if (type === 'success') return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
        if (type === 'reminder') return 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400';
        return 'bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-400';
    };

    return (
        <div className={`min-h-screen transition-colors duration-500 pb-24 ${darkMode ? 'dark bg-[#0f172a]' : 'bg-background'}`}>
            {/* Top Navigation Bar */}
            <header className={`fixed top-0 w-full z-50 px-4 py-3 border-b transition-all duration-300 ${darkMode ? 'bg-[#1e293b]/80 border-slate-800' : 'bg-white/80 border-slate-100'
                } backdrop-blur-xl`}>
                <div className="max-w-md mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {activeScreen !== 'dashboard' && (
                            <button
                                onClick={() => navigate('/')}
                                className={`p-1.5 rounded-full transition-colors active:scale-90 ${darkMode ? 'hover:bg-slate-800 text-blue-400' : 'hover:bg-slate-100 text-primary'
                                    }`}
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full overflow-hidden border-2 shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-primary-container border-white'
                                }`}>
                                <img
                                    src={user?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                />
                            </div>
                            <div className="hidden md:block">
                                <p className={`text-[9px] font-bold tracking-widest uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Estado del Miembro</p>
                                <p className={`text-xs font-bold ${darkMode ? 'text-blue-400' : 'text-primary'}`}>{user?.role || "VIP de Lujo"}</p>
                            </div>
                        </div>
                    </div>

                    <h1 className={`text-lg font-black tracking-tighter italic font-headline ${darkMode ? 'text-blue-400' : 'text-primary'}`}>LUXURY GARAGE</h1>

                    <div className="flex items-center gap-2">
                        {/* Theme Toggle */}
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className={`p-1.5 transition-colors rounded-full ${darkMode ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}
                        >
                            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        {/* Bell with notification panel */}
                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={handleBellClick}
                                className={`p-1.5 transition-colors relative ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-primary'}`}
                            >
                                <Bell size={18} />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>

                            {/* Notification Dropdown */}
                            <AnimatePresence>
                                {showNotifs && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                                        transition={{ duration: 0.15 }}
                                        className={`absolute right-0 top-10 w-80 rounded-3xl shadow-2xl border z-[200] overflow-hidden ${darkMode ? 'bg-[#1e293b] border-slate-700' : 'bg-white border-slate-100'
                                            }`}
                                    >
                                        <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                                            <h3 className={`font-black text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>Notificaciones</h3>
                                            <button onClick={() => setShowNotifs(false)} className="text-slate-300 hover:text-slate-500">
                                                <X size={16} />
                                            </button>
                                        </div>

                                        {notifications.length === 0 ? (
                                            <div className="py-8 text-center">
                                                <Bell size={28} className={`${darkMode ? 'text-slate-700' : 'text-slate-200'} mx-auto mb-2`} />
                                                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Sin notificaciones por ahora</p>
                                            </div>
                                        ) : (
                                            <div className={`max-h-80 overflow-y-auto divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-50'}`}>
                                                {notifications.map((n) => (
                                                    <div key={n.id} className={`flex items-start gap-3 p-4 transition-colors ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                                                        } ${!readIds.has(n.id) ? (darkMode ? 'bg-blue-500/10' : 'bg-primary/2') : ''}`}>
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm ${typeColor(n.type)}`}>
                                                            {n.type === 'success' ? '✅' : n.type === 'reminder' ? '⏰' : '🔔'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`font-bold text-xs leading-tight ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{n.title}</p>
                                                            <p className={`text-[11px] mt-0.5 leading-snug ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{n.body}</p>
                                                            <p className={`text-[9px] mt-1 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`}>{formatDate(n.date)}</p>
                                                        </div>
                                                        {!readIds.has(n.id) && (
                                                            <div className="w-2 h-2 bg-primary dark:bg-blue-400 rounded-full shrink-0 mt-1" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="pt-16 px-4 max-w-md mx-auto">
                {children}
            </main>

            {/* Bottom Navigation Bar */}
            <nav className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md flex justify-around items-center px-2 pb-5 pt-2 border-t z-50 rounded-t-3xl transition-all duration-300 shadow-[0_-8px_20px_rgba(0,0,0,0.04)] ${darkMode ? 'bg-[#1e293b]/90 border-slate-800 backdrop-blur-2xl' : 'bg-white/90 border-slate-100 backdrop-blur-2xl'
                }`}>
                {(user?.role === 'Empleado' || user?.role === 'EMPLOYEE') ? (
                    <>
                        <NavItem active={activeScreen === 'dashboard'} onClick={() => navigate('/')} icon={<Home size={18} />} label="Inicio" darkMode={darkMode} />
                        <NavItem active={activeScreen === 'scan'} onClick={() => navigate('/scan')} icon={<QrCode size={18} />} label="Escanear" darkMode={darkMode} />
                        <NavItem active={activeScreen === 'historial'} onClick={() => navigate('/historial')} icon={<History size={18} />} label="Historial" darkMode={darkMode} />
                        <NavItem active={activeScreen === 'perfil'} onClick={() => navigate('/perfil')} icon={<User size={18} />} label="Perfil" darkMode={darkMode} />
                    </>
                ) : (
                    <>
                        <NavItem active={activeScreen === 'dashboard'} onClick={() => navigate('/')} icon={<Home size={18} />} label="Inicio" darkMode={darkMode} />
                        <NavItem active={activeScreen === 'booking'} onClick={() => navigate('/booking')} icon={<Calendar size={18} />} label="Reserva" darkMode={darkMode} />
                        <NavItem active={activeScreen === 'qr'} onClick={() => navigate('/qr')} icon={<QrCode size={18} />} label="QR" darkMode={darkMode} />
                        <NavItem active={activeScreen === 'planes'} onClick={() => navigate('/planes')} icon={<CreditCard size={18} />} label="Planes" darkMode={darkMode} />
                        <NavItem active={activeScreen === 'perfil'} onClick={() => navigate('/perfil')} icon={<User size={18} />} label="Perfil" darkMode={darkMode} />
                    </>
                )}
            </nav>
        </div>
    );
}

function NavItem({ active, onClick, icon, label, darkMode }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, darkMode: boolean }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center transition-all duration-300 active:scale-95 group ${active
                ? (darkMode ? 'text-blue-400 scale-105' : 'text-primary scale-105')
                : 'text-slate-400 hover:text-slate-600'
                }`}
        >
            <div className={`p-1.5 rounded-xl transition-all duration-300 ${active
                ? (darkMode ? 'bg-blue-500/10' : 'bg-primary/10')
                : (darkMode ? 'group-hover:bg-slate-800' : 'group-hover:bg-slate-50')
                }`}>
                {icon}
            </div>
            <span className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 transition-opacity ${active ? 'opacity-100' : 'opacity-50'}`}>{label}</span>
        </button>
    );
}
