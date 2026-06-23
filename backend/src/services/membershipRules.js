/**
 * Reglas de cambio de plan (membresías).
 * Regla central: un cliente puede SUBIR de plan o renovar, pero NO BAJAR a uno más
 * económico por su cuenta. La baja solo se habilita desde el admin (flag
 * Membership.downgradeAllowed, de un solo uso) o vía un cambio directo del admin.
 */

const DOWNGRADE_MSG =
  'No podés cambiar a un plan más económico por tu cuenta. Pedile al administrador que habilite la baja de plan.';

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

module.exports = { evaluatePlanChange, DOWNGRADE_MSG };
