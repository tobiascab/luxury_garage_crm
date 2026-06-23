import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import useScrollLock from '../hooks/useScrollLock';

/**
 * ConfirmDialog — diálogo de confirmación para acciones (sobre todo destructivas).
 *
 * Centrado, compacto, con icono según variante, mensaje y botones
 * Cancelar / Confirmar. Soporta estado `loading` (spinner + bloqueo) para
 * confirmaciones asíncronas. Se cierra con Escape o overlay salvo si está loading.
 *
 * Props:
 *  - isOpen        boolean
 *  - onClose       fn()       — cancelar / cerrar
 *  - onConfirm     fn()       — acción a confirmar (puede ser async)
 *  - title         string
 *  - message       string | node
 *  - confirmLabel  string     — default 'Confirmar' ('Eliminar' si variant danger y no se pasa)
 *  - cancelLabel   string     — default 'Cancelar'
 *  - variant       'danger' | 'primary'   — color del botón confirmar (default 'danger')
 *  - loading       boolean
 *
 * Uso:
 *  <ConfirmDialog isOpen={!!toDelete} onClose={() => setToDelete(null)}
 *    onConfirm={confirmDelete} loading={deleting} variant="danger"
 *    title="Eliminar servicio"
 *    message={`¿Seguro que querés eliminar "${toDelete?.name}"? Esta acción no se puede deshacer.`} />
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Estás seguro?',
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
}) {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };

  const handleClose = useCallback(() => {
    if (!loading) onClose?.();
  }, [loading, onClose]);

  useScrollLock(isOpen);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, handleClose]);

  const isDanger = variant === 'danger';
  const finalConfirmLabel = confirmLabel || (isDanger ? 'Eliminar' : 'Confirmar');
  const confirmBtn = isDanger
    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 p-6"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <span
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                  isDanger
                    ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500'
                    : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500'
                }`}
              >
                <AlertTriangle size={22} />
              </span>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
              {message && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{message}</p>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <motion.button
                type="button"
                onClick={handleClose}
                disabled={loading}
                whileTap={tap}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {cancelLabel}
              </motion.button>
              <motion.button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                whileTap={loading ? undefined : tap}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${confirmBtn}`}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {finalConfirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
