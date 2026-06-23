/**
 * Compatibilidad: el cobro al cliente migró de Stripe a Bancard.
 * Se mantiene este módulo como re-export para no romper imports antiguos;
 * el código nuevo debería importar desde `./bancardPayment`.
 */
export { runBancardPayment, loadBancardScript } from './bancardPayment';
export type { PayResult, PayCode } from './bancardPayment';
