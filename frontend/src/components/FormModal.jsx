import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import useScrollLock from '../hooks/useScrollLock';

/**
 * FormModal — modal de creación/edición para el panel admin.
 *
 * Es un Modal con cabecera (título + subtítulo + botón cerrar), cuerpo
 * scrolleable para el formulario y footer con botones Cancelar / Guardar.
 * Maneja el estado `submitting` (spinner + deshabilita botones) y se cierra
 * con Escape o click en el overlay (salvo que esté enviando).
 *
 * IMPORTANTE: envolvé tu contenido en un <form id={formId}> y pasá el mismo
 * `formId` para que el botón Guardar (type="submit", form=formId) dispare el
 * submit del form. Alternativamente pasá `onSubmit` y el botón será un botón
 * normal que lo invoca.
 *
 * Props:
 *  - isOpen        boolean
 *  - onClose       fn()              — cerrar (cancelar)
 *  - title         string
 *  - subtitle      string?           — texto secundario bajo el título
 *  - icon          node?             — icono lucide a la izquierda del título
 *  - children      nodes             — el formulario
 *  - onSubmit      fn(e)?            — si se pasa, el botón Guardar lo llama (no usa form id)
 *  - formId        string?           — id del <form> interno para submit nativo
 *  - submitting    boolean           — muestra spinner y bloquea acciones
 *  - submitLabel   string            — texto del botón primario (default 'Guardar')
 *  - cancelLabel   string            — texto del botón secundario (default 'Cancelar')
 *  - submitDisabled boolean          — deshabilita Guardar sin estar submitting
 *  - size          'sm'|'md'|'lg'|'xl'  — ancho máx (default 'md')
 *  - hideFooter    boolean           — oculta el footer (si el form trae sus propios botones)
 *
 * Uso:
 *  <FormModal isOpen={open} onClose={close} title="Nuevo plan"
 *    formId="plan-form" submitting={saving} submitLabel="Crear">
 *    <form id="plan-form" onSubmit={handleSubmit} className="space-y-4">
 *      <FormField label="Nombre" ... />
 *    </form>
 *  </FormModal>
 */
const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function FormModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  onSubmit,
  formId,
  submitting = false,
  submitLabel = 'Guardar',
  cancelLabel = 'Cancelar',
  submitDisabled = false,
  size = 'md',
  hideFooter = false,
}) {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };

  const handleClose = useCallback(() => {
    if (!submitting) onClose?.();
  }, [submitting, onClose]);

  useScrollLock(isOpen);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, handleClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`w-full ${sizeMap[size] || sizeMap.md} max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden`}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3 min-w-0">
                {icon && (
                  <span className="shrink-0 w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    {icon}
                  </span>
                )}
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">{title}</h3>
                  {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
                </div>
              </div>
              <motion.button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                aria-label="Cerrar"
                whileTap={tap}
                className="shrink-0 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

            {/* Footer */}
            {!hideFooter && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02]">
                <motion.button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  whileTap={tap}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  {cancelLabel}
                </motion.button>
                <motion.button
                  type={formId ? 'submit' : 'button'}
                  form={formId}
                  onClick={!formId ? onSubmit : undefined}
                  disabled={submitting || submitDisabled}
                  whileTap={submitting || submitDisabled ? undefined : tap}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {submitLabel}
                </motion.button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
