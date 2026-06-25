import React, { useState, useEffect, useRef } from 'react';
import {
    Home, Calendar, QrCode, CreditCard, User,
    Bell, BellRing, ArrowLeft, X, Moon, Sun, History,
    Droplets, ShieldCheck, Gift, Megaphone, Info, AlertTriangle, Check, CheckCheck,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { pageVariants, popIn, springSnappy, springPop, useReduce } from '../lib/motion';
import api from '../../services/api';
import { isPushSupported, getPermission, isSubscribed, subscribeToPush } from '../lib/push';
import { useLuxuryUser } from '../context/LuxuryUserContext';
import { useAuth } from '../../context/AuthContext';
import AIChatWidget from '../components/AIChatWidget';

// ── Types ──────────────────────────────────────────────────────────────────
type NotifType = 'wash_done' | 'appointment' | 'payment' | 'membership' | 'referral' | 'promo' | 'success' | 'alert' | 'info';

interface Notification {
    id: string;
    type: NotifType | string;
    title: string;
    body: string;
    date: string;
    isRead?: boolean;
}

// Mapa tipo → ícono + estilos (icono/color del avatar de cada notificación).
const TYPE_META: Record<string, { Icon: React.ElementType; cls: string }> = {
    wash_done:   { Icon: Droplets,      cls: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    appointment: { Icon: Calendar,      cls: 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400' },
    payment:     { Icon: CreditCard,    cls: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    membership:  { Icon: ShieldCheck,   cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400' },
    referral:    { Icon: Gift,          cls: 'bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400' },
    promo:       { Icon: Megaphone,     cls: 'bg-pink-100 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400' },
    success:     { Icon: Check,         cls: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    alert:       { Icon: AlertTriangle, cls: 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400' },
    info:        { Icon: Info,          cls: 'bg-primary/10 dark:bg-blue-500/15 text-primary dark:text-blue-400' },
};
const typeMeta = (t: string) => TYPE_META[t] || TYPE_META.info;

// "ahora", "hace 5 min", "hace 2 h", "ayer", "hace 3 d", o fecha corta.
const relativeTime = (d: string): string => {
    const then = new Date(d).getTime();
    if (isNaN(then)) return '';
    const diff = Date.now() - then;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'ahora';
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    const days = Math.floor(h / 24);
    if (days === 1) return 'ayer';
    if (days < 7) return `hace ${days} d`;
    return new Date(d).toLocaleDateString('es-PY', { day: 'numeric', month: 'short' });
};

const READ_STORAGE_KEY = 'lg_notif_read_ids';
const loadReadIds = (): Set<string> => {
    try { return new Set(JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || '[]')); }
    catch { return new Set(); }
};

interface MainLayoutProps {
    children?: React.ReactNode;
}

// ── Tab definitions ────────────────────────────────────────────────────────
const CLIENT_TABS = ['/inicio', '/booking', '/qr', '/planes', '/perfil'];
const EMPLOYEE_TABS = ['/employee', '/scan', '/historial', '/perfil'];

const NAV_CLIENT = [
    { path: '/inicio', Icon: Home, label: 'Inicio' },
    { path: '/booking', Icon: Calendar, label: 'Reserva' },
    { path: '/qr', Icon: QrCode, label: 'QR' },
    { path: '/planes', Icon: CreditCard, label: 'Planes' },
    { path: '/perfil', Icon: User, label: 'Perfil' },
];

const NAV_EMPLOYEE = [
    { path: '/employee', Icon: Home, label: 'Inicio' },
    { path: '/scan', Icon: QrCode, label: 'Escanear' },
    { path: '/historial', Icon: History, label: 'Historial' },
    { path: '/perfil', Icon: User, label: 'Perfil' },
];

const MIN_SWIPE = 50;
const MAX_SWIPE_Y = 80;

// ── Component ──────────────────────────────────────────────────────────────
export default function MainLayout({ children }: MainLayoutProps) {
    const { fullUser, refreshProfile } = useLuxuryUser();
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const reduce = useReduce();

    const isEmployee = fullUser?.role === 'Empleado' || fullUser?.role === 'EMPLOYEE';
    const TABS = isEmployee ? EMPLOYEE_TABS : CLIENT_TABS;
    const NAV_ITEMS = isEmployee ? NAV_EMPLOYEE : NAV_CLIENT;
    const currentIdx = TABS.indexOf(location.pathname);
    const isTabRoute = currentIdx !== -1;

    // ── Dark mode ─────────────────────────────────────────────────────────────
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
    useEffect(() => {
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', darkMode);
    }, [darkMode]);

    // ── Notifications ─────────────────────────────────────────────────────────
    const [showNotifs, setShowNotifs] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());
    const notifRef = useRef<HTMLDivElement>(null);

    const persistRead = (set: Set<string>) => {
        try { localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...set])); } catch { /* noop */ }
    };

    useEffect(() => {
        if (!fullUser?.id) return;
        const fetchN = async () => {
            try {
                const res = await api.get('/luxury/notifications');
                const data = res.data?.data ?? res.data;
                setNotifications(Array.isArray(data) ? data : []);
            } catch { setNotifications([]); }
        };
        fetchN();
        const iv = setInterval(fetchN, 30000);
        return () => clearInterval(iv);
    }, [fullUser?.id]);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const isUnread = (n: Notification) => !n.isRead && !readIds.has(n.id);
    const unreadCount = notifications.filter(isUnread).length;

    const handleBell = () => setShowNotifs(p => !p);

    const markAllRead = () => setReadIds(prev => {
        const next = new Set(prev);
        notifications.forEach(n => next.add(n.id));
        persistRead(next);
        return next;
    });
    const markOneRead = (id: string) => setReadIds(prev => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        persistRead(next);
        return next;
    });

    // ── Push (Web Push) ───────────────────────────────────────────────────────
    const [pushStatus, setPushStatus] = useState<'unsupported' | 'default' | 'granted' | 'denied'>('default');
    const [pushBusy, setPushBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        (async () => {
            if (!isPushSupported()) { if (alive) setPushStatus('unsupported'); return; }
            const perm = getPermission();
            const subbed = perm === 'granted' ? await isSubscribed() : false;
            if (!alive) return;
            setPushStatus(
                perm === 'unsupported' ? 'unsupported'
                    : perm === 'denied' ? 'denied'
                        : (perm === 'granted' && subbed) ? 'granted'
                            : 'default'
            );
        })();
        return () => { alive = false; };
    }, [fullUser?.id]);

    const enablePush = async () => {
        setPushBusy(true);
        const r = await subscribeToPush();
        setPushBusy(false);
        if (r.ok) setPushStatus('granted');
        else if (r.reason === 'denied') setPushStatus('denied');
    };
    const showPushCta = pushStatus === 'default';

    // ── Swipe detection ───────────────────────────────────────────────────────
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const touchStartTime = useRef(0);
    const inHScroll = useRef(false); // true if touch started inside horizontal scroll

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchStartTime.current = Date.now();

        // Walk up the DOM: if any ancestor has overflow-x scroll/auto AND is actually scrollable → skip
        let el = e.target as HTMLElement | null;
        let found = false;
        for (let i = 0; i < 10 && el && el !== e.currentTarget as any; i++) {
            const ox = window.getComputedStyle(el).overflowX;
            if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth) {
                found = true;
                break;
            }
            el = el.parentElement;
        }
        inHScroll.current = found;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!isTabRoute) return;
        if (inHScroll.current) return; // let the inner carousel handle it

        const diffX = e.changedTouches[0].clientX - touchStartX.current;
        const diffY = e.changedTouches[0].clientY - touchStartY.current;
        const elapsed = Date.now() - touchStartTime.current;

        if (Math.abs(diffY) > MAX_SWIPE_Y) return;
        if (Math.abs(diffX) < MIN_SWIPE) return;
        if (elapsed > 500) return;

        const nextIdx = diffX < 0
            ? Math.min(currentIdx + 1, TABS.length - 1)
            : Math.max(currentIdx - 1, 0);

        if (nextIdx !== currentIdx) navigate(TABS[nextIdx]);
    };

    // ── Nav click ─────────────────────────────────────────────────────────────
    const goTo = (path: string) => navigate(path);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'dark bg-[#0f172a]' : 'bg-background'}`}>

            {/* ── Header ── */}
            <header className={`fixed top-0 w-full z-50 px-4 py-3 border-b transition-all duration-300 ${darkMode ? 'bg-[#1e293b]/80 border-slate-800' : 'bg-white/80 border-slate-100'} backdrop-blur-xl`}>
                <div className="max-w-md mx-auto flex justify-between items-center">

                    <div className="flex items-center gap-3">
                        {!isTabRoute && (
                            <button
                                onClick={() => navigate(isEmployee ? '/employee' : '/inicio')}
                                className={`p-1.5 rounded-full transition-colors active:scale-90 ${darkMode ? 'hover:bg-slate-800 text-blue-400' : 'hover:bg-slate-100 text-primary'}`}
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <div className={`w-8 h-8 rounded-full overflow-hidden border-2 shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-primary-container border-white'}`}>
                            <img
                                src={fullUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'}
                                alt="Profile"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <img src="/logo.png" alt="" className="w-6 h-6 object-contain shrink-0" />
                        <h1 className="text-[15px] leading-none brand-wordmark">LUXURY GARAGE</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setDarkMode(d => !d)}
                            className={`p-1.5 transition-colors rounded-full ${darkMode ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}
                        >
                            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={handleBell}
                                className={`p-1.5 transition-colors relative ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-primary'}`}
                            >
                                <Bell size={18} />
                                <AnimatePresence>
                                    {unreadCount > 0 && (
                                        <motion.span
                                            key={unreadCount}
                                            variants={reduce ? undefined : popIn}
                                            initial={reduce ? { opacity: 0 } : 'hidden'}
                                            animate={reduce ? { opacity: 1 } : 'show'}
                                            exit={reduce ? { opacity: 0 } : 'exit'}
                                            className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white"
                                        >
                                            {unreadCount}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </button>

                            <AnimatePresence>
                                {showNotifs && (
                                    <motion.div
                                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
                                        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                                        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
                                        transition={reduce ? { duration: 0.12 } : springSnappy}
                                        style={{ transformOrigin: 'top right' }}
                                        className={`absolute right-0 top-11 w-[calc(100vw-1.5rem)] max-w-sm rounded-[1.75rem] shadow-2xl border z-[200] overflow-hidden ${darkMode ? 'bg-[#1e293b] border-slate-700' : 'bg-white border-slate-100'}`}
                                    >
                                        {/* Header */}
                                        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                            <div className="flex items-center gap-2">
                                                <h3 className={`font-black text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>Notificaciones</h3>
                                                {unreadCount > 0 && (
                                                    <span className="px-1.5 py-0.5 rounded-full bg-primary dark:bg-blue-500 text-white text-[9px] font-black min-w-[18px] text-center">{unreadCount}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {unreadCount > 0 && (
                                                    <button onClick={markAllRead} title="Marcar todas como leídas" className={`p-1.5 rounded-full transition-colors ${darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-primary hover:bg-slate-100'}`}>
                                                        <CheckCheck size={16} />
                                                    </button>
                                                )}
                                                <button onClick={() => setShowNotifs(false)} className={`p-1.5 rounded-full transition-colors ${darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}><X size={16} /></button>
                                            </div>
                                        </div>

                                        {/* CTA: activar notificaciones push */}
                                        {showPushCta && (
                                            <button
                                                onClick={enablePush}
                                                disabled={pushBusy}
                                                className={`w-full flex items-center gap-3 px-5 py-3 text-left border-b transition-colors ${darkMode ? 'border-slate-800 bg-blue-500/10 hover:bg-blue-500/[0.15]' : 'border-slate-100 bg-primary/5 hover:bg-primary/10'} disabled:opacity-60`}
                                            >
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-primary/10 text-primary'}`}>
                                                    <BellRing size={17} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-black text-xs ${darkMode ? 'text-white' : 'text-slate-900'}`}>{pushBusy ? 'Activando…' : 'Activá las notificaciones'}</p>
                                                    <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Recibilas aunque no tengas la app abierta.</p>
                                                </div>
                                            </button>
                                        )}

                                        {/* Lista */}
                                        {notifications.length === 0 ? (
                                            <div className="py-12 text-center px-6">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                    <Bell size={24} className={darkMode ? 'text-slate-600' : 'text-slate-300'} />
                                                </div>
                                                <p className={`text-sm font-bold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Estás al día</p>
                                                <p className={`text-[11px] mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>No tenés notificaciones por ahora.</p>
                                            </div>
                                        ) : (
                                            <div className={`max-h-[22rem] overflow-y-auto overscroll-contain divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-50'}`}>
                                                {notifications.map((n, i) => {
                                                    const { Icon, cls } = typeMeta(n.type);
                                                    const unread = isUnread(n);
                                                    return (
                                                        <motion.button
                                                            key={n.id}
                                                            type="button"
                                                            onClick={() => markOneRead(n.id)}
                                                            initial={reduce ? undefined : { opacity: 0, y: 6 }}
                                                            animate={reduce ? undefined : { opacity: 1, y: 0 }}
                                                            transition={reduce ? undefined : { delay: Math.min(i * 0.03, 0.25) }}
                                                            className={`w-full flex items-start gap-3 px-5 py-3.5 text-left transition-colors ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} ${unread ? (darkMode ? 'bg-blue-500/[0.07]' : 'bg-primary/[0.04]') : ''}`}
                                                        >
                                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cls}`}>
                                                                <Icon size={17} strokeWidth={2.3} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <p className={`font-black text-xs leading-tight truncate ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{n.title}</p>
                                                                    {unread && <span className="w-1.5 h-1.5 rounded-full bg-primary dark:bg-blue-400 shrink-0" />}
                                                                </div>
                                                                <p className={`text-[11px] mt-0.5 leading-snug line-clamp-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{n.body}</p>
                                                                <p className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{relativeTime(n.date)}</p>
                                                            </div>
                                                        </motion.button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Main content — swipe captured here ── */}
            <main
                className="pt-16 px-4 max-w-md mx-auto pb-24"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={location.pathname}
                        variants={reduce ? undefined : pageVariants}
                        initial={reduce ? { opacity: 0 } : 'initial'}
                        animate={reduce ? { opacity: 1 } : 'animate'}
                        exit={reduce ? { opacity: 0 } : 'exit'}
                        transition={reduce ? { duration: 0.12 } : undefined}
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* ── Bottom Navigation ── */}
            <nav className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md flex justify-around items-center px-2 pb-5 pt-2 border-t z-50 rounded-t-3xl transition-all duration-300 shadow-[0_-8px_20px_rgba(0,0,0,0.04)] ${darkMode ? 'bg-[#1e293b]/90 border-slate-800 backdrop-blur-2xl' : 'bg-white/90 border-slate-100 backdrop-blur-2xl'}`}>
                {NAV_ITEMS.map(item => (
                    <NavItem
                        key={item.path}
                        active={location.pathname === item.path}
                        onClick={() => goTo(item.path)}
                        icon={<item.Icon size={18} />}
                        label={item.label}
                        darkMode={darkMode}
                        reduce={reduce}
                    />
                ))}
            </nav>

            {/* ── Asistente IA (FAB flotante en toda la web app del cliente) ── */}
            <AIChatWidget />
        </div>
    );
}

// ── NavItem ────────────────────────────────────────────────────────────────
function NavItem({
    active, onClick, icon, label, darkMode, reduce,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; darkMode: boolean; reduce: boolean }) {
    return (
        <motion.button
            onClick={onClick}
            whileTap={reduce ? undefined : { scale: 0.9 }}
            transition={springSnappy}
            className={`flex flex-col items-center justify-center group ${active ? (darkMode ? 'text-blue-400' : 'text-primary') : 'text-slate-400 hover:text-slate-600'
                }`}
        >
            <div className="relative p-1.5 rounded-xl">
                {/* Indicador del tab activo — layout animation compartida */}
                {active && (
                    <motion.div
                        layoutId="nav-active-pill"
                        className={`absolute inset-0 rounded-xl ${darkMode ? 'bg-blue-500/15' : 'bg-primary/10'}`}
                        transition={reduce ? { duration: 0 } : springSnappy}
                    />
                )}
                <motion.div
                    className="relative"
                    animate={reduce ? undefined : { scale: active ? 1.12 : 1, y: active ? -1 : 0 }}
                    transition={springPop}
                >
                    {icon}
                </motion.div>
            </div>
            <span className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 transition-opacity ${active ? 'opacity-100' : 'opacity-50'}`}>
                {label}
            </span>
        </motion.button>
    );
}
