import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, Clock, X, CreditCard, RefreshCw, TrendingUp, TrendingDown, Banknote, Gift } from 'lucide-react';
import api from '../../services/api';
import BancardCardManager from '../components/BancardCardManager';
import { runBancardPayment } from '../lib/bancardPayment';
import { useBancard3ds } from '../components/Bancard3dsModal';
import PaymentResultOverlay, { PayPhase } from '../components/PaymentResultOverlay';
import useScrollLock from '../../hooks/useScrollLock';
import {
    motion,
    AnimatePresence,
    AnimatedNumber,
    StaggerList,
    StaggerItem,
    Reveal,
    Skeleton,
    SkeletonText,
    Pressable,
    springSoft,
} from '../lib/motion';

const rechargeOptions = [20000, 50000, 100000, 200000];
const MIN_TOPUP = 10000;

// Helper único de formato de guaraníes (sin Math.abs: respeta el signo si se lo pasa con signo).
const fmtGs = (n: number) => `₲ ${Number(n || 0).toLocaleString('es-PY')}`;
// Para montos donde queremos solo la magnitud (el signo lo agregamos aparte).
const fmtGsAbs = (n: number) => `₲ ${Math.abs(Number(n || 0)).toLocaleString('es-PY')}`;
const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-PY', { day: 'numeric', month: 'short' });

// Etiqueta legible por tipo de movimiento (según contrato del backend).
const MOVEMENT_LABELS: Record<string, string> = {
    WALLET_TOPUP: 'Recarga',
    WALLET_REFUND: 'Reembolso',
    REFERRAL_REWARD: 'Referido',
    PROMOTION: 'Promoción',
    COMPENSATION: 'Compensación',
    WALLET_PAYMENT: 'Pago',
    USE: 'Pago',
    SHOP_PURCHASE: 'Pago',
};
const getMovementLabel = (type: string) => MOVEMENT_LABELS[type] || 'Movimiento';

// Fila de movimiento real: ícono según ingreso/gasto, etiqueta por tipo,
// descripción como subtítulo, monto con signo y fecha corta.
const MovementItem = memo(function MovementItem({ movement }: any) {
    const positive = movement.amount >= 0;
    return (
        <StaggerItem className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border border-transparent transition-colors ${positive
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:border-emerald-500/20'
                : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:border-rose-500/20'}`}>
                {positive ? <ArrowDownLeft size={19} strokeWidth={2.5} /> : <ArrowUpRight size={19} strokeWidth={2.5} />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight truncate">{getMovementLabel(movement.type)}</p>
                {movement.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">{movement.description}</p>
                )}
            </div>
            <div className="text-right shrink-0">
                <p className={`font-black tracking-tight text-base tabular-nums ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {positive ? '+ ' : '− '}{fmtGsAbs(movement.amount)}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">{formatDate(movement.createdAt)}</p>
            </div>
        </StaggerItem>
    );
});

const Billetera = memo(function Billetera({ user }: { user?: any }) {
    const firstName = user?.name ? String(user.name).trim().split(' ')[0] : '';
    const [balance, setBalance] = useState(0);
    const [walletBalance, setWalletBalance] = useState(0);
    const [referralBalance, setReferralBalance] = useState(0);
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [showRechargeModal, setShowRechargeModal] = useState(false);
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [customAmount, setCustomAmount] = useState('');

    const [payPhase, setPayPhase] = useState<PayPhase>(null);
    const [payMsg, setPayMsg] = useState('');

    // Modal + handlers para el desafío 3DS de Bancard (si el cobro lo requiere).
    const { handlers: bancard3ds, modal: bancard3dsModal } = useBancard3ds();

    useScrollLock(showRechargeModal || !!payPhase);

    const loadData = useCallback(async () => {
        try {
            const { data } = await api.get('/credits', { _noCache: true } as any);
            if (data.success) {
                setBalance(data.data.totalBalance || 0);
                setWalletBalance(data.data.walletBalance || 0);
                setReferralBalance(data.data.referralBalance || 0);
                setMovements(data.data.movements || []);
            }
        } catch (error) {
            console.error('Error cargando datos de billetera:', error);
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Ingresos / gastos del mes en curso a partir de los movimientos reales.
    const monthlyStats = useMemo(() => {
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        const monthMovements = movements.filter(m => {
            const d = new Date(m.createdAt);
            return d.getMonth() === month && d.getFullYear() === year;
        });
        const monthIncome = monthMovements.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0);
        const monthExpenses = monthMovements.filter(m => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0);
        return { monthIncome, monthExpenses };
    }, [movements]);

    const payAmount = selectedAmount ?? (parseInt(customAmount) || 0);
    const canPay = payAmount >= MIN_TOPUP;

    const openRecharge = () => {
        setSelectedAmount(null);
        setCustomAmount('');
        setShowRechargeModal(true);
    };

    // Único método real: cobro a la tarjeta guardada vía Bancard (con soporte 3DS).
    const handlePay = async () => {
        if (!canPay) return;
        setPayMsg('');
        setPayPhase('processing');
        const r = await runBancardPayment(
            '/payments/charge-topup',
            { amountGs: payAmount },
            '/payments/charge-topup-3ds-complete',
            bancard3ds,
        );
        if (r.ok) {
            setPayPhase('success');
        } else {
            setPayMsg(r.message || (r.code === 'NO_CARD'
                ? 'No tenés una tarjeta guardada. Agregá una para recargar.'
                : 'No se pudo procesar la recarga.'));
            setPayPhase('error');
        }
    };

    if (loading) {
        return (
            <div className="space-y-6 pb-24 max-w-lg mx-auto">
                <Skeleton className="w-full h-64 rounded-[2.5rem]" />
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="w-full h-28 rounded-[2rem]" />
                    <Skeleton className="w-full h-28 rounded-[2rem]" />
                </div>
                <div className="bg-white/80 dark:bg-slate-900/50 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 space-y-4">
                    <Skeleton className="w-40 h-4 rounded-full" />
                    <SkeletonText lines={4} />
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            className="space-y-6 pb-24 max-w-lg mx-auto"
        >
            {/* ── Tarjeta de saldo — sobria y real ── */}
            <Reveal className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white shadow-xl border border-white/5">
                <div className="relative z-10">
                    <div className="flex items-start justify-between mb-7">
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-white">Mi saldo</h1>
                            {firstName && (
                                <p className="text-xs font-medium text-white/45 mt-0.5">{firstName}</p>
                            )}
                        </div>
                        <span className="text-[11px] brand-wordmark">LUXURY GARAGE</span>
                    </div>

                    <div className="mb-7">
                        <AnimatedNumber
                            value={balance}
                            prefix="₲ "
                            currency
                            className="text-5xl font-headline font-black tracking-tighter block"
                        />
                        <p className="text-xs font-medium text-white/45 mt-1.5">Saldo disponible</p>
                    </div>

                    {/* Desglose real del saldo (solo si hay bonos por referido). */}
                    {referralBalance !== 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
                                <Banknote size={12} className="text-white/45" />
                                <span className="text-[11px] text-white/65 font-semibold">{fmtGs(walletBalance)} cargado</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
                                <Gift size={12} className="text-white/45" />
                                <span className="text-[11px] text-white/65 font-semibold">{fmtGs(referralBalance)} en bonos</span>
                            </span>
                        </div>
                    )}

                    <Pressable
                        onClick={openRecharge}
                        className="w-full flex items-center justify-center gap-2 bg-[#00d2ff] hover:bg-secondary text-slate-900 py-4 rounded-2xl font-bold text-sm transition-colors shadow-lg shadow-[#00d2ff]/20"
                    >
                        <Plus size={18} />
                        Recargar fondos
                    </Pressable>
                </div>
            </Reveal>

            {/* ── Ingresos / Gastos del mes (calculados de los movimientos reales) ── */}
            <div className="grid grid-cols-2 gap-4">
                <Reveal delay={0.05} className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                            <TrendingUp size={15} className="text-emerald-500" />
                        </span>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ingresos del mes</p>
                    </div>
                    <AnimatedNumber
                        value={monthlyStats.monthIncome}
                        prefix="₲ "
                        currency
                        className="text-xl font-headline font-black text-emerald-600 dark:text-emerald-400 tracking-tight block"
                    />
                </Reveal>
                <Reveal delay={0.1} className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                            <TrendingDown size={15} className="text-rose-500" />
                        </span>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Gastos del mes</p>
                    </div>
                    <AnimatedNumber
                        value={monthlyStats.monthExpenses}
                        prefix="₲ "
                        currency
                        className="text-xl font-headline font-black text-rose-600 dark:text-rose-400 tracking-tight block"
                    />
                </Reveal>
            </div>

            {/* ── Movimientos recientes (lista real) ── */}
            <Reveal delay={0.15} className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-headline text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <Clock size={16} className="text-slate-400 dark:text-slate-500" /> Movimientos recientes
                    </h3>
                    <Pressable
                        tapOnly
                        onClick={loadData}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <RefreshCw size={12} /> Actualizar
                    </Pressable>
                </div>

                {movements.length === 0 ? (
                    <div className="py-12 text-center">
                        <Wallet size={32} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                        <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold">Sin movimientos aún</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Tus recargas y pagos aparecerán acá</p>
                    </div>
                ) : (
                    <StaggerList className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {movements.map((m) => <MovementItem key={m.id} movement={m} />)}
                    </StaggerList>
                )}
            </Reveal>

            {/* ── Medios de pago (Bancard) ── */}
            <Reveal delay={0.2} className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <h3 className="font-headline text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <CreditCard size={16} className="text-slate-400 dark:text-slate-500" /> Mis tarjetas
                    </h3>
                </div>
                <div className="p-6">
                    <BancardCardManager onChange={loadData} />
                </div>
            </Reveal>

            {/* ── Modal de recarga (solo tarjeta) ── */}
            <AnimatePresence>
                {showRechargeModal && (
                    <motion.div
                        className="fixed inset-0 bg-slate-900/90 backdrop-blur-lg z-[200] flex items-end md:items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowRechargeModal(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 100, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 100, scale: 0.97 }}
                            transition={springSoft}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-slate-950 rounded-[3rem] p-8 w-full max-w-md shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-slate-100 dark:border-slate-800 overflow-hidden relative max-h-[90vh] overflow-y-auto overscroll-contain"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary opacity-50" />

                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="font-headline text-2xl font-black text-slate-900 dark:text-white tracking-tight">Recargar saldo</h3>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Cobro a tu tarjeta guardada</p>
                                </div>
                                <Pressable tapOnly onClick={() => setShowRechargeModal(false)} className="p-2 -mr-1 bg-slate-50 dark:bg-white/5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                                    <X size={20} className="text-slate-400" />
                                </Pressable>
                            </div>

                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-4 px-1">Seleccioná un monto</p>
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {rechargeOptions.map(amount => (
                                    <Pressable
                                        key={amount}
                                        tapOnly
                                        onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}
                                        className={`p-5 rounded-[1.5rem] font-black text-base border transition-colors ${selectedAmount === amount
                                            ? 'bg-primary dark:bg-blue-600 text-white shadow-xl shadow-primary/20 border-transparent'
                                            : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-white/5 text-slate-800 dark:text-slate-300 hover:border-primary/20'
                                            }`}
                                    >
                                        {fmtGs(amount)}
                                    </Pressable>
                                ))}
                            </div>

                            <div className="mb-2">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-3 px-1">O ingresá otro monto</label>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    placeholder="₲ 0"
                                    value={customAmount}
                                    onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/80 dark:text-white rounded-[1.25rem] border border-transparent focus:border-primary/30 focus:ring-2 focus:ring-primary/20 font-black text-xl outline-none transition-all"
                                />
                            </div>
                            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-6 px-1">Mínimo {fmtGs(MIN_TOPUP)}</p>

                            {/* Medio de pago — tarjeta guardada (Bancard) */}
                            <div className="flex items-center gap-4 p-4 rounded-[1.5rem] bg-primary/5 dark:bg-blue-500/10 border border-primary/10 dark:border-blue-500/20 mb-6">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm shrink-0">
                                    <CreditCard size={20} className="text-primary dark:text-blue-400" />
                                </div>
                                <div className="text-left min-w-0">
                                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">Tarjeta guardada</p>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Cobro seguro al instante vía Bancard</p>
                                </div>
                            </div>

                            <Pressable
                                onClick={handlePay}
                                disabled={!canPay}
                                className="w-full py-5 bg-primary dark:bg-blue-600 text-white rounded-[1.5rem] font-bold text-sm disabled:opacity-30 hover:shadow-xl hover:shadow-primary/30 transition-shadow flex items-center justify-center gap-2"
                            >
                                Pagar {canPay ? fmtGs(payAmount) : ''} <ArrowUpRight size={16} />
                            </Pressable>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Resultado del cobro (procesando / éxito / error, incl. 3DS) */}
            <PaymentResultOverlay
                phase={payPhase}
                message={payMsg}
                successText="¡Recarga acreditada!"
                onClose={() => {
                    const wasSuccess = payPhase === 'success';
                    setPayPhase(null);
                    setPayMsg('');
                    if (wasSuccess) {
                        setShowRechargeModal(false);
                        setSelectedAmount(null);
                        setCustomAmount('');
                        loadData();
                    }
                }}
                onRetry={payPhase === 'error' ? handlePay : undefined}
            />

            {/* Iframe 3DS de Bancard (se muestra solo si el cobro lo requiere) */}
            {bancard3dsModal}
        </motion.div>
    );
});

export default Billetera;
