import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
    ScanLine, CheckCircle2, XCircle, RefreshCw, KeyRound, Wallet, CreditCard,
    Plus, Minus, ShoppingBag, AlertTriangle, Loader2, Receipt,
} from 'lucide-react';
import api from '../../services/api';
import {
    motion, AnimatePresence, Reveal, Pressable,
    popIn, scaleIn, springPop, useVariants, useReduce,
} from '../lib/motion';

/**
 * Módulo Ventas: el operario escanea el QR de compra, verifica contra lo que el cliente lleva
 * en la mano y cobra.
 *
 * Escanear NO cobra: primero se ve el pedido con las fotos de cada producto, se ajusta si el
 * cliente cambió de idea, y recién ahí se aprieta un solo botón. El operario nunca escribe un
 * monto ni toca la tarjeta del cliente.
 */

const gs = (n: number) => `₲ ${(n || 0).toLocaleString('es-PY')}`;

export default function EmpleadoVentas({ user }: { user: any }) {
    const [pedido, setPedido] = useState<any | null>(null);
    const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string; pedido?: any } | null>(null);
    const [procesando, setProcesando] = useState(false);
    const [esperando3ds, setEsperando3ds] = useState(false);
    const [codigoManual, setCodigoManual] = useState('');
    const [errorCamara, setErrorCamara] = useState<string | null>(null);
    const [resumen, setResumen] = useState<{ totalGs: number; count: number } | null>(null);

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const reduce = useReduce();
    const vScaleIn = useVariants(scaleIn);
    const vPopIn = useVariants(popIn);

    const detenerCamara = useCallback(async () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            try { await scannerRef.current.stop(); } catch (_) { /* ya estaba detenida */ }
        }
    }, []);

    // ── Cámara ────────────────────────────────────────────────────────────────
    useEffect(() => {
        const arrancar = async () => {
            setErrorCamara(null);
            if (!window.isSecureContext) {
                setErrorCamara('La cámara necesita una conexión segura (HTTPS).');
                return;
            }
            const lector = new Html5Qrcode('reader-ventas', {
                experimentalFeatures: { useBarCodeDetectorIfSupported: true }, verbose: false,
            } as any);
            scannerRef.current = lector;
            try {
                await lector.start(
                    { facingMode: 'environment' },
                    { fps: 15, aspectRatio: 1.0 },
                    (texto) => { leerQR(texto); detenerCamara(); },
                    () => { /* fotograma sin código */ },
                );
            } catch (err: any) {
                setErrorCamara(err?.name === 'NotAllowedError'
                    ? 'Permiso de cámara denegado. Habilitalo en el navegador.'
                    : 'No se pudo abrir la cámara.');
            }
        };
        if (!pedido && !resultado) arrancar();
        return () => { detenerCamara(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pedido, resultado]);

    useEffect(() => {
        api.get('/sales/today', { _noCache: true } as any)
            .then((r) => setResumen({ totalGs: r.data?.data?.totalGs || 0, count: r.data?.data?.count || 0 }))
            .catch(() => { });
    }, [resultado]);

    // ── Paso 1: leer el QR (no cobra) ─────────────────────────────────────────
    const leerQR = async (token: string) => {
        if (!token.trim()) return;
        setProcesando(true);
        setResultado(null);
        try {
            const { data } = await api.post('/sales/verify', { token: token.trim() });
            setPedido(data?.data || null);
        } catch (e: any) {
            setResultado({ ok: false, mensaje: e?.response?.data?.message || 'No se pudo leer el código.' });
        } finally {
            setProcesando(false);
        }
    };

    // ── Ajuste de cantidades: lo que el cliente realmente se lleva ─────────────
    const ajustar = async (itemId: string, delta: number) => {
        if (!pedido) return;
        const items = pedido.items
            .map((i: any) => ({ itemId: i.itemId, qty: i.itemId === itemId ? i.qty + delta : i.qty }))
            .filter((i: any) => i.qty > 0);
        if (!items.length) return;
        setProcesando(true);
        try {
            const { data } = await api.patch(`/sales/orders/${pedido.orderId}/items`, { items });
            setPedido(data?.data || pedido);
        } catch (e: any) {
            setResultado({ ok: false, mensaje: e?.response?.data?.message || 'No se pudo ajustar el pedido.' });
        } finally {
            setProcesando(false);
        }
    };

    // ── Paso 2: cobrar ────────────────────────────────────────────────────────
    const cobrar = async () => {
        if (!pedido) return;
        setProcesando(true);
        try {
            const { data } = await api.post(`/sales/orders/${pedido.orderId}/charge`, {});
            if (data?.requires3ds) {
                // El banco pide verificación: la resuelve el cliente en SU teléfono. Acá se espera.
                setEsperando3ds(true);
                setProcesando(false);
                return;
            }
            setResultado({ ok: true, mensaje: data?.message || 'Cobrado', pedido: data?.data });
            setPedido(null);
        } catch (e: any) {
            setResultado({ ok: false, mensaje: e?.response?.data?.message || 'No se pudo cobrar.' });
            setPedido(null);
        } finally {
            setProcesando(false);
        }
    };

    // Mientras el cliente resuelve el 3DS, se consulta el estado del pedido.
    useEffect(() => {
        if (!esperando3ds || !pedido?.orderId) return;
        const i = setInterval(async () => {
            try {
                const { data } = await api.get(`/sales/orders/${pedido.orderId}`, { _noCache: true } as any);
                const p = data?.data;
                if (p?.status === 'PAID') {
                    setEsperando3ds(false);
                    setResultado({ ok: true, mensaje: 'Cobrado a la tarjeta del cliente', pedido: p });
                    setPedido(null);
                } else if (p?.status === 'DECLINED') {
                    setEsperando3ds(false);
                    setResultado({ ok: false, mensaje: 'El banco rechazó el cobro.' });
                    setPedido(null);
                }
            } catch (_) { /* se reintenta en el próximo tick */ }
        }, 2500);
        return () => clearInterval(i);
    }, [esperando3ds, pedido?.orderId]);

    const reiniciar = () => {
        setPedido(null); setResultado(null); setCodigoManual(''); setEsperando3ds(false);
    };

    return (
        <div className="p-4 flex flex-col items-center pb-24">
            <Reveal className="w-full max-w-sm sm:max-w-md lg:max-w-lg pt-4 pb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <Receipt size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="font-headline font-black text-lg text-slate-900 dark:text-white">Ventas</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-xs">Escaneá el QR de compra del cliente</p>
                    </div>
                    {resumen && resumen.count > 0 && (
                        <div className="text-right shrink-0">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Hoy</p>
                            <p className="font-black text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">{gs(resumen.totalGs)}</p>
                        </div>
                    )}
                </div>
            </Reveal>

            <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg space-y-4">
                {/* Cámara */}
                <AnimatePresence mode="wait">
                    {!pedido && !resultado && (
                        <motion.div key="camara" variants={vScaleIn} initial="hidden" animate="show" exit="exit"
                            className="bg-white dark:bg-slate-900/40 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-800">
                            <div className="relative h-64 md:h-72 w-full bg-slate-950 overflow-hidden">
                                <div id="reader-ventas" className="w-full h-full object-cover" />
                                {errorCamara && (
                                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center bg-slate-950/85">
                                        <XCircle size={30} className="text-red-500 mb-3" />
                                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed">{errorCamara}</p>
                                    </div>
                                )}
                                {!errorCamara && (
                                    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                                        <div className="w-48 h-48 relative">
                                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                                            {!reduce && (
                                                <motion.div className="absolute left-2 right-2 h-0.5 bg-emerald-400"
                                                    animate={{ top: ['10%', '90%', '10%'] }}
                                                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-5 space-y-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ingreso manual del código</p>
                                <textarea
                                    value={codigoManual}
                                    onChange={(e) => setCodigoManual(e.target.value)}
                                    placeholder="LGSHOP-..."
                                    rows={1}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs p-3 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                                <Pressable
                                    onClick={() => { leerQR(codigoManual); setCodigoManual(''); }}
                                    disabled={!codigoManual.trim() || procesando}
                                    className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-40"
                                >
                                    {procesando ? <RefreshCw size={16} className="animate-spin" /> : <><KeyRound size={16} /> Buscar pedido</>}
                                </Pressable>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Verificación del pedido */}
                <AnimatePresence>
                    {pedido && (
                        <motion.div key="verificar" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
                            className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden">

                            <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-lg shrink-0">
                                    {pedido.client?.name?.[0] || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-slate-900 dark:text-white truncate">{pedido.client?.name}</p>
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Verificá lo que lleva</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Total</p>
                                    <p className="text-xl font-black text-slate-900 dark:text-white leading-none mt-0.5 tabular-nums">{gs(pedido.totalGs)}</p>
                                </div>
                            </div>

                            {/* Productos con foto: es lo que se compara contra la mano del cliente */}
                            <div className="p-4 space-y-2.5 max-h-[46vh] overflow-y-auto">
                                {pedido.items.map((i: any) => (
                                    <div key={i.itemId} className="flex items-center gap-3 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 overflow-hidden shrink-0">
                                            {i.imageUrl
                                                ? <img src={i.imageUrl} alt="" className="w-full h-full object-cover" />
                                                : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={20} className="text-slate-300 dark:text-slate-600" /></div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{i.name}</p>
                                            <p className="text-[11px] text-slate-400 tabular-nums">{gs(i.unitPriceGs)} c/u</p>
                                            {i.sinStock && (
                                                <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                                                    <AlertTriangle size={10} /> Quedan {i.stockActual}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button onClick={() => ajustar(i.itemId, -1)} disabled={procesando} aria-label="Quitar uno"
                                                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-40">
                                                <Minus size={14} />
                                            </button>
                                            <span className="w-6 text-center font-black text-base text-slate-900 dark:text-white tabular-nums">{i.qty}</span>
                                            <button onClick={() => ajustar(i.itemId, 1)} disabled={procesando} aria-label="Agregar uno"
                                                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-40">
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Medio de pago que eligió el cliente */}
                            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                                {pedido.payment?.method === 'wallet' ? (
                                    <>
                                        <Wallet size={16} className="text-primary dark:text-blue-400 shrink-0" />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Paga con su billetera</span>
                                        <span className={`ml-auto text-xs font-black tabular-nums ${pedido.payment.walletAlcanza ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                            {pedido.payment.walletAlcanza ? gs(pedido.payment.walletBalanceGs) : 'Saldo insuficiente'}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <CreditCard size={16} className="text-primary dark:text-blue-400 shrink-0" />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                            {pedido.payment?.card ? `${pedido.payment.card.brand} ${pedido.payment.card.maskedNumber}` : 'Tarjeta registrada'}
                                        </span>
                                    </>
                                )}
                            </div>

                            <div className="p-5 pt-3 flex gap-2">
                                <Pressable onClick={reiniciar} disabled={procesando || esperando3ds}
                                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black uppercase tracking-widest text-xs disabled:opacity-40">
                                    Cancelar
                                </Pressable>
                                <Pressable onClick={cobrar} disabled={procesando || esperando3ds || (pedido.payment?.method === 'wallet' && !pedido.payment?.walletAlcanza)}
                                    className="flex-[2] py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-emerald-600/20">
                                    {procesando ? <RefreshCw size={16} className="animate-spin" />
                                        : esperando3ds ? <><Loader2 size={16} className="animate-spin" /> Esperando al cliente</>
                                            : <><CheckCircle2 size={16} /> Cobrar {gs(pedido.totalGs)}</>}
                                </Pressable>
                            </div>

                            {esperando3ds && (
                                <div className="px-5 pb-5 -mt-2">
                                    <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
                                        <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-relaxed">
                                            El banco pidió verificación. El cliente tiene que confirmarla en su teléfono; esta pantalla se actualiza sola.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Resultado */}
                <AnimatePresence>
                    {resultado && (
                        <motion.div variants={vScaleIn} initial="hidden" animate="show" exit="exit"
                            className={`rounded-[2.5rem] border p-7 shadow-2xl bg-white dark:bg-slate-900 ${resultado.ok ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
                            <div className="text-center">
                                <motion.div variants={vPopIn} initial="hidden" animate="show" transition={springPop}
                                    className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 ${resultado.ok ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'}`}>
                                    {resultado.ok ? <CheckCircle2 size={34} /> : <XCircle size={34} />}
                                </motion.div>
                                <p className={`font-black text-lg italic tracking-tight uppercase ${resultado.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                    {resultado.ok ? 'Pago confirmado' : 'No se pudo cobrar'}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{resultado.mensaje}</p>

                                {resultado.ok && resultado.pedido && (
                                    <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800 rounded-3xl text-left space-y-1.5">
                                        {resultado.pedido.items?.map((i: any) => (
                                            <div key={i.itemId} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                                                <span>{i.qty}× {i.name}</span>
                                                <span className="tabular-nums font-semibold">{gs(i.lineTotalGs)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between pt-2 mt-1 border-t border-slate-200 dark:border-slate-700 text-sm font-black text-slate-900 dark:text-white">
                                            <span>Total</span><span className="tabular-nums">{gs(resultado.pedido.totalGs)}</span>
                                        </div>
                                    </div>
                                )}

                                <Pressable onClick={reiniciar}
                                    className="w-full py-4 mt-5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                                    <ScanLine size={14} /> Escanear otro
                                </Pressable>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
