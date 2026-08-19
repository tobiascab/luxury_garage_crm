import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, ShieldCheck, RefreshCw, Clock, Droplets, Star, Info, CheckCircle2, Sparkles, CalendarX, Calendar } from 'lucide-react';
import api from "../../services/api";
import {
    motion,
    AnimatePresence,
    Reveal,
    StaggerList,
    StaggerItem,
    Pressable,
    popIn,
    scaleIn,
    springPop,
    springSoft,
    useReduce,
} from '../lib/motion';



interface QRPassProps {
    user: any;
    onUpdate?: () => void;
}

const QR_EXPIRY_SECONDS = 300;
// Se sigue preguntando por el lavado un rato DESPUÉS de que el QR vence en pantalla: el
// backend acepta el código 15 minutos y el operario puede confirmar sobre la hora.
const LISTEN_WINDOW_MS = (QR_EXPIRY_SECONDS + 180) * 1000;

const FUN_PHRASES = [
    '¡Tu carrazo queda impecable! 🚗✨',
    '¡Brilla más que el sol! ☀️',
    '¡El auto más lindo del día! 🏆',
    '¡Servicio premium activado! 🎖️',
    '¡Un lujo sobre ruedas! 💎',
    '¡El lavadero ya sabe qué hacer! 🧼',
];

// Floating particle for celebration effect
function Particle({ delay, x }: { delay: number; x: number }) {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 6 + Math.random() * 8;
    return (
        <motion.div
            initial={{ y: 0, x, opacity: 1, scale: 1 }}
            animate={{ y: -320, x: x + (Math.random() - 0.5) * 120, opacity: 0, scale: 0.4, rotate: Math.random() * 360 }}
            transition={{ duration: 1.8 + Math.random() * 0.8, delay, ease: 'easeOut' }}
            className="absolute bottom-0 rounded-full pointer-events-none"
            style={{ width: size, height: size, backgroundColor: color, left: '50%' }}
        />
    );
}

export default function QRPass({ user, onUpdate }: QRPassProps) {
    const [qrToken, setQrToken] = useState<string | null>(null);
    const [generatedAt, setGeneratedAt] = useState<number | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(QR_EXPIRY_SECONDS);
    const [isExpired, setIsExpired] = useState(false);
    const [washProcessed, setWashProcessed] = useState(false);
    const [washInfo, setWashInfo] = useState<any | null>(null);
    const [showParticles, setShowParticles] = useState(false);
    const [funPhrase] = useState(() => FUN_PHRASES[Math.floor(Math.random() * FUN_PHRASES.length)]);
    const [nextReservation, setNextReservation] = useState<any | null>(null);
    const [loadingRes, setLoadingRes] = useState(true);

    const navigate = useNavigate();
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const processedRef = useRef(false); // ref-based guard, immune to stale closure
    const reduce = useReduce();

    // Fetch the customer's next pending (CONFIRMED) reservation. The QR redeems
    // a real reservation: the operator scans → that reservation is completed.
    // If there's none, the backend blocks the scan, so we gate the QR by reservation.
    useEffect(() => {
        let alive = true;
        setLoadingRes(true);
        api.get('/appointments', { params: { status: 'CONFIRMED' }, _noCache: true } as any)
            .then((res) => {
                if (!alive) return;
                setNextReservation(res.data?.data?.[0] || null);
            })
            .catch(() => {
                if (!alive) return;
                setNextReservation(null);
            })
            .finally(() => {
                if (alive) setLoadingRes(false);
            });
        return () => { alive = false; };
    }, [user?.id]);

    const formatResDate = (iso?: string) => {
        if (!iso) return null;
        const d = new Date(iso);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleString('es-PY', {
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const generateToken = async () => {
        // Stop any existing poll
        if (pollRef.current) clearInterval(pollRef.current);
        processedRef.current = false;
        try {
            // El token del QR lo EMITE y FIRMA el backend (HMAC). El frontend ya NO lo arma:
            // así un empleado no puede fabricar el carnet de otro cliente.
            // Sin caché: el GET de api guarda 45 s y devolvía el mismo token con el mismo
            // `serverNow`, así que regenerar el QR podía revivir el lavado anterior.
            const res = await api.get('/luxury/qr/token', { _noCache: true } as any);
            const token = res.data?.token;
            if (!token) throw new Error('Token no recibido');
            setQrToken(token);
            // Reloj del SERVIDOR, no el del celular: es el instante desde el que se busca el
            // lavado registrado. Con la hora local, un teléfono desfasado nunca lo encontraba.
            setGeneratedAt(res.data?.serverNow ?? Date.now());
            setSecondsLeft(QR_EXPIRY_SECONDS);
            setIsExpired(false);
            setWashProcessed(false);
            setWashInfo(null);
            setShowParticles(false);
        } catch (e) {
            console.error('No se pudo generar el carnet QR', e);
        }
    };

    // Countdown timer
    useEffect(() => {
        if (!qrToken || isExpired || washProcessed) return;
        const interval = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) { clearInterval(interval); setIsExpired(true); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [qrToken, isExpired, washProcessed]);

    // ── ¿El operario ya confirmó el lavado? ──────────────────────────────────────────
    // Se le pregunta al backend cada 2,5 s y también apenas la app vuelve al frente: en el
    // celular los timers se congelan con la pantalla apagada o al cambiar de app, y el
    // cliente volvía sin ver nunca el aviso. Sigue escuchando después de que el QR vence
    // (LISTEN_WINDOW_MS) porque el backend acepta el código 15 minutos.
    useEffect(() => {
        if (!qrToken || !generatedAt) return;

        // Clear any previous interval before starting a new one
        if (pollRef.current) clearInterval(pollRef.current);
        processedRef.current = false;
        const startedAt = Date.now();

        const stopPolling = () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };

        const check = async () => {
            // Use ref to avoid stale closure
            if (processedRef.current) return;
            if (Date.now() - startedAt > LISTEN_WINDOW_MS) { stopPolling(); return; }
            try {
                // `_noCache` en lugar de un `_t` variable: cada URL distinta dejaba una entrada
                // nueva en el caché en memoria que nadie limpiaba.
                const res = await api.get(`/luxury/latest-wash?since=${generatedAt}`, { _noCache: true } as any);
                // Backend returns: { success: true, found: bool, data: wash|null }
                // IMPORTANT: read .found from res.data, NOT from res.data.data (that's the wash object)
                const { found, data } = res.data;
                if (found && !processedRef.current) {
                    processedRef.current = true; // block re-entry immediately
                    stopPolling();
                    setWashInfo(data || null);
                    setShowParticles(true);
                    setTimeout(() => setWashProcessed(true), 200);
                    onUpdate?.();
                    // La reserva que se acaba de redimir ya no está pendiente: se refresca para
                    // que al cerrar el aviso no ofrezca generar otro QR sin turno.
                    api.get('/appointments', { params: { status: 'CONFIRMED' }, _noCache: true } as any)
                        .then((r) => setNextReservation(r.data?.data?.[0] || null))
                        .catch(() => { });
                }
            } catch (_) { }
        };

        pollRef.current = setInterval(check, 2500);
        const onVisible = () => { if (document.visibilityState === 'visible') check(); };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', onVisible);
        };
        // NOTE: intentionally omit washProcessed from deps — we use processedRef instead
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qrToken, generatedAt, user.id]);

    const minutesLeft = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const progress = (secondsLeft / QR_EXPIRY_SECONDS) * 100;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4 sm:space-y-5 pb-24 max-w-sm sm:max-w-md mx-auto"
        >
            {/* Header */}
            <Reveal className="px-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 dark:bg-blue-500/10 text-primary dark:text-blue-400 rounded-full text-[10px] font-bold tracking-widest uppercase mb-2 border border-primary/20 dark:border-blue-500/30 transition-colors">
                    <QrCode size={11} /> Pase Digital
                </div>
                <h1 className="font-headline text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white transition-colors uppercase italic tracking-tighter">Mi QR de Lavado</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Presentá tu QR al llegar al lavadero para registrar tu servicio.</p>
            </Reveal>

            {/* ── LOADING reservation ── */}
            {loadingRes ? (
                <Reveal delay={0.06} className="space-y-4">
                    <div className="flex items-center gap-3 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 animate-pulse">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-2/3 bg-slate-100 dark:bg-slate-800 rounded" />
                            <div className="h-2.5 w-1/2 bg-slate-100 dark:bg-slate-800 rounded" />
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm p-10 flex items-center justify-center animate-pulse">
                        <RefreshCw size={28} className="text-slate-300 dark:text-slate-700 animate-spin" />
                    </div>
                </Reveal>
            ) : !nextReservation && !washProcessed ? (
                /* ── NO RESERVATION — blocked state, no QR ──
                   (`washProcessed` manda: al registrarse el lavado la reserva deja de estar
                   pendiente, y sin esta guarda el aviso de éxito lo tapaba este cartel.) */
                <Reveal delay={0.06} variant={scaleIn} className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm p-8 text-center transition-colors">
                    <div className="w-20 h-20 bg-amber-50 dark:bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-5">
                        <CalendarX size={36} className="text-amber-400 dark:text-amber-300" />
                    </div>
                    <h2 className="font-black text-lg text-slate-800 dark:text-slate-100 uppercase tracking-tighter italic mb-1.5">No tenés una reserva activa</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                        Reservá tu turno primero para generar tu QR.
                    </p>
                    <Pressable
                        onClick={() => navigate('/booking')}
                        className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-lg hover:shadow-primary/20 dark:hover:shadow-blue-500/20 transition-colors flex items-center justify-center gap-2.5"
                    >
                        <Calendar size={18} /> Reservar ahora
                    </Pressable>
                </Reveal>
            ) : (
              <>
            {/* Reservation to redeem */}
            {nextReservation && (
            <Reveal delay={0.06} className="flex items-center gap-3 p-4 rounded-2xl border bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 transition-colors">
                <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70">Vas a registrar</p>
                    <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300 truncate">
                        {nextReservation.service?.name || 'Servicio reservado'}
                    </p>
                    {formatResDate(nextReservation.startTime) && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock size={11} className="shrink-0" /> {formatResDate(nextReservation.startTime)}
                        </p>
                    )}
                </div>
                <motion.span
                    variants={popIn}
                    initial="hidden"
                    animate="show"
                    transition={springPop}
                    className="shrink-0"
                >
                    <Star size={15} className="text-secondary" fill="currentColor" />
                </motion.span>
            </Reveal>
            )}

            {/* QR Area */}
            <Reveal delay={0.12} variant={scaleIn} className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors relative">

                {/* How it works */}
                {!washProcessed && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                        <Info size={15} className="text-primary dark:text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            <span className="font-bold text-slate-700 dark:text-slate-200">¿Cómo funciona?</span> Generá tu QR y presentalo al operario del lavadero.
                            Él lo escanea desde su dispositivo y tu lavado se registra automáticamente.
                        </p>
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {washProcessed ? (
                        /* ── WASH PROCESSED — in-place full card success ── */
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.92 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                            className="relative overflow-hidden"
                        >
                            {/* Gradient background */}
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600 opacity-100" />
                            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                            {/* Particles container */}
                            {showParticles && (
                                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                    {Array.from({ length: 18 }).map((_, i) => (
                                        <Particle key={i} delay={i * 0.06} x={(i - 9) * 18} />
                                    ))}
                                </div>
                            )}

                            <div className="relative z-10 text-center px-8 py-10">
                                {/* Animated checkmark */}
                                <motion.div
                                    initial={reduce ? { scale: 1 } : { scale: 0, rotate: -20 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 600, damping: 18, delay: 0.1 }}
                                    className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl border-2 border-white/30 relative"
                                >
                                    {/* Halo pulse around the success badge */}
                                    {!reduce && (
                                        <motion.span
                                            aria-hidden
                                            className="absolute inset-0 rounded-full border-2 border-white/40"
                                            initial={{ scale: 1, opacity: 0.5 }}
                                            animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                                            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
                                        />
                                    )}
                                    <motion.div
                                        animate={reduce ? undefined : { scale: [1, 1.2, 1] }}
                                        transition={reduce ? undefined : { repeat: 2, duration: 0.4, delay: 0.3 }}
                                    >
                                        <CheckCircle2 size={52} className="text-white drop-shadow-lg" />
                                    </motion.div>
                                </motion.div>

                                {/* Title */}
                                <motion.div
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.25em] mb-1">Servicio registrado</p>
                                    <h2 className="text-white font-black text-2xl uppercase italic tracking-tighter leading-tight mb-2">
                                        ¡Lavado<br />confirmado!
                                    </h2>
                                    {washInfo?.serviceName && (
                                        <p className="inline-flex items-center gap-1.5 bg-white/20 border border-white/25 rounded-full px-3.5 py-1.5 text-white text-xs font-black mb-3">
                                            <Droplets size={12} /> {washInfo.serviceName}
                                        </p>
                                    )}
                                    <p className="text-white/80 text-sm font-medium mb-6 leading-relaxed">{funPhrase}</p>
                                </motion.div>

                                {/* Info pill */}
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.35 }}
                                    className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl p-4 text-white/90 text-xs font-medium mb-6 leading-relaxed"
                                >
                                    🧼 Tu historial y contador de lavados fueron actualizados correctamente.
                                </motion.div>

                                {/* CTA button */}
                                <motion.div
                                    initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={reduce ? { duration: 0 } : { delay: 0.45 }}
                                >
                                    <Pressable
                                        onClick={() => { setQrToken(null); setWashProcessed(false); setWashInfo(null); setGeneratedAt(null); setShowParticles(false); }}
                                        className="w-full py-4 bg-white text-emerald-600 font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 size={15} /> Entendido
                                    </Pressable>
                                </motion.div>
                            </div>
                        </motion.div>

                    ) : !qrToken ? (
                        /* ── NO QR YET ── */
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
                            <div className="text-center py-6">
                                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                    <QrCode size={36} className="text-slate-300 dark:text-slate-700" />
                                </div>
                                <p className="text-sm text-slate-400 dark:text-slate-500 mb-6 font-medium leading-relaxed">
                                    Tu código QR aparecerá aquí.<br />Validez: <span className="font-black text-primary dark:text-blue-400">5 minutos</span>.
                                </p>
                                <Pressable
                                    onClick={generateToken}
                                    className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-lg hover:shadow-primary/20 dark:hover:shadow-blue-500/20 transition-colors flex items-center justify-center gap-2.5"
                                >
                                    <Droplets size={18} />
                                    Generar QR de Lavado
                                </Pressable>
                            </div>
                        </motion.div>

                    ) : isExpired ? (
                        /* ── EXPIRED ── */
                        <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
                            <div className="text-center py-6">
                                <div className="w-20 h-20 bg-amber-50 dark:bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                    <Clock size={36} className="text-amber-400 dark:text-amber-300" />
                                </div>
                                <p className="text-base font-black text-slate-800 dark:text-slate-100 mb-1 uppercase tracking-tighter italic">QR Expirado</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">El código venció. Generá uno nuevo para continuar.</p>
                                <Pressable
                                    onClick={generateToken}
                                    className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-lg transition-colors flex items-center justify-center gap-2.5"
                                >
                                    <RefreshCw size={18} /> Generar Nuevo QR
                                </Pressable>
                            </div>
                        </motion.div>

                    ) : (
                        /* ── ACTIVE QR ── */
                        <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="p-6">
                            <div className="text-center">
                                <motion.div
                                    initial={reduce ? { scale: 1, opacity: 0 } : { scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={reduce ? { duration: 0.25 } : springPop}
                                    className="bg-white border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-5 sm:p-6 inline-block mb-4 shadow-xl relative"
                                >
                                    {/* Glow pulse ring around the QR (signals "live / waiting") */}
                                    {!reduce && (
                                        <motion.span
                                            aria-hidden
                                            className="absolute -inset-1 rounded-[2.75rem] border-2 border-primary/40 dark:border-blue-500/40 pointer-events-none"
                                            initial={{ scale: 0.96, opacity: 0.6 }}
                                            animate={{ scale: [0.96, 1.04], opacity: [0.6, 0] }}
                                            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                                        />
                                    )}
                                    {/* El código lleva un token de 82 caracteres. Con corrección "H"
                                        (la máxima) necesitaba 49x49 cuadraditos en 190px: menos de 4
                                        píxeles cada uno, y las cámaras no lo enganchaban. Con "M" son
                                        37x37 en 240px — 6,5 px por cuadradito, casi el doble — y sigue
                                        tolerando de sobra el logo del medio, que tapa apenas el 1,8%. */}
                                    <QRCodeSVG
                                        value={qrToken}
                                        size={240}
                                        bgColor="#ffffff"
                                        fgColor="#0f172a"
                                        level="M"
                                        marginSize={2}
                                        imageSettings={{ src: '/logo.png', height: 32, width: 32, excavate: true }}
                                    />
                                    {/* Scanning indicator */}
                                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-primary dark:bg-blue-500 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] flex items-center gap-2 shadow-xl whitespace-nowrap">
                                        <Sparkles size={10} className="animate-pulse" /> Esperando escaneo...
                                    </div>
                                </motion.div>

                                {/* Timer */}
                                <div className="mt-8 mb-3 px-2">
                                    <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-widest font-black px-1">
                                        <span className="flex items-center gap-1.5"><Clock size={12} /> Expira en</span>
                                        <span className={`${secondsLeft <= 60 ? 'text-red-500 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'} transition-colors`}>
                                            {minutesLeft}:{secs.toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-transparent dark:border-white/5 shadow-inner">
                                        <motion.div
                                            className={`h-full rounded-full ${secondsLeft <= 60 ? 'bg-red-500 dark:bg-red-400' : 'bg-primary dark:bg-blue-500'}`}
                                            animate={{ width: `${progress}%` }}
                                            transition={reduce ? { duration: 0 } : { ...springSoft }}
                                        />
                                    </div>
                                </div>

                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-4 font-bold flex items-center justify-center gap-1.5">
                                    <span className="opacity-50 tracking-widest uppercase">Token ID:</span>
                                    <span className="font-mono text-slate-600 dark:text-slate-400">{qrToken.slice(0, 16).toLowerCase()}...</span>
                                </p>

                                <Pressable tapOnly onClick={generateToken} className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-blue-400 flex items-center gap-2 mx-auto hover:underline transition-colors">
                                    <RefreshCw size={12} /> Forzar Regeneración
                                </Pressable>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Reveal>
              </>
            )}

            {/* Steps */}
            <Reveal delay={0.18} className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm p-6 lg:p-7 transition-colors">
                <h3 className="font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 italic mb-4">Pasos a seguir</h3>
                <StaggerList onView className="space-y-4">
                    {[
                        { n: '1', t: 'Generá tu QR', d: 'Presioná el botón azul de arriba.' },
                        { n: '2', t: 'Mostrá al operario', d: 'Presentá la pantalla al llegar al Garage.' },
                        { n: '3', t: 'Escaneado y listo', d: 'Se registra al instante y verás la pantalla de éxito.' },
                    ].map(s => (
                        <StaggerItem key={s.n} className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-2xl bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-400 text-xs font-black flex items-center justify-center shrink-0 transition-colors shadow-sm">{s.n}</div>
                            <div>
                                <p className="font-black text-xs text-slate-900 dark:text-slate-200">{s.t}</p>
                                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 leading-snug">{s.d}</p>
                            </div>
                        </StaggerItem>
                    ))}
                </StaggerList>
            </Reveal>
        </motion.div>
    );
}
