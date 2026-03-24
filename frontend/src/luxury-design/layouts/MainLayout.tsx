import React, { useState, useEffect, useRef } from 'react';
import {
    Home, Calendar, QrCode, CreditCard, User,
    Bell, ArrowLeft, X, Moon, Sun, History
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// ── Page imports for slider ────────────────────────────────────────────────
import Dashboard from '../pages/Dashboard';
import Booking from '../pages/Booking';
import QRPass from '../pages/QRPass';
import Planes from '../pages/Planes';
import Profile from '../pages/Profile';
import DashboardEmpleado from '../pages/DashboardEmpleado';
import EmpleadoScanner from '../pages/EmpleadoScanner';
import HistorialEmpleado from '../pages/HistorialEmpleado';

import api from '../../services/api';
import { useLuxuryUser } from '../context/LuxuryUserContext';
import { useAuth } from '../../context/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────
interface Notification {
    id: string;
    type: 'success' | 'info' | 'reminder';
    title: string;
    body: string;
    date: string;
}

interface MainLayoutProps {
    children?: React.ReactNode; // <Outlet /> from App.jsx — used for non-tab routes
}

// ── Tab definitions ────────────────────────────────────────────────────────
const CLIENT_TABS = [
    { path: '/', Icon: Home, label: 'Inicio' },
    { path: '/booking', Icon: Calendar, label: 'Reserva' },
    { path: '/qr', Icon: QrCode, label: 'QR' },
    { path: '/planes', Icon: CreditCard, label: 'Planes' },
    { path: '/perfil', Icon: User, label: 'Perfil' },
];

const EMPLOYEE_TABS = [
    { path: '/', Icon: Home, label: 'Inicio' },
    { path: '/scan', Icon: QrCode, label: 'Escanear' },
    { path: '/historial', Icon: History, label: 'Historial' },
    { path: '/perfil', Icon: User, label: 'Perfil' },
];

const MIN_SWIPE = 40;

// ── Component ──────────────────────────────────────────────────────────────
export default function MainLayout({ children }: MainLayoutProps) {
    // ── Auth & user from context (LuxuryUserProvider wraps this in App.jsx) ─
    const { fullUser, loading: userLoading, refreshProfile } = useLuxuryUser();
    const { logout } = useAuth();
    const user = fullUser;

    const navigate = useNavigate();
    const location = useLocation();

    const isEmployee = user?.role === 'Empleado' || user?.role === 'EMPLOYEE';
    const TABS = isEmployee ? EMPLOYEE_TABS : CLIENT_TABS;
    const N = TABS.length;

    // Determine initial tab index from current URL
    const getTabIdx = (tabs: typeof CLIENT_TABS) => Math.max(0, tabs.findIndex(t => t.path === location.pathname));
    const initialIdx = getTabIdx(isEmployee ? EMPLOYEE_TABS : CLIENT_TABS);


    // ── Dark mode ─────────────────────────────────────────────────────────────
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
    useEffect(() => {
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', darkMode);
    }, [darkMode]);

    // ── Notifications ─────────────────────────────────────────────────────────
    const [showNotifs, setShowNotifs] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [readIds, setReadIds] = useState<Set<string>>(new Set());
    const notifRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user?.id) return;
        const fetchNotifs = async () => {
            try {
                const res = await api.get('/luxury/notifications');
                const data = res.data?.data ?? res.data;
                setNotifications(Array.isArray(data) ? data : []);
            } catch { setNotifications([]); }
        };
        fetchNotifs();
        const iv = setInterval(fetchNotifs, 30000);
        return () => clearInterval(iv);
    }, [user?.id]);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node))
                setShowNotifs(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;
    const handleBell = () => {
        setShowNotifs(p => !p);
        if (!showNotifs) setReadIds(new Set(notifications.map(n => n.id)));
    };
    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const typeColor = (t: string) =>
        t === 'success' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            : t === 'reminder' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-400';

    // ── Tab routing ───────────────────────────────────────────────────────────
    const tabIdx = TABS.findIndex(t => t.path === location.pathname);
    const isTabRoute = tabIdx !== -1;

    const [activeTab, setActiveTab] = useState(initialIdx);

    // ── Slider ref ────────────────────────────────────────────────────────────
    const sliderRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // ── Slider style stored in state so initial position is correct on first paint ──
    const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({
        transform: `translateX(-${initialIdx * (100 / N)}%)`,
        transition: 'none',
    });

    const applyTranslate = (idx: number, animated: boolean) => {
        const transform = `translateX(-${idx * (100 / N)}%)`;
        const transition = animated ? 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
        // Update DOM immediately (no re-render lag)
        if (sliderRef.current) {
            sliderRef.current.style.transform = transform;
            sliderRef.current.style.transition = transition;
        }
        // Update state so React re-renders preserve the position
        setSliderStyle({ transform, transition });
    };

    // Sync when URL changes (back button, external navigate)
    useEffect(() => {
        const idx = TABS.findIndex(t => t.path === location.pathname);
        if (idx !== -1 && idx !== activeTab) {
            setActiveTab(idx);
            activeTabRef.current = idx; // Keep ref in sync
            applyTranslate(idx, true);
        }
    }, [location.pathname, activeTab, TABS]); // eslint-disable-line

    const goToTab = (idx: number) => {
        if (idx < 0 || idx >= N) return;
        activeTabRef.current = idx;
        setActiveTab(idx);
        applyTranslate(idx, true);
        navigate(TABS[idx].path, { replace: true });
    };

    // ── Touch state ──────────────────────────────────────────────────────────
    const activeTabRef = useRef(initialIdx);  // kept in sync with activeTab, safe in touch closures
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const directionLocked = useRef<'horizontal' | 'vertical' | null>(null);
    const isDragging = useRef(false);


    // Non-passive listener so we can preventDefault on horizontal swipe (iOS fix)
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onMove = (e: TouchEvent) => {
            if (directionLocked.current === 'horizontal') e.preventDefault();
        };
        el.addEventListener('touchmove', onMove, { passive: false });
        return () => el.removeEventListener('touchmove', onMove);
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!isTabRoute) return;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        directionLocked.current = null;
        isDragging.current = true;
        // kill any running transition so drag follows finger precisely
        applyTranslate(activeTabRef.current, false);
    };


    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isTabRoute || !isDragging.current) return;
        const diffX = e.touches[0].clientX - touchStartX.current;
        const diffY = e.touches[0].clientY - touchStartY.current;

        if (!directionLocked.current && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
            directionLocked.current = Math.abs(diffX) > Math.abs(diffY) ? 'horizontal' : 'vertical';
        }
        if (directionLocked.current !== 'horizontal') return;

        const idx = activeTabRef.current;

        const base = idx * (100 / N);
        const adj = (idx === 0 && diffX > 0) || (idx === N - 1 && diffX < 0)
            ? diffX * 0.25
            : diffX;

        if (sliderRef.current) {
            sliderRef.current.style.transition = 'none';
            sliderRef.current.style.transform = `translateX(calc(-${base}% + ${adj}px))`;
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!isTabRoute || !isDragging.current) return;
        isDragging.current = false;
        if (directionLocked.current !== 'horizontal') { directionLocked.current = null; return; }
        directionLocked.current = null;

        const diffX = e.changedTouches[0].clientX - touchStartX.current;
        const idx = activeTabRef.current;
        if (Math.abs(diffX) >= MIN_SWIPE) {
            goToTab(diffX < 0 ? Math.min(idx + 1, N - 1) : Math.max(idx - 1, 0));
        } else {
            applyTranslate(idx, true);
        }
    };

    const handleTouchCancel = () => {
        isDragging.current = false;
        directionLocked.current = null;
        applyTranslate(activeTabRef.current, true);
    };


    // ── Render individual tab panel ───────────────────────────────────────────
    const renderPanel = (path: string) => {
        if (userLoading || !user) return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Cargando…</p>
                </div>
            </div>
        );

        const noop = () => { };
        const logoutFn = logout || noop;
        const updateFn = refreshProfile || noop;
        const bookedFn = refreshProfile || noop;

        if (!isEmployee) {
            if (path === '/') return <Dashboard user={user} />;
            if (path === '/booking') return <Booking user={user} onBookingComplete={bookedFn} />;
            if (path === '/qr') return <QRPass user={user} />;
            if (path === '/planes') return <Planes user={user} />;
            if (path === '/perfil') return <Profile user={user} onLogout={logoutFn} onUpdate={updateFn} />;
        } else {
            if (path === '/') return <DashboardEmpleado user={user} />;
            if (path === '/scan') return <EmpleadoScanner user={user} />;
            if (path === '/historial') return <HistorialEmpleado user={user} />;
            if (path === '/perfil') return <Profile user={user} onLogout={logoutFn} onUpdate={updateFn} />;
        }
        return null;
    };

    // ── Layout ────────────────────────────────────────────────────────────────
    return (
        <div className={`h-[100dvh] flex flex-col transition-colors duration-500 overflow-hidden ${darkMode ? 'dark bg-[#0f172a]' : 'bg-background'}`}>

            {/* ── Header ── */}
            <header className={`flex-shrink-0 z-50 px-4 py-3 border-b transition-all duration-300 ${darkMode ? 'bg-[#1e293b]/90 border-slate-800' : 'bg-white/90 border-slate-100'} backdrop-blur-xl`}>
                <div className="max-w-md mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {!isTabRoute && (
                            <button
                                onClick={() => navigate('/')}
                                className={`p-1.5 rounded-full transition-colors active:scale-90 ${darkMode ? 'hover:bg-slate-800 text-blue-400' : 'hover:bg-slate-100 text-primary'}`}
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <div className={`w-8 h-8 rounded-full overflow-hidden border-2 shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-primary-container border-white'}`}>
                            <img
                                src={user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'}
                                alt="Profile"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                            />
                        </div>
                    </div>

                    <h1 className={`text-lg font-black tracking-tighter italic font-headline ${darkMode ? 'text-blue-400' : 'text-primary'}`}>LUXURY GARAGE</h1>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setDarkMode(d => !d)}
                            className={`p-1.5 transition-colors rounded-full ${darkMode ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}
                        >
                            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        <div className="relative" ref={notifRef}>
                            <button onClick={handleBell} className={`p-1.5 transition-colors relative ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-primary'}`}>
                                <Bell size={18} />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>

                            <AnimatePresence>
                                {showNotifs && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                                        transition={{ duration: 0.15 }}
                                        className={`absolute right-0 top-10 w-80 rounded-3xl shadow-2xl border z-[200] overflow-hidden ${darkMode ? 'bg-[#1e293b] border-slate-700' : 'bg-white border-slate-100'}`}
                                    >
                                        <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                                            <h3 className={`font-black text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>Notificaciones</h3>
                                            <button onClick={() => setShowNotifs(false)} className="text-slate-300 hover:text-slate-500"><X size={16} /></button>
                                        </div>
                                        {notifications.length === 0 ? (
                                            <div className="py-8 text-center">
                                                <Bell size={28} className={`${darkMode ? 'text-slate-700' : 'text-slate-200'} mx-auto mb-2`} />
                                                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Sin notificaciones por ahora</p>
                                            </div>
                                        ) : (
                                            <div className={`max-h-80 overflow-y-auto divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-50'}`}>
                                                {notifications.map(n => (
                                                    <div key={n.id} className={`flex items-start gap-3 p-4 transition-colors ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} ${!readIds.has(n.id) ? (darkMode ? 'bg-blue-500/10' : 'bg-primary/5') : ''}`}>
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm ${typeColor(n.type)}`}>
                                                            {n.type === 'success' ? '✅' : n.type === 'reminder' ? '⏰' : '🔔'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`font-bold text-xs leading-tight ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{n.title}</p>
                                                            <p className={`text-[11px] mt-0.5 leading-snug ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{n.body}</p>
                                                            <p className={`text-[9px] mt-1 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`}>{formatDate(n.date)}</p>
                                                        </div>
                                                        {!readIds.has(n.id) && <div className="w-2 h-2 bg-primary dark:bg-blue-400 rounded-full shrink-0 mt-1" />}
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

            {/* ── Content ── */}
            {isTabRoute ? (
                /* SLIDER MODE — all tab pages side by side */
                <div
                    ref={containerRef}
                    className="flex-1 overflow-hidden relative"
                    style={{ touchAction: 'pan-y pinch-zoom' }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchCancel}
                >
                    <div
                        ref={sliderRef}
                        style={{ display: 'flex', width: `${N * 100}%`, height: '100%', willChange: 'transform', ...sliderStyle }}
                    >

                        {TABS.map(tab => (
                            <div
                                key={tab.path}
                                style={{
                                    width: `${100 / N}%`,
                                    flexShrink: 0,
                                    height: '100%',
                                    overflowY: 'auto',
                                    WebkitOverflowScrolling: 'touch' as any,
                                    paddingTop: '1rem',
                                    paddingBottom: '5.5rem',
                                    paddingLeft: '1rem',
                                    paddingRight: '1rem',
                                }}
                            >
                                <div className="max-w-md mx-auto">
                                    {renderPanel(tab.path)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* NORMAL MODE — non-tab routes (billetera, referidos, etc.) via <Outlet /> */
                <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 w-full max-w-md mx-auto">
                    {children}
                </div>
            )}

            {/* ── Bottom Nav ── */}
            <nav className={`flex-shrink-0 w-full max-w-md mx-auto flex justify-around items-center px-2 pb-5 pt-2 border-t z-50 transition-all duration-300 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] ${darkMode ? 'bg-[#1e293b]/90 border-slate-800 backdrop-blur-2xl' : 'bg-white/90 border-slate-100 backdrop-blur-2xl'}`}>
                {TABS.map((tab, idx) => (
                    <NavItem
                        key={tab.path}
                        active={activeTab === idx}
                        onClick={() => goToTab(idx)}
                        icon={<tab.Icon size={18} />}
                        label={tab.label}
                        darkMode={darkMode}
                    />
                ))}
            </nav>
        </div>
    );
}

// ── NavItem ────────────────────────────────────────────────────────────────
function NavItem({ active, onClick, icon, label, darkMode }: {
    active: boolean; onClick: () => void; icon: React.ReactNode; label: string; darkMode: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center transition-all duration-300 active:scale-95 group ${active ? (darkMode ? 'text-blue-400 scale-105' : 'text-primary scale-105') : 'text-slate-400 hover:text-slate-600'}`}
        >
            <div className={`p-1.5 rounded-xl transition-all duration-300 ${active ? (darkMode ? 'bg-blue-500/10' : 'bg-primary/10') : (darkMode ? 'group-hover:bg-slate-800' : 'group-hover:bg-slate-50')}`}>
                {icon}
            </div>
            <span className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 transition-opacity ${active ? 'opacity-100' : 'opacity-50'}`}>{label}</span>
        </button>
    );
}
