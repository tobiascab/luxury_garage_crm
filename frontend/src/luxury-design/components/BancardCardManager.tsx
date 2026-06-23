import React, { useEffect, useState, useCallback, useRef } from 'react';
import { CreditCard, Trash2, Loader2, Plus, ShieldCheck, AlertTriangle, X, Star } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { CardBrand } from './AnimatedCardPreview';
import { motion, AnimatePresence } from '../lib/motion';
import useScrollLock from '../../hooks/useScrollLock';
import { loadBancardScript } from '../lib/bancardPayment';

/**
 * Gestión de medios de pago con Bancard VPOS.
 * - Estado de configuración: GET /payments/status (configured:boolean).
 * - Listar: GET /payments/cards (devuelve registros locales con maskedNumber/brand/isPrimary…).
 * - Alta (catastro): POST /payments/card/register → { processId, jsLibUrl } → Bancard.Cards.createForm
 *   monta el iframe seguro de Bancard donde el usuario carga la tarjeta (PCI). Al terminar
 *   sincronizamos con POST /payments/card/sync y refrescamos la lista.
 * - Eliminar: DELETE /payments/card/:cardId.
 * - Marcar principal: POST /payments/card/set-primary { cardId }.
 */

interface BancardCardManagerProps {
  onChange?: () => void;
  className?: string;
}

const BRAND_GRADIENT: Record<string, string> = {
  visa: 'from-blue-700 via-blue-800 to-indigo-900',
  mastercard: 'from-red-600 via-orange-600 to-amber-700',
  amex: 'from-sky-600 via-cyan-700 to-teal-800',
  discover: 'from-orange-500 via-orange-600 to-red-700',
};
const gradientFor = (brand?: string) => BRAND_GRADIENT[(brand || '').toLowerCase()] || 'from-slate-700 via-slate-800 to-slate-900';

// Normaliza la marca que devuelve Bancard a la del preview (no se usa el preview animado
// en la lista, pero mantenemos el helper por consistencia).
const BANCARD_BRAND: Record<string, CardBrand> = { visa: 'visa', mastercard: 'mastercard', amex: 'amex', discover: 'discover' };
export const mapBancardBrand = (b?: string): CardBrand => (b && BANCARD_BRAND[b.toLowerCase()]) || 'unknown';

// id del contenedor donde Bancard monta el iframe de catastro.
const REGISTER_CONTAINER_ID = 'bancard-register-container';

export default function BancardCardManager({ onChange, className = '' }: BancardCardManagerProps) {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);

  const [cards, setCards] = useState<any[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);

  // Guarda si el catastro llegó a montar el iframe (para sincronizar al cerrar).
  const mountedFormRef = useRef(false);

  useScrollLock(showForm);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get('/payments/status', { _noCache: true } as any);
      setConfigured(!!res.data?.data?.configured);
    } catch {
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCards = useCallback(async () => {
    try {
      const res = await api.get('/payments/cards', { _noCache: true } as any);
      setCards(res.data?.data || []);
    } catch {
      /* silencioso */
    } finally {
      setLoadingCards(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { if (configured) loadCards(); else setLoadingCards(false); }, [configured, loadCards]);

  // ── Catastro de tarjeta: inicia el proceso y monta el iframe de Bancard ──
  const openForm = async () => {
    setRegistering(true);
    mountedFormRef.current = false;
    try {
      const res = await api.post('/payments/card/register');
      const { processId, jsLibUrl } = res.data?.data || {};
      if (!processId || !jsLibUrl) throw new Error('No se pudo iniciar el registro de la tarjeta.');

      setShowForm(true);
      const sdk = await loadBancardScript(jsLibUrl);
      // Esperamos a que el contenedor exista en el DOM.
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      if (sdk.Cards && typeof sdk.Cards.createForm === 'function') {
        sdk.Cards.createForm(REGISTER_CONTAINER_ID, String(processId));
        mountedFormRef.current = true;
      } else {
        throw new Error('El SDK de Bancard no está disponible.');
      }
    } catch (err: any) {
      setShowForm(false);
      toast.error(err?.response?.data?.message || err?.message || 'No se pudo iniciar el registro.');
    } finally {
      setRegistering(false);
    }
  };

  // Al cerrar el modal de catastro: si llegó a montarse el iframe, sincronizamos las
  // tarjetas desde Bancard (la tarjeta nueva aparece tras completar el iframe).
  const closeForm = async () => {
    const wasMounted = mountedFormRef.current;
    mountedFormRef.current = false;
    setShowForm(false);
    const el = document.getElementById(REGISTER_CONTAINER_ID);
    el?.replaceChildren();

    if (wasMounted) {
      try {
        const res = await api.post('/payments/card/sync');
        setCards(res.data?.data || []);
        onChange?.();
      } catch {
        await loadCards();
      }
    }
  };

  const handleDelete = async (cardId: string) => {
    setDeleting(cardId);
    try {
      await api.delete(`/payments/card/${cardId}`);
      toast.success('Tarjeta eliminada');
      await loadCards();
      onChange?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'No se pudo eliminar la tarjeta');
    } finally {
      setDeleting(null);
    }
  };

  const handleSetPrimary = async (cardId: string) => {
    setSettingPrimary(cardId);
    try {
      await api.post('/payments/card/set-primary', { cardId });
      await loadCards();
      onChange?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'No se pudo actualizar la tarjeta principal');
    } finally {
      setSettingPrimary(null);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-10 ${className}`}>
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!configured) {
    return (
      <div className={`p-5 rounded-2xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 flex items-start gap-3 ${className}`}>
        <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Los pagos con tarjeta aún no están habilitados. El administrador debe configurar la pasarela de pagos.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Tarjetas guardadas */}
      {loadingCards ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="animate-spin text-primary" size={22} />
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-400 dark:text-slate-500">
          No tenés tarjetas guardadas todavía.
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((c) => {
            const last4 = (c.maskedNumber || '').replace(/\D/g, '').slice(-4) || '••••';
            return (
              <div
                key={c.id}
                className={`flex items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-br ${gradientFor(c.brand)} text-white shadow-lg`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CreditCard size={20} className="shrink-0 opacity-90" />
                  <div className="min-w-0">
                    <p className="font-bold text-sm uppercase tracking-wide truncate flex items-center gap-2">
                      {(c.brand || 'Tarjeta')} •••• {last4}
                      {c.isPrimary && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-white/20 rounded-full px-2 py-0.5">
                          <Star size={9} className="fill-current" /> Principal
                        </span>
                      )}
                    </p>
                    {c.expirationDate && (
                      <p className="text-[11px] opacity-70 font-medium tabular-nums">Vence {c.expirationDate}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!c.isPrimary && (
                    <button
                      onClick={() => handleSetPrimary(c.id)}
                      disabled={settingPrimary === c.id}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
                      aria-label="Marcar como principal"
                      title="Marcar como principal"
                    >
                      {settingPrimary === c.id ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deleting === c.id}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
                    aria-label="Eliminar tarjeta"
                  >
                    {deleting === c.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botón para iniciar el catastro */}
      <button
        onClick={openForm}
        disabled={registering}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
      >
        {registering ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
        {registering ? 'Iniciando…' : 'Agregar tarjeta'}
      </button>

      {/* Modal de catastro con el iframe seguro de Bancard */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={closeForm} />
            <motion.div
              className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto overscroll-contain"
              initial={{ y: '100%', opacity: 0.6, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-slate-900 dark:text-white">Nueva tarjeta</h4>
                <button
                  onClick={closeForm}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Contenedor del iframe de Bancard (catastro) */}
              <div id={REGISTER_CONTAINER_ID} className="min-h-[420px] w-full rounded-2xl overflow-hidden" />

              <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                <ShieldCheck size={14} className="text-emerald-500" />
                Pago seguro procesado por Bancard. Tus datos de tarjeta nunca tocan nuestros servidores.
              </div>

              <button
                onClick={closeForm}
                className="w-full h-12 rounded-2xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <CreditCard size={18} /> Listo
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
