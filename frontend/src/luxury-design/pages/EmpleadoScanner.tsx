import React, { useState, useRef, useEffect } from 'react';
import { ScanLine, CheckCircle2, XCircle, Camera, Car, RefreshCw, KeyRound, User, History, Droplets, MapPin, Clock } from 'lucide-react';

import api from '../../services/api';

import { Html5Qrcode } from "html5-qrcode";
import {
    motion,
    AnimatePresence,
    Reveal,
    StaggerList,
    StaggerItem,
    AnimatedNumber,
    Pressable,
    popIn,
    scaleIn,
    springPop,
    useVariants,
    useReduce,
} from '../lib/motion';

type ScanResult = {
    success: boolean;
    message: string;
    client?: {
        name: string;
        email: string;
        role: string;
        vehicle?: { model: string; plate: string; color: string };
        totalWashes: number;
        remainingWashes: number | string;
    };
};

export default function EmpleadoScanner({ user }: { user: any }) {
    const [result, setResult] = useState<ScanResult | null>(null);
    // Paso intermedio: a quién pertenece el QR y qué reservas tiene, ANTES de descontarle
    // nada. El lavado se registra recién cuando el empleado elige cuál está atendiendo.
    const [porConfirmar, setPorConfirmar] = useState<any>(null);
    const [tokenEnCurso, setTokenEnCurso] = useState('');
    const [reservaElegida, setReservaElegida] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [scannedCount, setScannedCount] = useState(0);
    const [manualToken, setManualToken] = useState('');
    const [cameraError, setCameraError] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const reduce = useReduce();
    // Resueltas acá arriba a propósito: son hooks, y adentro de un bloque condicional del
    // JSX su cantidad cambia entre renders y React descarta la pantalla.
    const vScaleIn = useVariants(scaleIn);
    const vPopIn = useVariants(popIn);

    useEffect(() => {
        const startScanner = async () => {
            setCameraError(null);

            // Check for Secure Context (HTTPS requirement)
            if (!window.isSecureContext) {
                setCameraError("La cámara requiere una conexión SEGURA (HTTPS) para funcionar en dispositivos móviles.");
                return;
            }

            const html5QrCode = new Html5Qrcode("reader", {
                // Detector de códigos nativo del sistema cuando existe: más rápido y tolerante
                // que el decodificador por software, que es lo que hacía costar la lectura.
                experimentalFeatures: { useBarCodeDetectorIfSupported: true },
                verbose: false,
            } as any);
            scannerRef.current = html5QrCode;

            try {
                await html5QrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 15,
                        // Sin qrbox a propósito: con recuadro, la librería recorta la imagen a esa
                        // región y hay que acertar una distancia justa para que el código entre
                        // entero. Analizando el cuadro completo lee desde cualquier posición.
                        aspectRatio: 1.0,
                    },
                    (decodedText) => {
                        processQR(decodedText);
                        stopScanner();
                    },
                    () => { /* fotograma sin código: es lo normal entre lectura y lectura */ }
                );
            } catch (err: any) {
                console.error("No se pudo iniciar la cámara", err);
                if (err?.name === 'NotAllowedError') {
                    setCameraError("Permiso de cámara denegado. Por favor, habilitalo en la configuración de tu navegador.");
                } else {
                    setCameraError("No se pudo acceder a la cámara. Verificá que no esté siendo usada por otra app.");
                }
            }
        };

        // No reabrir la cámara mientras se está confirmando una reserva ni con el
        // resultado en pantalla: si no, vuelve a leer el mismo QR y se encadenan lecturas.
        if (!result && !porConfirmar) {
            startScanner();
        }

        return () => {
            stopScanner();
        };
    }, [result, porConfirmar]);

    const stopScanner = async () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            try {
                await scannerRef.current.stop();
            } catch (e) {
                console.error("Error stopping scanner", e);
            }
        }
    };

    /** Paso 1 — leer el QR: identifica al cliente y trae sus reservas. NO descuenta nada. */
    const processQR = async (token: string) => {
        if (!token.trim()) return;
        setIsProcessing(true);
        setResult(null);
        try {
            const { data } = await api.post("/luxury/qr/verify", { token: token.trim() });
            const info = data?.data;
            setTokenEnCurso(token.trim());
            setPorConfirmar(info);
            // Con una sola reserva queda preseleccionada, pero igual hay que confirmar.
            setReservaElegida(info?.reservas?.length === 1 ? info.reservas[0].id : null);
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || 'Error de conexión con el servidor.';
            setResult({ success: false, message: errorMsg });
        } finally {
            setIsProcessing(false);
        }
    };

    /** Paso 2 — registrar el lavado de la reserva elegida. Acá recién se descuenta. */
    const confirmarLavado = async () => {
        if (!reservaElegida || !tokenEnCurso) return;
        setIsProcessing(true);
        try {
            const { data } = await api.post("/luxury/qr/scan", {
                token: tokenEnCurso,
                appointmentId: reservaElegida,
                employeeId: user?.id,
            });
            // El backend responde { success, message, data: { client, service, covered } };
            // la vista lee result.client, así que se aplana acá.
            setResult({ ...data, ...(data?.data || {}) });
            if (data.success) setScannedCount(prev => prev + 1);
        } catch (error: any) {
            setResult({ success: false, message: error.response?.data?.message || 'No se pudo registrar el lavado.' });
        } finally {
            setIsProcessing(false);
            setPorConfirmar(null);
            setTokenEnCurso('');
            setReservaElegida(null);
        }
    };

    const cancelarConfirmacion = () => {
        setPorConfirmar(null);
        setTokenEnCurso('');
        setReservaElegida(null);
    };

    const handleManualSubmit = () => {
        processQR(manualToken);
        setManualToken('');
    };

    const reset = () => {
        setResult(null);
        setManualToken('');
        setPorConfirmar(null);
        setTokenEnCurso('');
        setReservaElegida(null);
    };

    return (
        <div className="p-4 flex flex-col items-center pb-24">
            {/* Header */}
            <Reveal className="w-full max-w-sm sm:max-w-md lg:max-w-lg pt-4 pb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 dark:bg-blue-500/20 rounded-xl flex items-center justify-center text-primary dark:text-blue-400">
                        <ScanLine size={20} />
                    </div>
                    <div>
                        <h1 className="font-headline font-black text-lg text-slate-900 dark:text-white transition-colors">Escanear Cliente</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-xs transition-colors">Validar código y registrar lavado</p>
                    </div>
                </div>
            </Reveal>

            <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg space-y-4">
                {/* Scanner Frame */}
                <AnimatePresence mode="wait">
                    {!result && !porConfirmar && (
                        <motion.div
                            key="scanner-frame"
                            variants={vScaleIn}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            className="bg-white dark:bg-slate-900/40 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm transition-colors relative"
                        >
                            <div className="relative h-64 md:h-72 lg:h-80 w-full bg-slate-950 overflow-hidden">
                                <div id="reader" className="w-full h-full object-cover" />

                                {/* Camera Error View */}
                                <AnimatePresence>
                                    {cameraError && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center bg-slate-950/80 backdrop-blur-sm"
                                        >
                                            <motion.div
                                                variants={vPopIn}
                                                initial="hidden"
                                                animate="show"
                                                transition={springPop}
                                                className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20"
                                            >
                                                <XCircle size={32} className="text-red-500" />
                                            </motion.div>
                                            <p className="text-xs font-headline font-black text-white uppercase italic tracking-tight mb-2">ERROR EN CÁMARA</p>
                                            <p className="text-[10px] text-slate-400 leading-relaxed font-bold uppercase tracking-widest">{cameraError}</p>
                                            {!window.isSecureContext && (
                                                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                                    <p className="text-[8px] text-blue-400 font-black uppercase tracking-widest leading-normal">
                                                        Tip: Usá localhost o habilitá HTTPS para acceso remoto.
                                                    </p>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Overlay UI (only show if no error) */}
                                {!cameraError && (
                                    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                                        <div className="w-48 h-48 md:w-56 md:h-56 relative">
                                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary dark:border-blue-400 rounded-tl-xl" />
                                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary dark:border-blue-400 rounded-tr-xl" />
                                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary dark:border-blue-400 rounded-bl-xl" />
                                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary dark:border-blue-400 rounded-br-xl" />
                                            {!reduce && (
                                                <motion.div
                                                    className="absolute left-2 right-2 h-0.5 bg-primary dark:bg-blue-400 shadow-[0_0_15px_rgba(0,64,224,0.5)]"
                                                    animate={{ top: ['10%', '90%', '10%'] }}
                                                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-5 lg:p-6 space-y-3 bg-white dark:bg-slate-900 transition-colors">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 text-center">Ingreso manual de código</p>
                                <textarea
                                    value={manualToken}
                                    onChange={(e) => setManualToken(e.target.value)}
                                    placeholder="Ej: LUXURY-1-16790..."
                                    rows={1}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs p-3 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/10 dark:focus:ring-blue-500/10 resize-none font-mono"
                                />
                                <Pressable
                                    onClick={handleManualSubmit}
                                    disabled={!manualToken.trim() || isProcessing}
                                    className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-40 shadow-lg shadow-primary/20 dark:shadow-blue-500/20"
                                >
                                    {isProcessing ? <RefreshCw size={16} className="animate-spin" /> : <><KeyRound size={16} /> VALIDAR CÓDIGO</>}
                                </Pressable>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>


                {/* ── Elegir qué reserva se está atendiendo ── */}
                <AnimatePresence>
                    {porConfirmar && (
                        <motion.div
                            key="por-confirmar"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 16 }}
                            className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden"
                        >
                            {/* Quién es */}
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-400 flex items-center justify-center font-black text-lg shrink-0">
                                        {porConfirmar.client?.name?.[0] || '?'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-black text-slate-900 dark:text-white truncate">{porConfirmar.client?.name}</p>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                                            {porConfirmar.client?.plan || 'Sin plan'}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Le quedan</p>
                                        <p className="text-xl font-black text-primary dark:text-blue-400 leading-none mt-0.5">
                                            {porConfirmar.client?.remainingWashes === null ? '∞' : porConfirmar.client?.remainingWashes}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 space-y-3">
                                {!porConfirmar.reservas?.length ? (
                                    <div className="text-center py-6">
                                        <XCircle size={30} className="mx-auto text-amber-500 mb-3" />
                                        <p className="font-black text-slate-900 dark:text-white text-sm">Sin reservas pendientes</p>
                                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                            Este cliente no tiene ningún turno reservado. Pedile que lo reserve desde su app.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">
                                            ¿Qué reserva estás atendiendo?
                                        </p>
                                        {(porConfirmar.reservas || []).map((r: any) => {
                                            const elegida = reservaElegida === r.id;
                                            return (
                                                <button
                                                    key={r.id}
                                                    onClick={() => setReservaElegida(r.id)}
                                                    className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${elegida
                                                        ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-500/10'
                                                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                            <Droplets size={16} className="text-primary dark:text-blue-400" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{r.servicio}</p>
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                                {new Date(r.cuando).toLocaleString('es-PY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                                {r.vehiculo ? ` · ${r.vehiculo}` : ''}
                                                            </p>
                                                            <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${r.cubierto ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                                {r.cubierto ? 'Cubierto por su plan' : 'Ya abonado aparte'}
                                                            </p>
                                                        </div>
                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${elegida
                                                            ? 'border-primary dark:border-blue-500 bg-primary dark:bg-blue-500'
                                                            : 'border-slate-300 dark:border-slate-600'}`}>
                                                            {elegida && <CheckCircle2 size={11} className="text-white" />}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </>
                                )}

                                <div className="flex gap-2 pt-1">
                                    <Pressable
                                        onClick={cancelarConfirmacion}
                                        className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black uppercase tracking-widest text-xs"
                                    >
                                        Cancelar
                                    </Pressable>
                                    {porConfirmar.reservas?.length > 0 && (
                                        <Pressable
                                            onClick={confirmarLavado}
                                            disabled={!reservaElegida || isProcessing}
                                            className="flex-[2] py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-emerald-600/20"
                                        >
                                            {isProcessing ? <RefreshCw size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Registrar lavado</>}
                                        </Pressable>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Scanned Result */}
                <AnimatePresence>
                    {result && (
                        <motion.div
                            variants={vScaleIn}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            className={`rounded-[2.5rem] border p-6 lg:p-8 shadow-2xl transition-colors ${result.success
                                ? 'bg-white dark:bg-slate-900 border-emerald-500/30'
                                : 'bg-white dark:bg-slate-900 border-red-500/30'
                                }`}
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <motion.div
                                    variants={vPopIn}
                                    initial="hidden"
                                    animate="show"
                                    transition={springPop}
                                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${result.success ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                                    }`}>
                                    {result.success ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
                                </motion.div>
                                <div>
                                    <p className={`font-black tracking-tight text-lg italic ${result.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                        {result.success ? 'QR DE LAVADO ESCANEADO EXITOSAMENTE' : 'ERROR EN VALIDACIÓN'}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        {result.message}
                                    </p>
                                </div>
                            </div>

                            {result.success && result.client && (
                                <div className="space-y-4">
                                    {/* Client info */}
                                    <Reveal delay={0.08}>
                                        <div className="p-4 lg:p-5 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 bg-primary dark:bg-blue-600 rounded-full flex items-center justify-center font-black text-white text-sm shadow-sm">
                                                    {result.client.name[0]}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{result.client.name}</p>
                                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{result.client.role}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                                                <div className="text-center">
                                                    <AnimatedNumber value={result.client.totalWashes} className="block text-xl lg:text-2xl font-black text-slate-900 dark:text-white leading-none" />
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Acumulados</p>
                                                </div>
                                                <div className="text-center border-l border-slate-100 dark:border-slate-700">
                                                    {typeof result.client.remainingWashes === 'number' ? (
                                                        <AnimatedNumber value={result.client.remainingWashes} className="block text-xl lg:text-2xl font-black text-primary dark:text-blue-400 leading-none" />
                                                    ) : (
                                                        <p className="text-xl lg:text-2xl font-black text-primary dark:text-blue-400 leading-none" title="Plan ilimitado">∞</p>
                                                    )}
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Disponibles</p>
                                                </div>
                                            </div>
                                        </div>
                                    </Reveal>

                                    {/* Counter notification inside success screen */}
                                    <AnimatePresence>
                                        {result.success && scannedCount > 0 && (
                                            <motion.div
                                                variants={vPopIn}
                                                initial="hidden"
                                                animate="show"
                                                exit="exit"
                                                transition={springPop}
                                                className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl flex items-center justify-center gap-2 mb-4"
                                            >
                                                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                                                <span className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider text-center">
                                                    Ya llevas escaneados {scannedCount} {scannedCount === 1 ? 'cliente' : 'clientes'}
                                                </span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Vehicle details */}
                                    {result.client.vehicle && (
                                        <Reveal delay={0.14}>
                                            <div className="p-4 bg-slate-900 rounded-[2rem] text-white relative overflow-hidden border border-white/5">
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
                                                <div className="flex items-center gap-3 mb-1">
                                                    <Car size={16} className="text-primary dark:text-blue-400" />
                                                    <span className="font-black italic text-sm tracking-tight">{result.client.vehicle.model}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] font-bold text-white/50 bg-white/5 px-3 py-2 rounded-xl mt-2">
                                                    <span className="text-white/80">{result.client.vehicle.plate || 'Sin patente'}</span>
                                                    <span className="opacity-30">|</span>
                                                    <span>{result.client.vehicle.color}</span>
                                                </div>
                                            </div>
                                        </Reveal>
                                    )}

                                    {/* Scan Details */}
                                    <StaggerList className="grid grid-cols-2 gap-2 mt-4">
                                        <StaggerItem>
                                            <DetailItem icon={<MapPin size={11} />} label="Lugar" value="Luxury HQ" />
                                        </StaggerItem>
                                        <StaggerItem>
                                            <DetailItem icon={<Clock size={11} />} label="Hora" value={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                                        </StaggerItem>
                                    </StaggerList>

                                    <Pressable
                                        onClick={reset}
                                        className="w-full py-4 mt-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl"
                                    >
                                        TERMINAR Y VOLVER
                                    </Pressable>
                                </div>
                            )}

                            {!result.success && (
                                <Pressable
                                    onClick={reset}
                                    className="w-full py-4 mt-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px]"
                                >
                                    REINTENTAR ESCANEO
                                </Pressable>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function DetailItem({ icon, label, value }: any) {
    return (
        <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 transition-colors">
            <span className="text-primary dark:text-blue-400">{icon}</span>
            <div className="min-w-0">
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-[0.1em]">{label}</p>
                <p className="text-[10px] font-bold text-slate-900 dark:text-slate-200 truncate">{value}</p>
            </div>
        </div>
    );
}
