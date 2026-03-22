import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, ShieldCheck, RefreshCw, Clock, AlertTriangle, Droplets, Star, Info, CheckCircle2, Sparkles } from 'lucide-react';
import api from '../../services/api';

interface QRPassProps {
    user: any;
}

const QR_EXPIRY_SECONDS = 300;

const FUN_PHRASES = [
    '¡Tu carrazo queda impecable! 🚗✨',
    '¡Brilla más que el sol! ☀️',
    '¡El auto más lindo del día! 🏆',
    '¡Servicio premium activado! 🎖️',
    '¡Un lujo sobre ruedas! 💎',
    '¡El lavadero ya sabe qué hacer! 🧼',
];


export default function QRPass({ user }: QRPassProps) {
    const [qrToken, setQrToken] = useState<string | null>(null);
    const [generatedAt, setGeneratedAt] = useState<number | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(QR_EXPIRY_SECONDS);
    const [isExpired, setIsExpired] = useState(false);
    const [washProcessed, setWashProcessed] = useState(false);
    const [funPhrase] = useState(() => FUN_PHRASES[Math.floor(Math.random() * FUN_PHRASES.length)]);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isActive = user?.membership_status === 'Activa';

    const generateToken = () => {
        const ts = Date.now();
        const token = `LUXURY-${user.id}-${ts}`;
        setQrToken(token);
        setGeneratedAt(ts);
        setSecondsLeft(QR_EXPIRY_SECONDS);
        setIsExpired(false);
        setWashProcessed(false);
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

    // Poll backend every 3s to detect if employee scanned the QR
    useEffect(() => {
        if (!qrToken || isExpired || washProcessed || !generatedAt) return;

        pollRef.current = setInterval(async () => {
            try {
                const res = await api.get(`/luxury/latest-wash?since=${generatedAt}`);
                if (res.data.found) {
                    setWashProcessed(true);
                    if (pollRef.current) clearInterval(pollRef.current);
                }
            } catch (_) { }
        }, 3000);

        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [qrToken, isExpired, washProcessed, generatedAt]);


    const minutesLeft = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const progress = (secondsLeft / QR_EXPIRY_SECONDS) * 100;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4 pb-24 max-w-sm mx-auto"
        >
            {/* Header */}
            <div className="px-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 dark:bg-blue-500/10 text-primary dark:text-blue-400 rounded-full text-[10px] font-bold tracking-widest uppercase mb-2 border border-primary/20 dark:border-blue-500/30 transition-colors">
                    <QrCode size={11} /> Pase Digital
                </div>
                <h1 className="font-headline text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white transition-colors uppercase italic tracking-tighter">Mi QR de Lavado</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Presentá tu QR al llegar al lavadero para registrar tu servicio.</p>
            </div>

            {/* Membership Status */}
            <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${isActive ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20'}`}>
                {isActive
                    ? <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    : <AlertTriangle size={20} className="text-red-500 dark:text-red-400 shrink-0" />
                }
                <div className="flex-1">
                    <p className={`font-bold text-sm ${isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>
                        Membresía {isActive ? 'Activa ✓' : 'Inactiva'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isActive ? `Plan ${user?.role} — Lavados disponibles` : 'Renová tu plan para generar QR'}
                    </p>
                </div>
                <Star size={15} className="text-secondary" fill="currentColor" />
            </div>

            {/* QR Area */}
            <div className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">

                {/* How it works */}
                <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                    <Info size={15} className="text-primary dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        <span className="font-bold text-slate-700 dark:text-slate-200">¿Cómo funciona?</span> Generá tu QR y presentalo al operario del lavadero.
                        Él lo escanea desde su dispositivo y tu lavado se registra automáticamente.
                    </p>
                </div>

                <div className="p-6">
                    {/* ── WASH PROCESSED ─────────────────────── */}
                    {washProcessed ? (
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center py-4"
                        >
                            <motion.div
                                animate={{ scale: [1, 1.15, 1] }}
                                transition={{ repeat: 2, duration: 0.4 }}
                                className="w-24 h-24 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-100/20 dark:shadow-emerald-500/10"
                            >
                                <CheckCircle2 size={48} className="text-emerald-600 dark:text-emerald-400" />
                            </motion.div>
                            <h2 className="font-headline text-2xl font-black text-slate-900 dark:text-white mb-1 uppercase tracking-tighter italic">¡Lavado Procesado!</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{funPhrase}</p>
                            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl p-3 text-xs text-emerald-700 dark:text-emerald-400 font-medium font-headline uppercase italic">
                                Tu historial fue actualizado. 🧼
                            </div>
                            <button
                                onClick={() => { setQrToken(null); setWashProcessed(false); setGeneratedAt(null); }}
                                className="mt-4 text-[10px] font-black tracking-widest uppercase text-primary dark:text-blue-400 flex items-center gap-1.5 mx-auto hover:underline"
                            >
                                <RefreshCw size={12} /> Generar otro QR
                            </button>
                        </motion.div>

                    ) : !qrToken ? (
                        /* ── NO QR YET ─────────────────────── */
                        <div className="text-center py-6">
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                <QrCode size={36} className="text-slate-300 dark:text-slate-700" />
                            </div>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mb-6 font-medium leading-relaxed">
                                Tu código QR aparecerá aquí.<br />Validez: <span className="font-black text-primary dark:text-blue-400">5 minutos</span>.
                            </p>
                            <button
                                onClick={generateToken}
                                disabled={!isActive}
                                className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-lg hover:shadow-primary/20 dark:hover:shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
                            >
                                <Droplets size={18} />
                                {isActive ? 'Generar QR de Lavado' : 'Membresía Inactiva'}
                            </button>
                        </div>

                    ) : isExpired ? (
                        /* ── EXPIRED ─────────────────────── */
                        <div className="text-center py-6">
                            <div className="w-20 h-20 bg-amber-50 dark:bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                <Clock size={36} className="text-amber-400 dark:text-amber-300" />
                            </div>
                            <p className="text-base font-black text-slate-800 dark:text-slate-100 mb-1 uppercase tracking-tighter italic">QR Expirado</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">El código venció. Generá uno nuevo para continuar.</p>
                            <button
                                onClick={generateToken}
                                className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2.5"
                            >
                                <RefreshCw size={18} /> Generar Nuevo QR
                            </button>
                        </div>

                    ) : (
                        /* ── ACTIVE QR ─────────────────────── */
                        <div className="text-center">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="bg-white border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-5 inline-block mb-4 shadow-xl relative"
                            >
                                <QRCodeSVG value={qrToken} size={190} bgColor="#ffffff" fgColor="#0f172a" level="M" />
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
                                        style={{ width: `${progress}%` }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                            </div>

                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-4 font-bold flex items-center justify-center gap-1.5">
                                <span className="opacity-50 tracking-widest uppercase">Token ID:</span>
                                <span className="font-mono text-slate-600 dark:text-slate-400">{qrToken.slice(0, 16).toLowerCase()}...</span>
                            </p>

                            <button onClick={generateToken} className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-blue-400 flex items-center gap-2 mx-auto hover:underline active:opacity-70 transition-all">
                                <RefreshCw size={12} /> Forzar Regeneración
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Steps */}
            <div className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-4 transition-colors">
                <h3 className="font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 italic">Pasos a seguir</h3>
                {[
                    { n: '1', t: 'Generá tu QR', d: 'Presioná el botón azul de arriba.' },
                    { n: '2', t: 'Mostrá al operario', d: 'Presentá la pantalla al llegar al Garage.' },
                    { n: '3', t: 'Escaneado y listo', d: 'Se registra al instante y verás la pantalla de éxito.' },
                ].map(s => (
                    <div key={s.n} className="flex items-start gap-4">
                        <div className="w-8 h-8 rounded-2xl bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-400 text-xs font-black flex items-center justify-center shrink-0 transition-colors shadow-sm">{s.n}</div>
                        <div>
                            <p className="font-black text-xs text-slate-900 dark:text-slate-200">{s.t}</p>
                            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 leading-snug">{s.d}</p>
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
