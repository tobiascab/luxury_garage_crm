import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Plus, Trash2, Star, RefreshCw, Shield, AlertCircle, ExternalLink, CheckCircle2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_URL } from '../config';
import api from '../../services/api';

interface TarjetasProps {
    user: any;
    onUpdate?: () => void;
}

export default function Tarjetas({ user, onUpdate }: TarjetasProps) {
    const [cards, setCards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [cardRegistration, setCardRegistration] = useState<{ processId: string; jsLibUrl: string } | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null);
    const [paymentStatus, setPaymentStatus] = useState<any>(null);
    const [error, setError] = useState('');
    const [needsCI, setNeedsCI] = useState(false);
    const [ciInput, setCiInput] = useState('');
    const [savingCI, setSavingCI] = useState(false);

    const token = localStorage.getItem('luxury_token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const loadCards = useCallback(async () => {
        try {
            const res = await api.get('/payments/cards');
            const data = res.data;
            if (data.success) setCards(data.data || []);
        } catch { /* silent */ }
        setLoading(false);
    }, []);

    const loadStatus = useCallback(async () => {
        try {
            const res = await api.get('/payments/status');
            const data = res.data;
            if (data.success) {
                setPaymentStatus(data.data);
                if (!data.data.hasDocumentNumber) setNeedsCI(true);
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        loadCards();
        loadStatus();
    }, []);

    useEffect(() => {
        if (!cardRegistration) return;
        const handleMessage = async (event: MessageEvent) => {
            if (event.data?.status === 'add_new_card_success') {
                try {
                    await api.post('/payments/card/sync');
                    toast.success('¡Tarjeta agregada!');
                    loadCards();
                } catch { toast.error('Error al sincronizar tarjeta'); }
                finally { setCardRegistration(null); }
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
                const styles = { 'form-background-color': '#0f172a', 'button-background-color': '#8b5cf6', 'button-text-color': '#ffffff', 'input-background-color': '#1e293b', 'input-text-color': '#f1f5f9' };
                (window as any).Bancard.Cards.createForm('bancard-iframe-container-tarjetas', cardRegistration.processId, styles);
            }
        };
        document.head.appendChild(script);
        return () => {
            window.removeEventListener('message', handleMessage);
            const s = document.querySelector(`script[src="${cardRegistration.jsLibUrl}"]`);
            if (s) document.head.removeChild(s);
        };
    }, [cardRegistration]);

    const saveCI = async () => {
        if (!ciInput.trim() || ciInput.length < 5) return;
        setSavingCI(true);
        setError('');
        try {
            const res = await api.post('/payments/sync-customer', { documentNumber: ciInput.trim(), documentType: 'CI' });
            const data = res.data;
            if (data.success) {
                setNeedsCI(false);
                onUpdate?.();
            } else {
                setError(data.message || 'Error guardando cédula');
            }
        } catch { setError('Error de conexión'); }
        setSavingCI(false);
    };

    const handleAddCard = async () => {
        setRegistering(true);
        try {
            const res = await api.post('/payments/card/register', {
                returnUrl: window.location.origin + '/tarjetas',
            });
            const { processId, jsLibUrl } = res.data.data;
            setCardRegistration({ processId, jsLibUrl });
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error al iniciar catastro');
        } finally {
            setRegistering(false);
        }
    };

    const syncCards = async () => {
        setSyncing(true);
        setError('');
        try {
            const res = await api.post('/payments/card/sync');
            const data = res.data;
            if (data.success) {
                setCards(data.data || []);
            } else {
                setError(data.message || 'Error sincronizando');
            }
        } catch { setError('Error de conexión'); }
        setSyncing(false);
    };

    const deleteCard = async (card: any) => {
        setDeleting(card.id);
        try {
            const res = await api.delete(`/payments/card/${card.id}`);
            const data = res.data;
            if (data.success) {
                setCards(prev => prev.filter(c => c.id !== card.id));
            }
        } catch { /* silent */ }
        setDeleting(null);
        setShowDeleteConfirm(null);
    };

    const setPrimary = async (cardId: string) => {
        try {
            const res = await api.post('/payments/card/set-primary', { cardId });
            const data = res.data;
            if (data.success) {
                setCards(prev => prev.map(c => ({ ...c, isPrimary: c.id === cardId })));
            }
        } catch { /* silent */ }
    };

    const getBrandColor = (brand: string) => {
        const b = brand?.toLowerCase() || '';
        if (b.includes('visa')) return 'from-blue-600 to-blue-800';
        if (b.includes('master')) return 'from-red-500 to-orange-600';
        if (b.includes('amex')) return 'from-sky-500 to-cyan-600';
        return 'from-slate-600 to-slate-800';
    };

    const getBrandLogo = (brand: string) => {
        const b = brand?.toLowerCase() || '';
        if (b.includes('visa')) return 'VISA';
        if (b.includes('master')) return 'MC';
        if (b.includes('amex')) return 'AMEX';
        return brand?.toUpperCase()?.substring(0, 4) || 'CARD';
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 animate-pulse">Cargando tarjetas…</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4 pb-24"
        >
            {/* Header */}
            <div className="text-center">
                <h1 className="font-headline text-2xl font-extrabold tracking-tight dark:text-white">💳 Mis Tarjetas</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gestioná tus métodos de pago</p>
            </div>

            {/* Error */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl p-4 flex items-center gap-3"
                    >
                        <AlertCircle size={18} className="text-red-500 shrink-0" />
                        <p className="text-xs text-red-700 dark:text-red-300 font-medium flex-1">{error}</p>
                        <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* CI Required */}
            {needsCI && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl p-5"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <Shield size={18} className="text-amber-600 dark:text-amber-400" />
                        <p className="font-bold text-sm text-amber-800 dark:text-amber-200">Cédula requerida</p>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-300/70 mb-4">
                        Para registrar una tarjeta, primero necesitamos tu número de cédula (CI).
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Ej: 4567890"
                            value={ciInput}
                            onChange={(e) => setCiInput(e.target.value.replace(/\D/g, ''))}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                        />
                        <button
                            onClick={saveCI}
                            disabled={savingCI || ciInput.length < 5}
                            className="px-5 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-xs uppercase tracking-widest disabled:opacity-50 active:scale-95 transition-all"
                        >
                            {savingCI ? '...' : 'Guardar'}
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Cards List */}
            {cards.length > 0 && (
                <div className="space-y-3">
                    {cards.map((card, i) => (
                        <motion.div
                            key={card.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={`relative overflow-hidden rounded-[1.5rem] border shadow-sm transition-all ${card.isPrimary
                                    ? 'border-primary/30 dark:border-blue-500/30 shadow-primary/10'
                                    : 'border-slate-100 dark:border-slate-800'
                                }`}
                        >
                            {/* Card visual */}
                            <div className={`bg-gradient-to-br ${getBrandColor(card.brand)} p-5 text-white relative`}>
                                {card.isPrimary && (
                                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                                        <Star size={8} fill="currentColor" /> Principal
                                    </div>
                                )}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{card.cardType || 'Tarjeta'}</p>
                                        <p className="font-headline text-lg font-black tracking-wider mt-1">
                                            •••• •••• •••• {card.maskedNumber?.slice(-4) || '****'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black font-headline opacity-90">{getBrandLogo(card.brand)}</p>
                                        <p className="text-[9px] opacity-50 mt-0.5">{card.issuer || ''}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Card actions */}
                            <div className="bg-white dark:bg-slate-900/40 p-3 flex items-center justify-between">
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate flex-1">
                                    {card.alias || `${card.brand} ${card.maskedNumber?.slice(-4) || ''}`}
                                </p>
                                <div className="flex items-center gap-2">
                                    {!card.isPrimary && (
                                        <button
                                            onClick={() => setPrimary(card.id)}
                                            className="text-xs text-primary dark:text-blue-400 font-bold px-3 py-1.5 rounded-lg hover:bg-primary/5 dark:hover:bg-blue-500/10 transition-all"
                                        >
                                            Principal
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowDeleteConfirm(card)}
                                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {cards.length === 0 && !needsCI && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12"
                >
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                        <CreditCard size={28} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">Sin tarjetas registradas</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Agregá una tarjeta para pagar tus membresías</p>
                </motion.div>
            )}

            {/* Action Buttons */}
            {!needsCI && (
                <div className="space-y-3">
                    {/* Register card */}
                    <button
                        onClick={handleAddCard}
                        disabled={registering || !paymentStatus?.configured}
                        className="w-full py-3.5 rounded-2xl bg-primary dark:bg-blue-500 text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20 dark:shadow-blue-500/20 disabled:opacity-50"
                    >
                        {registering ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Plus size={16} />
                        )}
                        {registering ? 'Procesando...' : 'Agregar Tarjeta'}
                    </button>

                    {/* Sync cards */}
                    <button
                        onClick={syncCards}
                        disabled={syncing}
                        className="w-full py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:border-primary/30 dark:hover:border-blue-500/30 hover:text-primary dark:hover:text-blue-400 active:scale-95 transition-all"
                    >
                        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Sincronizando...' : 'Sincronizar Tarjetas'}
                    </button>

                    {!paymentStatus?.configured && (
                        <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 font-medium">
                            ⚙️ Bancard no configurado. Contactá al administrador.
                        </p>
                    )}
                </div>
            )}

            {/* Security info */}
            <div className="bg-slate-50 dark:bg-slate-900/40 rounded-[1.5rem] p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                    <Shield size={14} className="text-emerald-500" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Pagos Seguros</p>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Tus datos de tarjeta se procesan de forma segura a través de Bancard. Luxury Garage nunca almacena los datos completos de tu tarjeta.
                </p>
            </div>

            {/* Bancard iframe modal */}
            {cardRegistration && (
                <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-slate-900 rounded-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800">
                            <h3 className="font-bold text-white flex items-center gap-2"><CreditCard size={18} /> Agregar tarjeta</h3>
                            <button onClick={() => setCardRegistration(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div id="bancard-iframe-container-tarjetas" className="p-4 min-h-[400px]" />
                        <p className="text-xs text-slate-500 text-center pb-4">Pago seguro procesado por Bancard</p>
                    </div>
                </div>
            )}

            {/* Delete confirmation modal */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDeleteConfirm(null)}
                            className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="relative z-10 bg-white dark:bg-slate-900 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
                        >
                            <div className="text-center mb-5">
                                <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                                    <Trash2 size={24} className="text-red-500" />
                                </div>
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white">¿Eliminar tarjeta?</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {showDeleteConfirm.brand} terminada en {showDeleteConfirm.maskedNumber?.slice(-4)}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(null)}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => deleteCard(showDeleteConfirm)}
                                    disabled={deleting === showDeleteConfirm.id}
                                    className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {deleting ? '...' : 'Eliminar'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
