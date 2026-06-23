import React from 'react';
import { motion, AnimatePresence } from '../lib/motion';
import { Loader2, Check, X } from 'lucide-react';
import useScrollLock from '../../hooks/useScrollLock';

export type PayPhase = 'processing' | 'success' | 'error' | null;

interface PaymentResultOverlayProps {
  phase: PayPhase;
  /** Texto secundario (en éxito) o mensaje de error. */
  message?: string;
  successText?: string;
  onClose?: () => void;
  onRetry?: () => void;
  /** CTA primaria opcional en error (ej. "Agregar tarjeta"). Tiene prioridad sobre Reintentar. */
  primaryLabel?: string;
  onPrimary?: () => void;
}

/**
 * Overlay reutilizable de resultado de pago: procesando → aceptado (✓ verde, pop) /
 * rechazado (✗ rojo, shake). Lo usan todos los cobros (membresía, recarga, etc.).
 */
export default function PaymentResultOverlay({
  phase,
  message,
  successText = '¡Pago aceptado!',
  onClose,
  onRetry,
}: PaymentResultOverlayProps) {
  // Bloquea el scroll del fondo mientras el overlay de resultado está visible.
  useScrollLock(!!phase);

  return (
    <AnimatePresence>
      {phase && (
        <motion.div
          className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-3xl p-8 text-center shadow-2xl"
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            {phase === 'processing' && (
              <>
                <Loader2 size={44} className="text-primary animate-spin mx-auto mb-4" />
                <p className="font-bold text-slate-900 dark:text-white">Procesando pago…</p>
                <p className="text-xs text-slate-400 mt-1">No cierres esta ventana</p>
              </>
            )}

            {phase === 'success' && (
              <>
                <motion.div
                  className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/30"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                >
                  <motion.span
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.12, type: 'spring', stiffness: 300, damping: 18 }}
                  >
                    <Check size={42} className="text-white" strokeWidth={3} />
                  </motion.span>
                </motion.div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">{successText}</h3>
                {message && <p className="text-sm text-slate-500 mt-1">{message}</p>}
                <button
                  onClick={onClose}
                  className="mt-6 w-full h-11 rounded-2xl bg-emerald-500 text-white text-sm font-bold active:scale-95 transition-transform"
                >
                  Listo
                </button>
              </>
            )}

            {phase === 'error' && (
              <>
                <motion.div
                  className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-500/30"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, x: [0, -8, 8, -6, 6, 0] }}
                  transition={{ scale: { type: 'spring', stiffness: 260, damping: 16 }, x: { delay: 0.15, duration: 0.4 } }}
                >
                  <X size={42} className="text-white" strokeWidth={3} />
                </motion.div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Pago rechazado</h3>
                <p className="text-sm text-slate-500 mt-1">{message || 'No se pudo procesar el pago.'}</p>
                <div className="mt-6 flex gap-2">
                  <button
                    onClick={onClose}
                    className="flex-1 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300"
                  >
                    Cerrar
                  </button>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="flex-1 h-11 rounded-2xl bg-primary text-white text-sm font-bold active:scale-95 transition-transform"
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
