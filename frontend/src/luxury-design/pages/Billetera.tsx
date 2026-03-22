import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, Clock, X, CreditCard, CheckCircle2 } from 'lucide-react';

const mockTransactions = [
    { id: 1, type: 'in', desc: 'Recarga de saldo', amount: 50000, date: '20 Mar 2026', status: 'completado' },
    { id: 2, type: 'out', desc: 'Lavado Premium - Porsche 911', amount: 25000, date: '18 Mar 2026', status: 'completado' },
    { id: 3, type: 'in', desc: 'Bono por referido - Carlos M.', amount: 10000, date: '15 Mar 2026', status: 'completado' },
    { id: 4, type: 'out', desc: 'Tratamiento Cerámico', amount: 80000, date: '10 Mar 2026', status: 'completado' },
];

const rechargeOptions = [20000, 50000, 100000, 200000];

export default function Billetera() {
    const [balance] = useState(0);
    const [showRechargeModal, setShowRechargeModal] = useState(false);
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [customAmount, setCustomAmount] = useState('');
    const [step, setStep] = useState<'amount' | 'success'>('amount');

    const handleRecharge = () => {
        if (!selectedAmount && !customAmount) return;
        setStep('success');
        setTimeout(() => {
            setShowRechargeModal(false);
            setStep('amount');
            setSelectedAmount(null);
            setCustomAmount('');
        }, 2500);
    };

    const formatGs = (n: number) => `₲ ${n.toLocaleString('es-PY')}`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
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
                        <div className="text-right">
                            <div className="px-3 py-1 bg-white/5 rounded-full text-[8px] font-black tracking-widest uppercase border border-white/10">
                                Verificado
                            </div>
                        </div>
                    </div>

                    <div className="mb-10">
                        <p className="text-5xl font-headline font-black tracking-tighter italic">{formatGs(balance)}</p>
                        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1 ml-1">Saldo Disponible</p>
                    </div>

                    <button
                        onClick={() => setShowRechargeModal(true)}
                        className="w-full flex items-center justify-center gap-2 bg-[#00d2ff] hover:bg-secondary text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-2xl shadow-[#00d2ff]/20"
                    >
                        <Plus size={18} />
                        Recargar Fondos
                    </button>
                </div>
            </div>

            {/* In/Out Summary */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm text-center transition-all hover:bg-white dark:hover:bg-slate-900/60">
                    <p className="text-2xl font-headline font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">{formatGs(60000)}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">Ingresos / Mes</p>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm text-center transition-all hover:bg-white dark:hover:bg-slate-900/60">
                    <p className="text-2xl font-headline font-black text-red-500 dark:text-red-400 tracking-tighter">{formatGs(105000)}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">Gastos / Mes</p>
                </div>
            </div>

            {/* Transactions */}
            <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-headline text-[10px] font-black flex items-center gap-2 text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                        <Clock size={16} className="text-primary dark:text-blue-400" /> Movimientos Recientes
                    </h3>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse opacity-40" />
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {mockTransactions.map((t) => (
                        <div key={t.id} className="flex items-center gap-4 p-5 hover:bg-white dark:hover:bg-slate-800/40 transition-all group">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-transparent transition-all group-hover:scale-110 ${t.type === 'in'
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:border-emerald-500/20'
                                    : 'bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 group-hover:border-red-500/20'}`}
                            >
                                {t.type === 'in'
                                    ? <ArrowDownLeft size={22} strokeWidth={2.5} />
                                    : <ArrowUpRight size={22} strokeWidth={2.5} />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-sm text-slate-900 dark:text-slate-100 tracking-tight leading-tight uppercase italic">{t.desc}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5 tracking-wider">{t.date}</p>
                            </div>
                            <div className="text-right">
                                <p className={`font-black tracking-tighter text-lg ${t.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-200'}`}>
                                    {t.type === 'in' ? '+' : '-'}{formatGs(t.amount)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recharge Modal */}
            <AnimatePresence>
                {showRechargeModal && (
                    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-lg z-[200] flex items-end md:items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 100 }}
                            className="bg-white dark:bg-slate-950 rounded-[3rem] p-8 w-full max-w-md shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-slate-100 dark:border-slate-800 overflow-hidden relative"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary opacity-50" />

                            {step === 'amount' ? (
                                <>
                                    <div className="flex justify-between items-center mb-8">
                                        <h3 className="font-headline text-2xl font-black text-slate-900 dark:text-white italic uppercase tracking-tighter">Recarga LUXU</h3>
                                        <button onClick={() => setShowRechargeModal(false)} className="p-2 bg-slate-50 dark:bg-white/5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                                            <X size={20} className="text-slate-400" />
                                        </button>
                                    </div>

                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-5 px-1">Seleccioná un monto</p>
                                    <div className="grid grid-cols-2 gap-3 mb-8">
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

                                    <div className="mb-8">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block mb-3 px-1">O monto manual</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                placeholder="₲ 0"
                                                value={customAmount}
                                                onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                                                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/80 dark:text-white rounded-[1.25rem] border-none focus:ring-2 focus:ring-primary/20 font-black text-xl transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-5 bg-slate-50 dark:bg-white/5 rounded-[1.5rem] flex items-center gap-4 mb-8 border border-slate-100 dark:border-white/5">
                                        <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                                            <CreditCard size={20} className="text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="font-black text-xs dark:text-slate-100 uppercase italic tracking-tight">Transferencia Flash</p>
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Acreditación Instantánea</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleRecharge}
                                        disabled={!selectedAmount && !customAmount}
                                        className="w-full py-5 bg-primary dark:bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[10px] disabled:opacity-20 hover:shadow-2xl hover:shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        Confirmar Recarga <ArrowUpRight size={16} />
                                    </button>
                                </>
                            ) : (
                                <div className="text-center py-10">
                                    <motion.div
                                        initial={{ scale: 0, rotate: -45 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/20"
                                    >
                                        <CheckCircle2 size={48} className="text-emerald-500" />
                                    </motion.div>
                                    <h3 className="font-headline text-3xl font-black mb-3 dark:text-white italic uppercase tracking-tighter">¡Listo!</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed px-4">Tu solicitud de recarga está en proceso. El saldo se reflejará en instantes.</p>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
