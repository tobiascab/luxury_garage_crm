/**
 * Compatibilidad: la gestión de tarjetas migró de Stripe a Bancard.
 * Se mantiene este módulo como re-export para no romper imports antiguos;
 * el código nuevo debería importar `BancardCardManager` directamente.
 */
export { default } from './BancardCardManager';
export { default as BancardCardManager } from './BancardCardManager';
