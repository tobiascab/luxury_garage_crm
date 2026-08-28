import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
    Search, ShoppingCart, Plus, Minus, Trash2, X, Wallet, CreditCard, QrCode,
    CheckCircle2, Clock, PackageX, Loader2, AlertCircle, ShoppingBag, ArrowLeft,
} from 'lucide-react';
import api from '../../services/api';
import { useBancard3ds } from '../components/Bancard3dsModal';
import { loadBancardScript } from '../lib/bancardPayment';
import {
    motion, AnimatePresence, Reveal, StaggerList, StaggerItem,
    Pressable, scaleIn, popIn, springPop, useReduce,
} from '../lib/motion';

/**
 * Tienda de mostrador. El cliente arma su pedido, elige con qué paga y genera un QR; el
 * encargado lo escanea y cobra. Esta pantalla tiene dos modos y nunca los mezcla:
 *   catálogo → mientras arma el carrito,
 *   pedido   → cuando ya hay un QR vivo, que se actualiza solo hasta quedar pagado.
 */

const gs = (n: number) => `₲ ${(n || 0).toLocaleString('es-PY')}`;

interface Producto {
    id: string; name: string; brand?: string; category: string;
    priceGs: number; imageUrl?: string | null; unit: string; stock: number; available: boolean;
}

export default function Tienda({ user, onUpdate }: { user: any; onUpdate?: () => void }) {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [categorias, setCategorias] = useState<string[]>([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [categoria, setCategoria] = useState('todos');
    const [carrito, setCarrito] = useState<Record<string, number>>({});
    const [carritoAbierto, setCarritoAbierto] = useState(false);
    const [medioPago, setMedioPago] = useState<'wallet' | 'card'>('card');
    const [tarjetaId, setTarjetaId] = useState<string | null>(null);
    const [opciones, setOpciones] = useState<{ walletBalanceGs: number; cards: any[] } | null>(null);
    const [pedido, setPedido] = useState<any | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reduce = useReduce();
    const { handlers: bancard3ds, modal: modal3ds } = useBancard3ds();
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const desafioRef = useRef(false); // el 3DS se monta una sola vez por pedido

    // ── Carga inicial: catálogo, medios de pago y pedido vivo ──────────────────
    useEffect(() => {
        let vivo = true;
        (async () => {
            try {
                const [prods, ops, actual] = await Promise.all([
                    api.get('/shop/products', { _noCache: true } as any),
                    api.get('/shop/payment-options', { _noCache: true } as any),
                    api.get('/shop/orders/current', { _noCache: true } as any),
                ]);
                if (!vivo) return;
                setProductos(prods.data?.data || []);
                setCategorias(prods.data?.categories || []);
                setOpciones(ops.data?.data || null);
                const cards = ops.data?.data?.cards || [];
                const principal = cards.find((c: any) => c.isPrimary) || cards[0];
                setTarjetaId(principal?.id || null);
                if (!cards.length && (ops.data?.data?.walletBalanceGs || 0) > 0) setMedioPago('wallet');
                setPedido(actual.data?.data || null);
            } catch (_) {
                if (vivo) setError('No se pudo cargar la tienda. Probá de nuevo.');
            } finally {
                if (vivo) setCargando(false);
            }
        })();
        return () => { vivo = false; };
    }, [user?.id]);

    // Búsqueda en el servidor cuando hay texto; el filtro por categoría es local para que
    // tocar una categoría se sienta instantáneo.
    useEffect(() => {
        if (!busqueda.trim()) return;
        const t = setTimeout(async () => {
            try {
                const r = await api.get(`/shop/products?q=${encodeURIComponent(busqueda.trim())}`, { _noCache: true } as any);
                setProductos(r.data?.data || []);
            } catch (_) { /* se conserva lo que ya estaba en pantalla */ }
        }, 280);
        return () => clearTimeout(t);
    }, [busqueda]);

    const visibles = useMemo(
        () => productos.filter((p) => categoria === 'todos' || p.category === categoria),
        [productos, categoria],
    );

    const lineas = useMemo(
        () => Object.entries(carrito)
            .map(([id, qty]) => ({ producto: productos.find((p) => p.id === id), qty }))
            .filter((l) => l.producto) as { producto: Producto; qty: number }[],
        [carrito, productos],
    );
    const total = lineas.reduce((s, l) => s + l.producto.priceGs * l.qty, 0);
    const unidades = lineas.reduce((s, l) => s + l.qty, 0);

    const sumar = (p: Producto, delta: number) => {
        setError(null);
        setCarrito((prev) => {
            const actual = prev[p.id] || 0;
            const nuevo = Math.max(0, Math.min(actual + delta, p.stock));
            const copia = { ...prev };
            if (nuevo === 0) delete copia[p.id]; else copia[p.id] = nuevo;
            return copia;
        });
    };

    // ── Seguimiento del pedido ─────────────────────────────────────────────────
    // Mientras el QR está vivo se consulta el estado cada 2,5 s, y también al volver a la app:
    // en el celular los timers se congelan con la pantalla apagada.
    const refrescarPedido = useCallback(async (id: string) => {
        try {
            const r = await api.get(`/shop/orders/${id}`, { _noCache: true } as any);
            const p = r.data?.data;
            if (p) setPedido(p);
            if (p?.status === 'PAID') { onUpdate?.(); }
            return p;
        } catch (_) { return null; }
    }, [onUpdate]);

    useEffect(() => {
        if (!pedido?.id) return;
        const vivo = ['PENDING', 'SCANNED', 'AUTHORIZING'].includes(pedido.status);
        if (!vivo) { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } return; }

        const tick = () => refrescarPedido(pedido.id);
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(tick, 2500);
        const alVolver = () => { if (document.visibilityState === 'visible') tick(); };
        document.addEventListener('visibilitychange', alVolver);
        return () => {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            document.removeEventListener('visibilitychange', alVolver);
        };
    }, [pedido?.id, pedido?.status, refrescarPedido]);

    // El banco pidió verificación: el desafío se resuelve ACÁ, en el teléfono del cliente,
    // mientras el encargado espera. Al terminar se le pregunta al backend cómo salió.
    useEffect(() => {
        if (pedido?.status !== 'AUTHORIZING' || !pedido?.threeDs || desafioRef.current) return;
        desafioRef.current = true;
        (async () => {
            const { processId, jsLibUrl } = pedido.threeDs;
            try {
                const sdk = await loadBancardScript(jsLibUrl);
                const containerId = await bancard3ds.mount({ processId, shopProcessId: 0 });
                if (sdk.Charge && typeof sdk.Charge.createForm === 'function') {
                    sdk.Charge.createForm(containerId, String(processId));
                } else if (sdk.Cards && typeof sdk.Cards.createForm === 'function') {
                    sdk.Cards.createForm(containerId, String(processId));
                }
                await bancard3ds.waitForDone();
            } catch (e) {
                console.error('3DS de la compra falló', e);
            } finally {
                bancard3ds.cleanup?.();
            }
            try {
                const r = await api.post(`/shop/orders/${pedido.id}/refresh`, {});
                if (r.data?.data) setPedido(r.data.data);
            } catch (_) { /* el polling lo resuelve igual */ }
            desafioRef.current = false;
        })();
    }, [pedido?.status, pedido?.threeDs, pedido?.id, bancard3ds]);

    // ── Acciones ───────────────────────────────────────────────────────────────
    const generarQR = async () => {
        if (!lineas.length) return;
        setEnviando(true);
        setError(null);
        try {
            const r = await api.post('/shop/orders', {
                items: lineas.map((l) => ({ itemId: l.producto.id, qty: l.qty })),
                paymentMethod: medioPago,
                cardId: medioPago === 'card' ? tarjetaId : undefined,
            });
            setPedido(r.data?.data || null);
            setCarrito({});
            setCarritoAbierto(false);
            api.invalidate?.('/shop/');
        } catch (e: any) {
            setError(e?.response?.data?.message || 'No se pudo generar tu QR de compra.');
        } finally {
            setEnviando(false);
        }
    };

    const cancelarPedido = async () => {
        if (!pedido?.id) return;
        try {
            const r = await api.post(`/shop/orders/${pedido.id}/cancel`, {});
            setPedido(r.data?.data || null);
            setTimeout(() => setPedido(null), 400);
        } catch (e: any) {
            setError(e?.response?.data?.message || 'No se pudo cancelar el pedido.');
        }
    };

    const volverAlCatalogo = () => { setPedido(null); setError(null); };

    // ═══════════════════════════════════════════════════════════════════════════
    if (cargando) {
        return (
            <div className="space-y-4 pb-28 max-w-2xl mx-auto">
                <div className="h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-44 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    // ── MODO PEDIDO: el QR y su estado ─────────────────────────────────────────
    if (pedido) {
        return (
            <>
                {modal3ds}
                <EstadoPedido
                    pedido={pedido}
                    reduce={reduce}
                    onCancelar={cancelarPedido}
                    onVolver={volverAlCatalogo}
                    onReintentar={() => { setCarrito(Object.fromEntries(pedido.items.map((i: any) => [i.itemId, i.qty]))); setPedido(null); }}
                />
            </>
        );
    }

    // ── MODO CATÁLOGO ──────────────────────────────────────────────────────────
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pb-28 max-w-2xl mx-auto">
            {modal3ds}

            <Reveal className="px-1 mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 dark:bg-blue-500/10 text-primary dark:text-blue-400 rounded-full text-[10px] font-bold tracking-widest uppercase mb-2 border border-primary/20 dark:border-blue-500/30">
                    <ShoppingBag size={11} /> Tienda
                </div>
                <h1 className="font-headline text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white uppercase italic tracking-tighter">Comprá algo rico</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Armá tu pedido y mostrá el QR en el mostrador.</p>
            </Reveal>

            {/* Buscador */}
            <Reveal delay={0.05} className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/90 dark:bg-slate-950/90 backdrop-blur">
                <div className="relative">
                    <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar gaseosa, café, snack..."
                        className="w-full h-12 pl-11 pr-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    {busqueda && (
                        <button onClick={() => setBusqueda('')} aria-label="Borrar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                            <X size={16} />
                        </button>
                    )}
                </div>
                {categorias.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pt-2.5 pb-1 -mx-1 px-1">
                        {['todos', ...categorias].map((c) => (
                            <button
                                key={c}
                                onClick={() => setCategoria(c)}
                                className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-colors ${categoria === c
                                    ? 'bg-primary dark:bg-blue-500 text-white'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800'}`}
                            >
                                {c === 'todos' ? 'Todo' : c}
                            </button>
                        ))}
                    </div>
                )}
            </Reveal>

            {error && (
                <div className="mt-3 flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
                    <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}

            {/* Grilla */}
            {!visibles.length ? (
                <Reveal delay={0.1} variant={scaleIn} className="mt-6 bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-10 text-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <PackageX size={28} className="text-slate-300 dark:text-slate-700" />
                    </div>
                    <p className="font-black text-sm text-slate-700 dark:text-slate-200 uppercase tracking-tight italic">
                        {busqueda ? 'No encontramos ese producto' : 'Todavía no hay productos cargados'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5">
                        {busqueda ? 'Probá con otro nombre.' : 'Cuando el Garage cargue su catálogo, va a aparecer acá.'}
                    </p>
                </Reveal>
            ) : (
                <StaggerList className="grid grid-cols-2 gap-3 mt-4">
                    {visibles.map((p) => (
                        <StaggerItem key={p.id}>
                            <TarjetaProducto producto={p} enCarrito={carrito[p.id] || 0} onSumar={sumar} />
                        </StaggerItem>
                    ))}
                </StaggerList>
            )}

            {/* Barra del carrito */}
            <AnimatePresence>
                {unidades > 0 && !carritoAbierto && (
                    <motion.div
                        initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 90, opacity: 0 }}
                        transition={reduce ? { duration: 0.15 } : springPop}
                        className="fixed bottom-20 left-0 right-0 z-30 px-4"
                    >
                        <Pressable
                            onClick={() => setCarritoAbierto(true)}
                            className="w-full max-w-md mx-auto flex items-center justify-between gap-3 px-5 py-4 bg-primary dark:bg-blue-500 text-white rounded-2xl shadow-2xl shadow-primary/30"
                        >
                            <span className="flex items-center gap-2.5">
                                <span className="relative">
                                    <ShoppingCart size={20} />
                                    <span className="absolute -top-2 -right-2 bg-secondary text-slate-900 text-[10px] font-black w-4.5 h-4.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center">{unidades}</span>
                                </span>
                                <span className="font-black uppercase tracking-widest text-xs">Ver pedido</span>
                            </span>
                            <span className="font-black text-sm tabular-nums">{gs(total)}</span>
                        </Pressable>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Carrito */}
            <AnimatePresence>
                {carritoAbierto && (
                    <Carrito
                        lineas={lineas}
                        total={total}
                        opciones={opciones}
                        medioPago={medioPago}
                        tarjetaId={tarjetaId}
                        enviando={enviando}
                        onCerrar={() => setCarritoAbierto(false)}
                        onSumar={sumar}
                        onQuitar={(p) => setCarrito((prev) => { const c = { ...prev }; delete c[p.id]; return c; })}
                        onMedioPago={setMedioPago}
                        onTarjeta={setTarjetaId}
                        onConfirmar={generarQR}
                        error={error}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Tarjeta de producto ────────────────────────────────────────────────────────
function TarjetaProducto({ producto, enCarrito, onSumar }: { producto: Producto; enCarrito: number; onSumar: (p: Producto, d: number) => void }) {
    const agotado = !producto.available;
    return (
        <div className={`bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col h-full ${agotado ? 'opacity-60' : ''}`}>
            <div className="aspect-square bg-slate-50 dark:bg-slate-800/50 relative overflow-hidden">
                {producto.imageUrl ? (
                    <img src={producto.imageUrl} alt={producto.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={30} className="text-slate-200 dark:text-slate-700" />
                    </div>
                )}
                {agotado && (
                    <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                        <span className="text-white text-[10px] font-black uppercase tracking-widest bg-slate-900/80 px-3 py-1.5 rounded-full">Sin stock</span>
                    </div>
                )}
            </div>
            <div className="p-3 flex flex-col flex-1">
                <p className="font-bold text-[13px] leading-tight text-slate-900 dark:text-white line-clamp-2">{producto.name}</p>
                {producto.brand && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{producto.brand}</p>}
                <p className="font-black text-sm text-primary dark:text-blue-400 mt-1.5 tabular-nums">{gs(producto.priceGs)}</p>

                <div className="mt-auto pt-2.5">
                    {enCarrito === 0 ? (
                        <Pressable
                            onClick={() => onSumar(producto, 1)}
                            disabled={agotado}
                            className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-1.5 disabled:opacity-40"
                        >
                            <Plus size={13} /> Agregar
                        </Pressable>
                    ) : (
                        <div className="flex items-center justify-between gap-2 bg-primary/10 dark:bg-blue-500/15 rounded-xl p-1">
                            <button onClick={() => onSumar(producto, -1)} aria-label="Quitar uno" className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-primary dark:text-blue-400 shadow-sm">
                                <Minus size={14} />
                            </button>
                            <span className="font-black text-sm text-primary dark:text-blue-400 tabular-nums">{enCarrito}</span>
                            <button
                                onClick={() => onSumar(producto, 1)}
                                disabled={enCarrito >= producto.stock}
                                aria-label="Agregar uno"
                                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-primary dark:text-blue-400 shadow-sm disabled:opacity-30"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Carrito ────────────────────────────────────────────────────────────────────
function Carrito({ lineas, total, opciones, medioPago, tarjetaId, enviando, onCerrar, onSumar, onQuitar, onMedioPago, onTarjeta, onConfirmar, error }: any) {
    const saldo = opciones?.walletBalanceGs || 0;
    const tarjetas = opciones?.cards || [];
    const saldoAlcanza = saldo >= total;
    const puedeConfirmar = lineas.length > 0 && !enviando &&
        (medioPago === 'wallet' ? saldoAlcanza : !!tarjetaId);

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onCerrar}
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
            />
            <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 rounded-t-[2rem] border-t border-slate-100 dark:border-slate-800 max-h-[88vh] flex flex-col"
            >
                <div className="p-5 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                    <h2 className="font-black text-base text-slate-900 dark:text-white uppercase italic tracking-tighter">Tu pedido</h2>
                    <button onClick={onCerrar} aria-label="Cerrar" className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    {lineas.map(({ producto, qty }: any) => (
                        <div key={producto.id} className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 overflow-hidden shrink-0">
                                {producto.imageUrl
                                    ? <img src={producto.imageUrl} alt="" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={18} className="text-slate-300 dark:text-slate-600" /></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{producto.name}</p>
                                <p className="text-xs text-slate-400 tabular-nums">{gs(producto.priceGs)} c/u</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => onSumar(producto, -1)} aria-label="Quitar uno" className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                                    <Minus size={13} />
                                </button>
                                <span className="w-5 text-center font-black text-sm text-slate-900 dark:text-white tabular-nums">{qty}</span>
                                <button onClick={() => onSumar(producto, 1)} disabled={qty >= producto.stock} aria-label="Agregar uno" className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30">
                                    <Plus size={13} />
                                </button>
                            </div>
                            <button onClick={() => onQuitar(producto)} aria-label={`Quitar ${producto.name}`} className="text-slate-300 hover:text-red-500 p-1 shrink-0">
                                <Trash2 size={15} />
                            </button>
                        </div>
                    ))}

                    {/* Medio de pago: lo elige el cliente ACÁ, así el encargado sólo confirma */}
                    <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5">¿Cómo pagás?</p>

                        <button
                            onClick={() => onMedioPago('wallet')}
                            disabled={!saldoAlcanza}
                            className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 mb-2 text-left transition-colors ${medioPago === 'wallet'
                                ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-500/10'
                                : 'border-slate-100 dark:border-slate-800'} ${!saldoAlcanza ? 'opacity-50' : ''}`}
                        >
                            <Wallet size={18} className="text-primary dark:text-blue-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-slate-900 dark:text-white">Saldo de mi billetera</p>
                                <p className={`text-xs tabular-nums ${saldoAlcanza ? 'text-slate-500 dark:text-slate-400' : 'text-amber-600 dark:text-amber-400 font-semibold'}`}>
                                    {saldoAlcanza ? `Tenés ${gs(saldo)}` : `Te faltan ${gs(total - saldo)}`}
                                </p>
                            </div>
                            {medioPago === 'wallet' && <CheckCircle2 size={17} className="text-primary dark:text-blue-400 shrink-0" />}
                        </button>

                        {tarjetas.length === 0 ? (
                            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
                                <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Agregá una tarjeta desde tu perfil para pagar sin saldo.</p>
                            </div>
                        ) : tarjetas.map((c: any) => (
                            <button
                                key={c.id}
                                onClick={() => { onMedioPago('card'); onTarjeta(c.id); }}
                                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 mb-2 text-left transition-colors ${medioPago === 'card' && tarjetaId === c.id
                                    ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-500/10'
                                    : 'border-slate-100 dark:border-slate-800'}`}
                            >
                                <CreditCard size={18} className="text-primary dark:text-blue-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{c.brand} {c.maskedNumber}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{c.isPrimary ? 'Principal' : c.alias || 'Tarjeta guardada'}</p>
                                </div>
                                {medioPago === 'card' && tarjetaId === c.id && <CheckCircle2 size={17} className="text-primary dark:text-blue-400 shrink-0" />}
                            </button>
                        ))}
                    </div>

                    {error && (
                        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
                            <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    )}
                </div>

                <div className="p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-baseline justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
                        <span className="font-black text-2xl text-slate-900 dark:text-white tabular-nums">{gs(total)}</span>
                    </div>
                    <Pressable
                        onClick={onConfirmar}
                        disabled={!puedeConfirmar}
                        className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2.5 disabled:opacity-40 shadow-lg shadow-primary/20"
                    >
                        {enviando ? <Loader2 size={17} className="animate-spin" /> : <><QrCode size={17} /> Generar QR de compra</>}
                    </Pressable>
                    <p className="text-[10px] text-slate-400 text-center mt-2.5 leading-relaxed">
                        No se te cobra nada todavía. El pago se hace cuando el encargado confirme tu pedido.
                    </p>
                </div>
            </motion.div>
        </>
    );
}

// ── Estado del pedido: el QR y lo que pasa después ─────────────────────────────
function EstadoPedido({ pedido, reduce, onCancelar, onVolver, onReintentar }: any) {
    const [restante, setRestante] = useState<number>(0);

    useEffect(() => {
        if (pedido.status !== 'PENDING' || !pedido.expiresAt) return;
        const calc = () => setRestante(Math.max(0, Math.floor((new Date(pedido.expiresAt).getTime() - Date.now()) / 1000)));
        calc();
        const i = setInterval(calc, 1000);
        return () => clearInterval(i);
    }, [pedido.status, pedido.expiresAt]);

    const mm = Math.floor(restante / 60);
    const ss = String(restante % 60).padStart(2, '0');

    const pagado = pedido.status === 'PAID';
    const rechazado = pedido.status === 'DECLINED';
    const cerrado = ['CANCELLED', 'EXPIRED', 'VOIDED'].includes(pedido.status);

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pb-28 max-w-md mx-auto space-y-4">
            {/* ── Pagado ── */}
            {pagado && (
                <Reveal variant={scaleIn} className="rounded-[2rem] overflow-hidden relative bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10 px-7 py-9 text-center">
                        <motion.div
                            initial={reduce ? { scale: 1 } : { scale: 0, rotate: -20 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 600, damping: 18, delay: 0.1 }}
                            className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-5 border-2 border-white/30"
                        >
                            <CheckCircle2 size={44} className="text-white" />
                        </motion.div>
                        <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.25em] mb-1">Compra registrada</p>
                        <h2 className="text-white font-black text-2xl uppercase italic tracking-tighter mb-1">¡Pagado!</h2>
                        <p className="text-white/85 text-sm font-medium mb-5">
                            {pedido.paymentMethod === 'wallet' ? 'Se descontó de tu billetera.' : 'Se debitó de tu tarjeta.'}
                        </p>
                        <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl p-4 text-left space-y-1.5 mb-5">
                            {pedido.items.map((i: any) => (
                                <div key={i.itemId} className="flex justify-between text-xs text-white/90">
                                    <span>{i.qty}× {i.name}</span>
                                    <span className="tabular-nums font-semibold">{gs(i.lineTotalGs)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between pt-2 mt-1 border-t border-white/20 text-sm font-black">
                                <span>Total</span><span className="tabular-nums">{gs(pedido.totalGs)}</span>
                            </div>
                        </div>
                        <Pressable onClick={onVolver} className="w-full py-4 bg-white text-emerald-600 font-black uppercase tracking-widest text-xs rounded-2xl">
                            Seguir comprando
                        </Pressable>
                    </div>
                </Reveal>
            )}

            {/* ── Rechazado ── */}
            {rechazado && (
                <Reveal variant={scaleIn} className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-red-200 dark:border-red-500/30 p-8 text-center">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={30} className="text-red-500" />
                    </div>
                    <h2 className="font-black text-lg text-slate-900 dark:text-white uppercase italic tracking-tighter mb-1.5">No se pudo cobrar</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{pedido.declineReason || 'El pago fue rechazado.'}</p>
                    <Pressable onClick={onReintentar} className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs mb-2">
                        Probar con otro medio de pago
                    </Pressable>
                    <Pressable tapOnly onClick={onVolver} className="w-full py-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                        Volver a la tienda
                    </Pressable>
                </Reveal>
            )}

            {/* ── Cancelado o vencido ── */}
            {cerrado && (
                <Reveal variant={scaleIn} className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-8 text-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <Clock size={28} className="text-slate-400" />
                    </div>
                    <h2 className="font-black text-base text-slate-800 dark:text-slate-100 uppercase italic tracking-tighter mb-1.5">
                        {pedido.status === 'EXPIRED' ? 'Tu pedido venció' : 'Pedido cancelado'}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Armá uno nuevo cuando quieras.</p>
                    <Pressable onClick={onVolver} className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs">
                        Volver a la tienda
                    </Pressable>
                </Reveal>
            )}

            {/* ── QR vivo: pendiente, escaneado o esperando al banco ── */}
            {!pagado && !rechazado && !cerrado && (
                <>
                    <Reveal className="px-1">
                        <button onClick={onVolver} className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                            <ArrowLeft size={13} /> Tienda
                        </button>
                        <h1 className="font-headline text-2xl font-extrabold text-slate-900 dark:text-white uppercase italic tracking-tighter">Mostrá este QR</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">El encargado lo escanea y confirma tu compra.</p>
                    </Reveal>

                    <Reveal delay={0.08} variant={scaleIn} className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className="p-6 text-center">
                            {pedido.qrToken ? (
                                <div className="bg-white border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-5 inline-block mb-4 shadow-xl relative">
                                    <QRCodeSVG value={pedido.qrToken} size={220} bgColor="#ffffff" fgColor="#0f172a" level="M" marginSize={2}
                                        imageSettings={{ src: '/logo.png', height: 30, width: 30, excavate: true }} />
                                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-primary dark:bg-blue-500 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] whitespace-nowrap shadow-xl">
                                        {pedido.status === 'PENDING' && 'Esperando al encargado...'}
                                        {pedido.status === 'SCANNED' && 'Revisando tu pedido...'}
                                        {pedido.status === 'AUTHORIZING' && 'Confirmá con tu banco'}
                                    </div>
                                </div>
                            ) : (
                                <div className="py-10"><Loader2 size={26} className="animate-spin text-slate-300 mx-auto" /></div>
                            )}

                            <div className="mt-7 mb-1 flex items-baseline justify-between px-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total a pagar</span>
                                <span className="font-black text-2xl text-slate-900 dark:text-white tabular-nums">{gs(pedido.totalGs)}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 text-left px-1">
                                {pedido.paymentMethod === 'wallet' ? 'Se descuenta de tu billetera' : 'Se debita de tu tarjeta'}
                            </p>

                            {pedido.status === 'PENDING' && restante > 0 && (
                                <p className="text-[11px] font-bold text-slate-400 mt-4 flex items-center justify-center gap-1.5">
                                    <Clock size={12} /> Vence en {mm}:{ss}
                                </p>
                            )}
                            {pedido.status === 'AUTHORIZING' && (
                                <div className="mt-4 flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                                    <Loader2 size={14} className="animate-spin" />
                                    <span className="text-[11px] font-black uppercase tracking-widest">Verificando con tu banco</span>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-800 p-5 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tu pedido</p>
                            {pedido.items.map((i: any) => (
                                <div key={i.itemId} className="flex justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-300">{i.qty}× {i.name}</span>
                                    <span className="font-bold text-slate-900 dark:text-white tabular-nums">{gs(i.lineTotalGs)}</span>
                                </div>
                            ))}
                        </div>
                    </Reveal>

                    {pedido.status === 'PENDING' && (
                        <Pressable tapOnly onClick={onCancelar} className="w-full py-3 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500">
                            Cancelar pedido
                        </Pressable>
                    )}
                </>
            )}
        </motion.div>
    );
}
