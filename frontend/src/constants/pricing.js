// Helpers PUROS de precio. Sin datos de negocio: los tamaños de vehículo, precios
// y adicionales viven en la BD (tabla vehicle_sizes y Service.pricingBySize/addons).

/**
 * Precio total de un servicio según el tamaño y los adicionales elegidos (array de keys).
 * `service.pricingBySize` y `service.addons` vienen de la BD. Cae a basePriceGs si no hay
 * precio por tamaño.
 */
export function computeServicePrice(service, sizeKey, addonKeys = []) {
  if (!service) return 0;
  const bySize = service.pricingBySize || null;
  const base = bySize && bySize[sizeKey] != null ? bySize[sizeKey] : service.basePriceGs || 0;
  const addons = Array.isArray(service.addons) ? service.addons : [];
  const chosen = new Set(addonKeys);
  const addonsTotal = addons
    .filter((a) => chosen.has(a.key))
    .reduce((sum, a) => sum + (a.priceGs || 0), 0);
  return base + addonsTotal;
}

/** Formatea un monto en guaraníes: 60000 -> "₲ 60.000". */
export function formatGs(amount) {
  return '₲ ' + Number(amount || 0).toLocaleString('es-PY');
}
