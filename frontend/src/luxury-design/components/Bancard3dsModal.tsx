import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from '../lib/motion';
import { ShieldCheck, X } from 'lucide-react';
import useScrollLock from '../../hooks/useScrollLock';
import type { Bancard3dsHandlers, ThreeDsContext } from '../lib/bancardPayment';

/**
 * Hook + modal reutilizable para el desafío 3DS de Bancard.
 *
 * Devuelve:
 *  - `handlers`: el contrato `Bancard3dsHandlers` que espera `runBancardPayment`
 *    (monta el div del iframe, espera a que termine y limpia).
 *  - `modal`: el JSX del overlay con el contenedor del iframe (renderizalo en la página).
 *
 * El cierre del flujo 3DS se detecta de dos formas, ambas resuelven la promesa `waitForDone`:
 *  1. Bancard redirige el iframe al `returnUrl` del backend y emite un `postMessage`
 *     (`{ type: 'bancard-... }`) o navega el iframe a una URL del propio dominio.
 *  2. El usuario cierra manualmente el modal (botón ✕), tras lo cual el backend verifica
 *     el estado real del cobro contra Bancard (la confirmación es la fuente de verdad).
 */
const CONTAINER_ID = 'bancard-3ds-container';

export function useBancard3ds(): { handlers: Bancard3dsHandlers; modal: React.ReactNode } {
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<(() => void) | null>(null);

  const resolveDone = useCallback(() => {
    if (resolveRef.current) {
      const r = resolveRef.current;
      resolveRef.current = null;
      r();
    }
  }, []);

  const handlers: Bancard3dsHandlers = {
    mount: (_ctx: ThreeDsContext) =>
      new Promise<string>((resolve) => {
        setOpen(true);
        // Esperamos un tick para que el contenedor exista en el DOM antes de que
        // el SDK monte el iframe dentro.
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(CONTAINER_ID)));
      }),
    waitForDone: () =>
      new Promise<void>((resolve) => {
        resolveRef.current = resolve;
        // Escuchamos el postMessage que emite el iframe de Bancard al completar el 3DS.
        // TODO: verificar API exacta de Bancard checkout 4.0.0 — confirmar el shape del
        // mensaje (origen vpos.infonet.com.py y payload). Mientras tanto, también se
        // resuelve al cerrar el modal manualmente (la confirmación backend es la verdad).
        const onMessage = (e: MessageEvent) => {
          const d = e.data;
          const isBancard =
            (typeof d === 'string' && /bancard|process_id|confirm/i.test(d)) ||
            (d && typeof d === 'object' && /bancard/i.test(JSON.stringify(d)));
          if (isBancard) {
            window.removeEventListener('message', onMessage);
            resolve();
          }
        };
        window.addEventListener('message', onMessage);
      }),
    cleanup: () => {
      setOpen(false);
      // Vaciar el contenedor del iframe de forma segura (sin innerHTML).
      const el = document.getElementById(CONTAINER_ID);
      el?.replaceChildren();
    },
  };

  const modal = (
    <AnimatePresence>
      {open && (
        <BancardModalView
          onClose={() => {
            // Cierre manual → resolvemos para que el caller confirme contra el backend.
            resolveDone();
          }}
        />
      )}
    </AnimatePresence>
  );

  return { handlers, modal };
}

function BancardModalView({ onClose }: { onClose: () => void }) {
  useScrollLock(true);
  return (
    <motion.div
      className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto overscroll-contain"
        initial={{ y: '100%', opacity: 0.6, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-500" />
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Verificación de seguridad</h4>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Tu banco necesita confirmar el pago. Completá la verificación en el recuadro de abajo.
        </p>
        {/* Contenedor donde el SDK de Bancard monta el iframe 3DS. */}
        <div id={CONTAINER_ID} className="min-h-[360px] w-full rounded-2xl overflow-hidden" />
      </motion.div>
    </motion.div>
  );
}
