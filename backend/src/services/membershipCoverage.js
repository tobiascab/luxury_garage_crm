/**
 * FUENTE ÚNICA DE VERDAD del cupo de servicios de un plan.
 *
 * Antes esto vivía en tres lugares con reglas distintas y los números no coincidían:
 *   • la reserva cobraba según `plan.servicesIncluded[].quota` (el dato bueno),
 *   • el dashboard del cliente mostraba `plan.limitsJson.maxWashesPerMonth` (dato duplicado,
 *     que en el Plan Básico decía 5 cuando la quota real era 4), y contaba los lavados en el
 *     navegador sobre las ÚLTIMAS 5 reservas → siempre subestimaba,
 *   • el scanner del empleado usaba una tercera cuenta (todas las citas del mes calendario).
 *
 * Ahora todos consumen estas dos funciones, así el cliente, el empleado y el cobro ven
 * exactamente el mismo número.
 *
 * Reglas:
 *   • El cupo se cuenta por CICLO de la membresía (desde membership.startDate), no por mes
 *     calendario: cada renovación crea una membresía nueva, así que su startDate abre el ciclo.
 *   • quota === -1 ⇒ ilimitado.
 *   • Un turno CANCELADO devuelve el cupo. NO_SHOW lo consume (se reservó y bloqueó agenda).
 *   • Solo cuentan los turnos marcados coveredByMembership (los pagados aparte no gastan cupo).
 */

/** Cupo total del plan = suma de quotas de servicesIncluded. Algún -1 ⇒ ilimitado. */
function planQuotaSummary(plan) {
  const included = Array.isArray(plan?.servicesIncluded) ? plan.servicesIncluded : [];
  const unlimited = included.some((s) => Number(s?.quota) === -1);
  const totalQuota = unlimited
    ? Infinity
    : included.reduce((sum, s) => sum + Math.max(0, Number(s?.quota) || 0), 0);
  return { included, unlimited, totalQuota };
}

/** Turnos que ya consumieron cupo de un servicio en el ciclo vigente. */
function usedCountWhere(userId, serviceId, cycleStart) {
  return {
    userId,
    serviceId,
    coveredByMembership: true,
    createdAt: { gte: cycleStart },
    status: { not: 'CANCELLED' },
  };
}

/**
 * Cobertura del plan para UN servicio concreto (la usa la reserva para decidir si cobra).
 * @returns {{hasMembership:boolean, inPlan:boolean, covered:boolean, unlimited?:boolean,
 *            quota?:number, used?:number, remaining?:number, includedAddons?:any, membership?:object}}
 */
async function getServiceCoverage(prisma, userId, service) {
  const membership = await prisma.membership.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { plan: true },
  });
  if (!membership) return { hasMembership: false, inPlan: false, covered: false };

  const { included } = planQuotaSummary(membership.plan);
  const entry = included.find((s) => s && s.slug === service.slug);
  if (!entry) return { hasMembership: true, inPlan: false, covered: false, membership };

  const quota = Number(entry.quota);
  const includedAddons = entry.includedAddons ?? null; // 'all' | [keys] | null (ninguno)
  if (quota === -1) {
    return { hasMembership: true, inPlan: true, covered: true, unlimited: true, remaining: -1, includedAddons, membership };
  }

  const used = await prisma.appointment.count({
    where: usedCountWhere(userId, service.id, membership.startDate),
  });
  const remaining = Math.max(0, quota - used);
  return { hasMembership: true, inPlan: true, covered: remaining > 0, unlimited: false, quota, used, remaining, includedAddons, membership };
}

/**
 * Resumen del consumo del plan en el ciclo vigente — lo que se le MUESTRA al cliente en su
 * dashboard y al empleado tras escanear el QR. Mismos números que usa el cobro.
 *
 * @returns {Promise<null|{planName:string, unlimited:boolean, quota:number|null, used:number,
 *   remaining:number|null, cycleStart:Date, cycleEnd:Date, perService:Array}>}
 *   Devuelve null si el usuario no tiene membresía activa.
 */
async function getPlanUsage(prisma, userId) {
  const membership = await prisma.membership.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { plan: true },
  });
  if (!membership) return null;

  const { included, unlimited } = planQuotaSummary(membership.plan);
  const slugs = included.map((s) => s?.slug).filter(Boolean);
  const services = slugs.length
    ? await prisma.service.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true, name: true } })
    : [];

  const perService = [];
  let totalUsed = 0;
  let totalQuota = 0;

  for (const entry of included) {
    const svc = services.find((s) => s.slug === entry.slug);
    if (!svc) continue; // servicio del plan que ya no existe en el catálogo
    const quota = Number(entry.quota);
    const isUnlimited = quota === -1;
    const used = await prisma.appointment.count({
      where: usedCountWhere(userId, svc.id, membership.startDate),
    });
    totalUsed += used;
    if (!isUnlimited) totalQuota += Math.max(0, quota);
    perService.push({
      slug: svc.slug,
      name: svc.name,
      unlimited: isUnlimited,
      quota: isUnlimited ? -1 : quota,
      used,
      remaining: isUnlimited ? null : Math.max(0, quota - used),
    });
  }

  return {
    planName: membership.plan?.name || null,
    unlimited,
    quota: unlimited ? null : totalQuota,
    used: totalUsed,
    remaining: unlimited ? null : Math.max(0, totalQuota - totalUsed),
    cycleStart: membership.startDate,
    cycleEnd: membership.endDate,
    perService,
  };
}

module.exports = { getServiceCoverage, getPlanUsage, planQuotaSummary };
