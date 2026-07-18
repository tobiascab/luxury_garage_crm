/**
 * Reglas de cambio de plan (membresías).
 * Regla central: un cliente puede SUBIR de plan o renovar, pero NO BAJAR a uno más
 * económico por su cuenta. La baja solo se habilita desde el admin (flag
 * Membership.downgradeAllowed, de un solo uso) o vía un cambio directo del admin.
 */

const DOWNGRADE_MSG =
  'No podés cambiar a un plan más económico por tu cuenta. Pedile al administrador que habilite la baja de plan.';

const DAY_MS = 24 * 60 * 60 * 1000;
// Piso de cobro: Bancard rechaza montos de 0. Un upgrade real siempre da una diferencia
// significativa, pero garantizamos ≥ 1 ₲ por robustez.
const MIN_CHARGE_GS = 1;

/**
 * Evalúa un cambio de plan para un usuario hacia `targetPlan`.
 * Devuelve { hasActive, currentPlan, isDowngrade, samePlan, allowed, membership }.
 * - Sin membresía activa → allowed (primera compra, cualquier plan).
 * - Mismo plan o más caro → allowed (renovación / upgrade).
 * - Más barato → allowed solo si la membresía activa tiene downgradeAllowed=true.
 */
async function evaluatePlanChange(prisma, userId, targetPlan) {
  const membership = await prisma.membership.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { plan: true },
  });
  if (!membership) {
    return { hasActive: false, isDowngrade: false, samePlan: false, allowed: true };
  }
  const currentPrice = membership.plan?.priceGs ?? 0;
  const targetPrice = targetPlan?.priceGs ?? 0;
  const samePlan = membership.planId === targetPlan?.id;
  const isDowngrade = !samePlan && targetPrice < currentPrice;
  const allowed = !isDowngrade || membership.downgradeAllowed === true;
  return { hasActive: true, currentPlan: membership.plan, membership, isDowngrade, samePlan, allowed };
}

/**
 * Calcula CUÁNTO cobrar por activar `targetPlan` y qué vencimiento tendrá la nueva membresía.
 *
 * Regla de prorrateo (upgrade a mitad de ciclo):
 *   Si el cliente ya tiene una membresía ACTIVA y elige un plan MÁS CARO, no le cobramos el
 *   plan nuevo completo: le cobramos solo la DIFERENCIA de precio, proporcional a los días que
 *   le quedan del ciclo actual. La nueva membresía CONSERVA la fecha de vencimiento del ciclo
 *   vigente (no se reinicia el mes); al renovar ya pagará el plan nuevo completo.
 *
 *   diferencia_prorrateada = round((precioNuevo − precioActual) × díasRestantes / díasTotales)
 *
 * Casos que cobran el PRECIO COMPLETO y abren un ciclo nuevo (+1 mes):
 *   - sin membresía activa (primera compra),
 *   - mismo plan (renovación anticipada),
 *   - plan más barato o igual (una baja no se prorratea),
 *   - ciclo inválido o ya vencido.
 *
 * @returns {{ amountGs:number, prorated:boolean, keepEndDate:string|null,
 *             fullPrice:number, currentPrice:number, creditApplied:number,
 *             daysRemaining:number|null, daysTotal:number|null }}
 */
function computeMembershipCharge({ activeMembership, currentPlan, targetPlan, now = new Date() }) {
  const fullPrice = targetPlan?.priceGs ?? 0;
  const base = {
    amountGs: fullPrice,
    prorated: false,
    keepEndDate: null,
    fullPrice,
    currentPrice: currentPlan?.priceGs ?? 0,
    creditApplied: 0,
    daysRemaining: null,
    daysTotal: null,
  };

  if (!activeMembership) return base;

  const currentPrice = currentPlan?.priceGs ?? 0;
  const samePlan = activeMembership.planId === targetPlan?.id;
  // Solo prorrateamos UPGRADE real (plan distinto y más caro).
  if (samePlan || fullPrice <= currentPrice) return { ...base, currentPrice };

  const start = new Date(activeMembership.startDate).getTime();
  const end = new Date(activeMembership.endDate).getTime();
  const t = now.getTime();
  const totalMs = end - start;
  const remainingMs = end - t;

  // Ciclo inválido o vencido → precio completo, ciclo nuevo.
  if (!(totalMs > 0) || !(remainingMs > 0)) return { ...base, currentPrice };

  const fraction = Math.min(1, remainingMs / totalMs);
  const proratedDiff = Math.round((fullPrice - currentPrice) * fraction);
  const amountGs = Math.max(proratedDiff, MIN_CHARGE_GS);

  return {
    amountGs,
    prorated: true,
    keepEndDate: new Date(end).toISOString(), // el upgrade mantiene el ciclo actual
    fullPrice,
    currentPrice,
    creditApplied: Math.max(0, fullPrice - amountGs),
    daysRemaining: Math.ceil(remainingMs / DAY_MS),
    daysTotal: Math.round(totalMs / DAY_MS),
  };
}

module.exports = { evaluatePlanChange, computeMembershipCharge, DOWNGRADE_MSG };
