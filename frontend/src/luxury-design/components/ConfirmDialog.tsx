import React, { useState } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence, springPop, useReduce } from '../lib/motion';
import useScrollLock from '../../hooks/useScrollLock';

export interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    message?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    /** 'danger' = acción destructiva (rojo); 'default' = acción normal (primario). */
    variant?: 'danger' | 'default';
    icon?: React.ReactNode;
}

/**
 * Diálogo de confirmación centrado y animado para acciones importantes
 * (eliminar, cancelar, etc.). Reemplaza al window.confirm() nativo con una
 * experiencia premium y coherente con el resto del app cliente.
 */
export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'danger',
    icon,
}: ConfirmDialogProps) {
    const reduce = useReduce();
    const [loading, setLoading] = useState(false);

    useScrollLock(isOpen);

    const handleConfirm = async () => {
        try {
            setLoading(true);
            await onConfirm();
        } finally {
            setLoading(false);
        }
    };

    const isDanger = variant === 'danger';

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[350] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={() => !loading && onClose()}
                        className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 12 }}
                        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }}
                        transition={reduce ? { duration: 0.18 } : springPop}
                        className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
                    >
                        <button
                            onClick={() => !loading && onClose()}
                            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label="Cerrar"
                        >
                            <X size={18} />
                        </button>

                        <div className="px-7 pt-8 pb-7 text-center">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${isDanger
                                ? 'bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400'
                                : 'bg-primary/10 dark:bg-blue-500/10 text-primary dark:text-blue-400'}`}>
                                {icon ?? <AlertTriangle size={28} />}
                            </div>

                            <h3 className="font-headline text-xl font-black text-slate-900 dark:text-white tracking-tight">{title}</h3>
                            {message && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{message}</p>
                            )}

                            <div className="flex gap-3 mt-7">
                                <button
                                    onClick={() => !loading && onClose()}
                                    disabled={loading}
                                    className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={loading}
                                    className={`flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[11px] text-white shadow-lg transition-colors disabled:opacity-70 flex items-center justify-center gap-2 ${isDanger
                                        ? 'bg-red-500 hover:bg-red-600 shadow-red-500/25'
                                        : 'bg-primary dark:bg-blue-500 hover:brightness-110 shadow-primary/25'}`}
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : confirmText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
