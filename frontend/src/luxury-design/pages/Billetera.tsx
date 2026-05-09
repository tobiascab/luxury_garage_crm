import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, Clock, X, CreditCard, CheckCircle2, RefreshCw, AlertCircle, Shield, Check, Loader2, TrendingUp, TrendingDown, Banknote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { API_URL } from '../config';
import api from '../../services/api';
const rechargeOptions = [20000, 50000, 100000, 200000];

// Componente memoizado para cada movimiento individual
const MovementItem = memo(function MovementItem({ movement, getMovementIcon, getMovementLabel, formatDate, formatGs }: any) {
    return (
        <div className="flex items-center gap-4 p-5 hover:bg-white dark:hover:bg-slate-800/40 transition-all group">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-transparent transition-all group-hover:scale-110 ${movement.amount > 0
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:border-emerald-500/20'
                : 'bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 group-hover:border-red-500/20'}`}
            >
                {getMovementIcon(movement.type, movement.amount)}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-slate-900 dark:text-slate-100 tracking-tight leading-tight uppercase italic truncate">{getMovementLabel(movement)}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5 tracking-wider">{formatDate(movement.createdAt)}</p>
            </div>
            <div className="text-right">
                <p className={`font-black tracking-tighter text-lg ${movement.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-200'}`}>
                    {movement.amount > 0 ? '+' : '-'}{formatGs(movement.amount)}
                </p>
            </div>
        </div>
    );
});

const Billetera = memo(function Billetera() {
    const navigate = useNavigate();
    const [balance, setBalance] = useState(0);
    const [walletBalance, setWalletBalance] = useState(0);
    const [referralBalance, setReferralBalance] = useState(0);
    const [movements, setMovements] = useState<any[]>([]);
    const [cards, setCards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRechargeModal, setShowRechargeModal] = useState(false);
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [customAmount, setCustomAmount] = useState('');
    const [selectedCard, setSelectedCard] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer'>('card');
    const [step, setStep] = useState<'amount' | 'processing' | 'success' | 'error'>('amount');
    const [errorMsg, setErrorMsg] = useState('');
    const [cardRegistration, setCardRegistration] = useState<{
        processId: string;
        jsLibUrl: string;
    } | null>(null);
    const [cardRegistrationLoading, setCardRegistrationLoading] = useState(false);

    const token = localStorage.getItem('luxury_token');
    const headers: any = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const formatGs = (n: number) => `₲ ${Math.abs(n).toLocaleString('es-PY')}`;
    const formatDate = (d: string) => {
        const date = new Date(d);
        return date.toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    };

    const loadData = useCallback(async () => {
        try {
            const [creditsRes, cardsRes] = await Promise.all([
                api.get('/credits'),
                api.get('/payments/cards'),
            ]);

            const creditsData = creditsRes.data;
            if (creditsData.success) {
                setBalance(creditsData.data.totalBalance || 0);
                setWalletBalance(creditsData.data.walletBalance || 0);
                setReferralBalance(creditsData.data.referralBalance || 0);
                setMovements(creditsData.data.movements || []);
            }

            const cardsData = cardsRes.data;
            if (cardsData.success) {
                setCards(cardsData.data || []);
                const primary = cardsData.data?.find((c: any) => c.isPrimary);
                if (primary) setSelectedCard(primary.id);
                else if (cardsData.data?.length > 0) setSelectedCard(cardsData.data[0].id);
            }
        } catch (error) {
            console.error('Error cargando datos de billetera:', error);
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, []);

    const handleAddCard = async () => {
        setCardRegistrationLoading(true);
        try {
            const res = await api.post('/payments/card/register', {
                returnUrl: window.location.origin + '/billetera',
            });
            const { processId, jsLibUrl } = res.data.data;
            setCardRegistration({ processId, jsLibUrl });
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error al iniciar catastro de tarjeta');
        } finally {
            setCardRegistrationLoading(false);
        }
    };

    useEffect(() => {
        if (!cardRegistration) return;

        const handleMessage = async (event: MessageEvent) => {
            if (event.data?.status === 'add_new_card_success') {
                try {
                    await api.post('/payments/card/sync');
                    toast.success('¡Tarjeta agregada exitosamente!');
                } catch {
                    toast.error('Tarjeta agregada, pero hubo un error al sincronizar');
                } finally {
                    setCardRegistration(null);
                    loadData();
                }
            } else if (event.data?.status === 'add_new_card_fail') {
                toast.error(event.data.description || 'No se pudo agregar la tarjeta');
                setCardRegistration(null);
            }
        };

        window.addEventListener('message', handleMessage);

        const script = document.createElement('script');
        script.src = cardRegistration.jsLibUrl;
        script.onload = () => {
            if ((window as any).Bancard) {
                const styles = {
                    'form-background-color': '#0f172a',
                    'button-background-color': '#8b5cf6',
                    'button-text-color': '#ffffff',
                    'button-border-color': '#7c3aed',
                    'input-background-color': '#1e293b',
                    'input-text-color': '#f1f5f9',
                    'input-placeholder-color': '#64748b',
                };
                (window as any).Bancard.Cards.createForm('bancard-iframe-container', cardRegistration.processId, styles);
            }
        };
        document.head.appendChild(script);

        return () => {
            window.removeEventListener('message', handleMessage);
            const existingScript = document.querySelector(`script[src="${cardRegistration.jsLibUrl}"]`);
            if (existingScript) document.head.removeChild(existingScript);
        };
    }, [cardRegistration]);

    // Memoizamos cálculos de estadísticas mensuales
    const monthlyStats = useMemo(() => {
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        const monthMovements = movements.filter(m => {
            const d = new Date(m.createdAt);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        });
        const monthIncome = monthMovements.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0);
        const monthExpenses = monthMovements.filter(m => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0);

        return { monthIncome, monthExpenses };
    }, [movements]);

    const handleRecharge = async () => {
        const amount = selectedAmount || parseInt(customAmount);
        if (!amount || amount < 10000) return;

        if (paymentMethod === 'card') {
            if (!selectedCard) return;
            setStep('processing');
            setErrorMsg('');

            try {
                const res = await api.post('/credits/topup-card', { amount, cardId: selectedCard });
                const data = res.data;

                if (data.success) {
                    setStep('success');
                    setBalance(data.balance || balance + amount);
                    // Auto close after 3s
                    setTimeout(() => {
                        setShowRechargeModal(false);
                        setStep('amount');
                        setSelectedAmount(null);
                        setCustomAmount('');
                        loadData(); // Refresh
                    }, 3000);
                } else {
                    setErrorMsg(data.message || 'Error procesando el cobro');
                    setStep('error');
                }
            } catch (error: any) {
                console.error('Error recargando con tarjeta:', error);
                setErrorMsg(error?.response?.data?.message || 'Error de conexión');
                setStep('error');
            }
        } else {
            // Transfer method — just create a pending topup
            setStep('processing');
            try {
                const res = await api.post('/credits/topup', { amount, paymentMethod: 'transferencia' });
                const data = res.data;

                if (data.success) {
                    setStep('success');
                    setBalance(data.balance || balance + amount);
                    setTimeout(() => {
                        setShowRechargeModal(false);
                        setStep('amount');
                        setSelectedAmount(null);
                        setCustomAmount('');
                        loadData();
                    }, 3000);
                } else {
                    setErrorMsg(data.message || 'Error');
                    setStep('error');
                }
            } catch (error: any) {
                console.error('Error recargando por transferencia:', error);
                setErrorMsg(error?.response?.data?.message || 'Error de conexión');
                setStep('error');
            }
        }
    };

    const getMovementIcon = (type: string, amount: number) => {
        if (amount > 0) return <ArrowDownLeft size={20} strokeWidth={2.5} />;
        return <ArrowUpRight size={20} strokeWidth={2.5} />;
    };

    const getMovementLabel = (m: any) => {
        if (m.description) return m.description;
        switch (m.type) {
            case 'WALLET_TOPUP': return 'Recarga de saldo';
            case 'SHOP_PURCHASE': return 'Compra en showroom';
            case 'REFERRAL_REWARD': return 'Bono por referido';
            case 'PROMOTION': return 'Promoción';
            case 'COMPENSATION': return 'Compensación';
            case 'REDEMPTION': return 'Canje de créditos';
            case 'WALLET_REFUND': return 'Reembolso';
            default: return m.type;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Cargando billetera…</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            className="space-y-6 pb-24 max-w-lg mx-auto"
        >
            {/* Balance Card */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl border border-white/5 transition-all group">
                <div className="absolute -top-16 -right-16 w-64 h-64 bg-primary/30 rounded-full blur-[80px] opacity-60 group-hover:scale-125 transition-transform duration-1000" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-secondary/20 rounded-full blur-[60px] opacity-40" />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10">
                                <Wallet size={24} className="text-secondary" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black tracking-[0.2em] uppercase text-white/40">Estado de Cuenta</p>
                                <p className="text-sm font-bold text-white/80 leading-tight italic tracking-tight">LUXU Wallet Premium</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="px-3 py-1 bg-emerald-500/20 rounded-full text-[8px] font-black tracking-widest uppercase border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                Verificado
                            </div>
                        </div>
                    </div>

                    <div className="mb-4">
                        <p className="text-5xl font-headline font-black tracking-tighter italic">{formatGs(balance)}</p>
                        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1 ml-1">Saldo Disponible</p>
                    </div>

                    {/* Balance breakdown */}
                    {(walletBalance !== 0 || referralBalance !== 0) && (
                        <div className="flex gap-4 mb-6">
                            <div className="flex items-center gap-1.5">
                                <Banknote size={12} className="text-white/30" />
                                <span className="text-[10px] text-white/40 font-bold">{formatGs(walletBalance)} cargado</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Shield size={12} className="text-white/30" />
                                <span className="text-[10px] text-white/40 font-bold">{formatGs(referralBalance)} bonos</span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => { setShowRechargeModal(true); setStep('amount'); setErrorMsg(''); }}
                        className="w-full flex items-center justify-center gap-2 bg-[#00d2ff] hover:bg-secondary text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-2xl shadow-[#00d2ff]/20"
                    >
                        <Plus size={18} />
                        Recargar Fondos
                    </button>
                </div>
            </div>

            {/* In/Out Summary — Real Data */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm text-center transition-all hover:bg-white dark:hover:bg-slate-900/60">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        <TrendingUp size={14} className="text-emerald-500" />
                    </div>
                    <p className="text-2xl font-headline font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">{formatGs(monthlyStats.monthIncome)}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">Ingresos / Mes</p>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm text-center transition-all hover:bg-white dark:hover:bg-slate-900/60">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        <TrendingDown size={14} className="text-red-500" />
                    </div>
                    <p className="text-2xl font-headline font-black text-red-500 dark:text-red-400 tracking-tighter">{formatGs(monthlyStats.monthExpenses)}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">Gastos / Mes</p>
                </div>
            </div>

            {/* Transactions — Real Data */}
            <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-headline text-[10px] font-black flex items-center gap-2 text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                        <Clock size={16} className="text-primary dark:text-blue-400" /> Movimientos Recientes
                    </h3>
                    <button onClick={() => loadData()} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                        <RefreshCw size={12} className="text-slate-400" />
                    </button>
                </div>

                {movements.length === 0 ? (
                    <div className="py-12 text-center">
                        <Wallet size={32} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-bold">Sin movimientos aún</p>
                        <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">Tus recargas y gastos aparecerán aquí</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {movements.map((m) => (
                            <MovementItem
                                key={m.id}
                                movement={m}
                                getMovementIcon={getMovementIcon}
                                getMovementLabel={getMovementLabel}
                                formatDate={formatDate}
                                formatGs={formatGs}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Agregar tarjeta con Bancard */}
            {cards.length === 0 && (
                <button
                    onClick={handleAddCard}
                    disabled={cardRegistrationLoading}
                    className="w-full bg-primary/5 dark:bg-blue-500/10 border border-primary/20 dark:border-blue-500/20 rounded-[2rem] p-5 flex items-center gap-4 hover:bg-primary/10 transition-all active:scale-[0.98] disabled:opacity-60"
                >
                    <div className="w-12 h-12 bg-primary/10 dark:bg-blue-500/20 rounded-2xl flex items-center justify-center">
                        {cardRegistrationLoading
                            ? <Loader2 size={22} className="text-primary dark:text-blue-400 animate-spin" />
                            : <CreditCard size={22} className="text-primary dark:text-blue-400" />
                        }
                    </div>
                    <div className="text-left flex-1">
                        <p className="font-bold text-sm text-slate-900 dark:text-white">Agregá una tarjeta</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                            Para recargar con tu tarjeta de débito/crédito
                        </p>
                    </div>
                    {!cardRegistrationLoading && <ArrowUpRight size={16} className="text-primary dark:text-blue-400" />}
                </button>
            )}

            {/* Modal iframe Bancard — catastro de tarjeta */}
            {cardRegistration && (
                <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-800">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <CreditCard size={18} className="text-purple-400" />
                                <h3 className="font-bold text-white text-sm uppercase tracking-wide">Agregar tarjeta</h3>
                            </div>
                            <button
                                onClick={() => setCardRegistration(null)}
                                className="p-1.5 rounded-full hover:bg-slate-800 transition-all text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div id="bancard-iframe-container" className="p-4 min-h-[400px]" />
                    </div>
                </div>
            )}

            {/* Recharge Modal */}
            <AnimatePresence>
                {showRechargeModal && (
                    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-lg z-[200] flex items-end md:items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 100 }}
                            className="bg-white dark:bg-slate-950 rounded-[3rem] p-8 w-full max-w-md shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-slate-100 dark:border-slate-800 overflow-hidden relative max-h-[90vh] overflow-y-auto"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary opacity-50" />

                            {step === 'amount' && (
                                <>
                                    <div className="flex justify-between items-center mb-8">
                                        <h3 className="font-headline text-2xl font-black text-slate-900 dark:text-white italic uppercase tracking-tighter">Recarga LUXU</h3>
                                        <button onClick={() => setShowRechargeModal(false)} className="p-2 bg-slate-50 dark:bg-white/5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                                            <X size={20} className="text-slate-400" />
                                        </button>
                                    </div>

                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-5 px-1">Seleccioná un monto</p>
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        {rechargeOptions.map(amount => (
                                            <button
                                                key={amount}
                                                onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}
                                                className={`p-5 rounded-[1.5rem] font-black text-base border transition-all active:scale-95 ${selectedAmount === amount
                                                    ? 'bg-primary dark:bg-blue-600 text-white shadow-xl shadow-primary/20 border-transparent'
                                                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-white/5 text-slate-800 dark:text-slate-300 hover:border-primary/20'
                                                    }`}
                                            >
                                                {formatGs(amount)}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mb-6">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block mb-3 px-1">O monto manual</label>
                                        <input
                                            type="number"
                                            placeholder="₲ 0"
                                            value={customAmount}
                                            onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/80 dark:text-white rounded-[1.25rem] border-none focus:ring-2 focus:ring-primary/20 font-black text-xl transition-all"
                                        />
                                    </div>

                                    {/* Payment Method Selection */}
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3 px-1">Método de pago</p>
                                    <div className="space-y-2 mb-6">
                                        {/* Card option */}
                                        <button
                                            onClick={() => setPaymentMethod('card')}
                                            className={`w-full p-4 rounded-[1.5rem] flex items-center gap-4 border transition-all ${paymentMethod === 'card'
                                                ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-500/10'
                                                : 'border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/30'
                                                }`}
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === 'card' ? 'bg-primary/10 dark:bg-blue-500/20' : 'bg-white dark:bg-slate-800'} shadow-sm`}>
                                                <CreditCard size={20} className={paymentMethod === 'card' ? 'text-primary dark:text-blue-400' : 'text-slate-400'} />
                                            </div>
                                            <div className="text-left flex-1">
                                                <p className="font-black text-xs dark:text-slate-100 uppercase italic tracking-tight">Tarjeta Bancard</p>
                                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                                                    {cards.length > 0 ? `${cards.length} tarjeta(s) registrada(s)` : 'Sin tarjetas — agregá una primero'}
                                                </p>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'card' ? 'border-primary dark:border-blue-500 bg-primary dark:bg-blue-500' : 'border-slate-200 dark:border-slate-700'
                                                }`}>
                                                {paymentMethod === 'card' && <Check size={10} className="text-white" />}
                                            </div>
                                        </button>

                                        {/* Transfer option */}
                                        <button
                                            onClick={() => setPaymentMethod('transfer')}
                                            className={`w-full p-4 rounded-[1.5rem] flex items-center gap-4 border transition-all ${paymentMethod === 'transfer'
                                                ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-500/10'
                                                : 'border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/30'
                                                }`}
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === 'transfer' ? 'bg-primary/10 dark:bg-blue-500/20' : 'bg-white dark:bg-slate-800'} shadow-sm`}>
                                                <Banknote size={20} className={paymentMethod === 'transfer' ? 'text-primary dark:text-blue-400' : 'text-slate-400'} />
                                            </div>
                                            <div className="text-left flex-1">
                                                <p className="font-black text-xs dark:text-slate-100 uppercase italic tracking-tight">Transferencia Flash</p>
                                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">Acreditación instantánea</p>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'transfer' ? 'border-primary dark:border-blue-500 bg-primary dark:bg-blue-500' : 'border-slate-200 dark:border-slate-700'
                                                }`}>
                                                {paymentMethod === 'transfer' && <Check size={10} className="text-white" />}
                                            </div>
                                        </button>
                                    </div>

                                    {/* Card selector if card method */}
                                    {paymentMethod === 'card' && cards.length > 0 && (
                                        <div className="mb-6">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3 px-1">Seleccionar tarjeta</p>
                                            <div className="space-y-2">
                                                {cards.map((card: any) => (
                                                    <button
                                                        key={card.id}
                                                        onClick={() => setSelectedCard(card.id)}
                                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedCard === card.id
                                                            ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-500/10'
                                                            : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'
                                                            }`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white ${card.brand?.toLowerCase().includes('visa') ? 'bg-blue-600' :
                                                            card.brand?.toLowerCase().includes('master') ? 'bg-red-500' : 'bg-slate-600'
                                                            }`}>
                                                            {card.brand?.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="flex-1 text-left">
                                                            <p className="text-xs font-bold text-slate-800 dark:text-white">•••• {card.maskedNumber?.slice(-4) || '****'}</p>
                                                            <p className="text-[10px] text-slate-400">{card.brand} {card.isPrimary ? '· Principal' : ''}</p>
                                                        </div>
                                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedCard === card.id ? 'border-primary bg-primary' : 'border-slate-200 dark:border-slate-700'
                                                            }`}>
                                                            {selectedCard === card.id && <Check size={8} className="text-white" />}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {paymentMethod === 'card' && cards.length === 0 && (
                                        <button
                                            onClick={() => { setShowRechargeModal(false); handleAddCard(); }}
                                            disabled={cardRegistrationLoading}
                                            className="w-full mb-6 p-4 rounded-[1.5rem] bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-center text-xs font-bold active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                        >
                                            {cardRegistrationLoading
                                                ? <><Loader2 size={14} className="animate-spin" /> Iniciando catastro…</>
                                                : '⚠️ Agregá una tarjeta primero →'
                                            }
                                        </button>
                                    )}

                                    <button
                                        onClick={handleRecharge}
                                        disabled={(!selectedAmount && !customAmount) || (paymentMethod === 'card' && (!selectedCard || cards.length === 0))}
                                        className="w-full py-5 bg-primary dark:bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[10px] disabled:opacity-20 hover:shadow-2xl hover:shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        Confirmar Recarga <ArrowUpRight size={16} />
                                    </button>
                                </>
                            )}

                            {step === 'processing' && (
                                <div className="text-center py-14">
                                    <Loader2 size={48} className="text-primary dark:text-blue-400 animate-spin mx-auto mb-6" />
                                    <h3 className="font-headline text-xl font-black text-slate-900 dark:text-white italic uppercase tracking-tighter mb-2">Procesando…</h3>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Contactando pasarela de pagos Bancard</p>
                                </div>
                            )}

                            {step === 'success' && (
                                <div className="text-center py-10">
                                    <motion.div
                                        initial={{ scale: 0, rotate: -45 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/20"
                                    >
                                        <CheckCircle2 size={48} className="text-emerald-500" />
                                    </motion.div>
                                    <h3 className="font-headline text-3xl font-black mb-3 dark:text-white italic uppercase tracking-tighter">¡Listo!</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed px-4">
                                        Tu recarga se acreditó exitosamente.
                                    </p>
                                    <div className="mt-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3 border border-emerald-100 dark:border-emerald-500/20 inline-block">
                                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Nuevo saldo: {formatGs(balance)}</p>
                                    </div>
                                </div>
                            )}

                            {step === 'error' && (
                                <div className="text-center py-10">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20"
                                    >
                                        <AlertCircle size={48} className="text-red-500" />
                                    </motion.div>
                                    <h3 className="font-headline text-xl font-black mb-3 text-red-600 dark:text-red-400 italic uppercase tracking-tighter">Error</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed px-4 mb-6">{errorMsg}</p>
                                    <button
                                        onClick={() => setStep('amount')}
                                        className="px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-300 active:scale-95 transition-all"
                                    >
                                        Volver a intentar
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
});

export default Billetera;
