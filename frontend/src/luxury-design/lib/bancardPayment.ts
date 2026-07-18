import api from '../../services/api';

/**
 * Helpers de pago con Bancard VPOS 2.0 (iframe + 3DS).
 *
 * El backend devuelve, cuando un cobro requiere autenticación 3DS:
 *   { success:true, requires3ds:true, data:{ processId, jsLibUrl, shopProcessId } }
 * En ese caso cargamos dinámicamente el SDK de Bancard (`bancard-checkout-4.0.0.js`,
 * cuya URL exacta la sirve el backend en `jsLibUrl` → single source of truth), montamos
 * el iframe 3DS en un contenedor que provee el caller (un modal) y, al finalizar, llamamos
 * al endpoint de confirmación. Todo se reduce a un resultado uniforme `PayResult`.
 */

// ─────────────────────────────────────────────────────
//  Tipos
// ─────────────────────────────────────────────────────

export type PayCode = 'OK' | 'NO_CARD' | 'FAILED' | 'ERROR';

export interface PayResult {
  ok: boolean;
  code: PayCode;
  message?: string;
  /** `data` de la respuesta del backend (ej. { membership, payment, charge }) cuando el cobro fue OK. */
  data?: any;
}

/** Tipado mínimo del objeto global que inyecta el SDK de Bancard. */
interface BancardSDK {
  Cards: {
    createForm: (containerId: string, processId: string, styles?: Record<string, any>) => void;
  };
  Charge: {
    createForm: (containerId: string, processId: string, styles?: Record<string, any>) => void;
  };
  /** Iframe del desafío 3D Secure — método correcto según el manual de Bancard vPOS 2.0. */
  Charge3DS?: {
    createForm: (containerId: string, processId: string, styles?: Record<string, any>) => void;
  };
  destroy?: (containerId?: string) => void;
}

declare global {
  interface Window {
    Bancard?: BancardSDK;
  }
}

/**
 * Datos que el helper entrega al caller cuando hace falta el desafío 3DS, para que
 * éste muestre un modal con un <div id={containerId}> donde montar el iframe.
 */
export interface ThreeDsContext {
  /** id del proceso de Bancard a pasar a createForm. */
  processId: string;
  /** id del shop_process_id (lo necesita el endpoint de confirmación). */
  shopProcessId: number | string;
}

/**
 * Callback que el caller pasa para manejar el 3DS:
 *  - recibe el contexto (processId/shopProcessId),
 *  - debe devolver el `containerId` (id del div ya montado en el DOM donde va el iframe),
 *  - el helper monta el iframe y queda a la espera de que el caller resuelva `done`
 *    cuando el iframe termine (Bancard redirige al returnUrl, normalmente detectado por
 *    el caller vía postMessage o por cierre manual del modal).
 *
 * Para simplificar el contrato, `onNeed3ds` devuelve una promesa que resuelve con el
 * `containerId` ya listo; el helper monta el iframe y luego espera a `waitForDone()`.
 */
export interface Bancard3dsHandlers {
  /** Devuelve el id del contenedor del DOM donde montar el iframe (ya visible). */
  mount: (ctx: ThreeDsContext) => Promise<string>;
  /** Promesa que resuelve cuando el usuario completó (o cerró) el iframe 3DS. */
  waitForDone: () => Promise<void>;
  /** Se llama siempre al final para desmontar el iframe/cerrar el modal. */
  cleanup?: () => void;
}

// ─────────────────────────────────────────────────────
//  Carga idempotente del SDK de Bancard
// ─────────────────────────────────────────────────────

let _scriptPromise: Promise<BancardSDK> | null = null;
let _loadedUrl: string | null = null;

/**
 * Carga el script `bancard-checkout-x.x.x.js` una sola vez y resuelve con `window.Bancard`.
 * La URL la decide el backend (`jsLibUrl`) para no hardcodear staging vs producción.
 */
export function loadBancardScript(jsLibUrl: string): Promise<BancardSDK> {
  if (window.Bancard) return Promise.resolve(window.Bancard);
  if (_scriptPromise && _loadedUrl === jsLibUrl) return _scriptPromise;

  _loadedUrl = jsLibUrl;
  _scriptPromise = new Promise<BancardSDK>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${jsLibUrl}"]`);
    const onReady = () => {
      if (window.Bancard) resolve(window.Bancard);
      else reject(new Error('El SDK de Bancard no se inicializó correctamente.'));
    };
    if (existing) {
      if (window.Bancard) return resolve(window.Bancard);
      existing.addEventListener('load', onReady, { once: true });
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar el SDK de Bancard.')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = jsLibUrl;
    s.async = true;
    s.addEventListener('load', onReady, { once: true });
    s.addEventListener('error', () => reject(new Error('No se pudo cargar el SDK de Bancard.')), { once: true });
    document.head.appendChild(s);
  });
  return _scriptPromise;
}

// ─────────────────────────────────────────────────────
//  Cobro genérico con soporte 3DS
// ─────────────────────────────────────────────────────

/**
 * Ejecuta un cobro contra el backend de Bancard, resolviendo el flujo 3DS si hace falta.
 *  - payPath:     ej '/payments/charge-membership' | '/payments/charge-topup'
 *  - body:        cuerpo del POST (ej { planId } o { amountGs }).
 *  - confirmPath: endpoint de confirmación 3DS (ej '/payments/charge-3ds-complete').
 *  - handlers:    cómo montar/esperar/limpiar el iframe 3DS (lo provee el caller, dueño del modal).
 *
 * Devuelve siempre un `PayResult` uniforme:
 *  - { ok:true, code:'OK' }            → cobro acreditado
 *  - { ok:false, code:'NO_CARD' }      → el usuario no tiene tarjeta registrada
 *  - { ok:false, code:'FAILED' }       → cobro/verificación rechazado
 *  - { ok:false, code:'ERROR' }        → error de red / SDK
 */
export async function runBancardPayment(
  payPath: string,
  body: Record<string, any>,
  confirmPath: string,
  handlers: Bancard3dsHandlers,
): Promise<PayResult> {
  try {
    const res = await api.post(payPath, body);
    const data = res.data || {};

    // Cobro aprobado de una (sin 3DS).
    if (data.success && !data.requires3ds) {
      return { ok: true, code: 'OK', data: data.data };
    }

    // Desafío 3DS: montar iframe y confirmar al terminar.
    if (data.requires3ds && data.data) {
      const { processId, jsLibUrl, shopProcessId } = data.data;
      try {
        const sdk = await loadBancardScript(jsLibUrl);
        const containerId = await handlers.mount({ processId, shopProcessId });
        // El manual de Bancard vPOS 2.0 (pág. 39, "Flujo 3D SECURE Pago con token - Charge")
        // indica Bancard.Charge3DS.createForm para montar el desafío 3DS. Caemos a Charge/Cards
        // solo por compatibilidad si una versión del SDK no expusiera Charge3DS.
        if (sdk.Charge3DS && typeof sdk.Charge3DS.createForm === 'function') {
          sdk.Charge3DS.createForm(containerId, String(processId));
        } else if (sdk.Charge && typeof sdk.Charge.createForm === 'function') {
          sdk.Charge.createForm(containerId, String(processId));
        } else if (sdk.Cards && typeof sdk.Cards.createForm === 'function') {
          sdk.Cards.createForm(containerId, String(processId));
        }
        await handlers.waitForDone();
      } finally {
        handlers.cleanup?.();
      }

      // Confirmar el resultado con el backend (incluye shopProcessId + cualquier dato del body).
      const conf = await api.post(confirmPath, { ...body, shopProcessId });
      return conf.data?.success
        ? { ok: true, code: 'OK', data: conf.data?.data }
        : { ok: false, code: 'FAILED', message: conf.data?.message || 'El pago no se completó.' };
    }

    // Respuesta de fracaso explícito.
    return { ok: false, code: 'FAILED', message: data.message || 'El cobro fue rechazado.' };
  } catch (err: any) {
    return mapError(err);
  }
}

/** Normaliza errores HTTP/SDK al `PayResult` uniforme. */
function mapError(err: any): PayResult {
  const resp = err?.response?.data;
  const status = err?.response?.status;
  const msg: string | undefined = resp?.message;

  // El backend usa 400 con un mensaje claro cuando no hay tarjeta registrada.
  if (
    resp?.code === 'NO_CARD' ||
    (typeof msg === 'string' && /tarjeta/i.test(msg) && /(registr|agreg)/i.test(msg))
  ) {
    return { ok: false, code: 'NO_CARD', message: msg };
  }

  // 402 / 409 → rechazo o cobro en curso: lo tratamos como fallo recuperable.
  if (status === 402 || status === 409) {
    return { ok: false, code: 'FAILED', message: msg || 'El cobro fue rechazado.' };
  }

  if (msg) return { ok: false, code: 'FAILED', message: msg };
  return { ok: false, code: 'ERROR', message: 'Error de conexión. Intentá de nuevo.' };
}
