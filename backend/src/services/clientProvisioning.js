const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Aprovisiona un cliente nuevo de forma atómica.
 *
 * Encapsula EXACTAMENTE el patrón de auth.js /admin-create dentro de una $transaction:
 *  - genera una tempPassword con entropía criptográfica y la hashea con bcrypt (cost 12)
 *  - crea el User (role 'CLIENT')
 *  - crea el Vehicle si `vehicle.brand` viene
 *  - crea la Membership ACTIVE (start=hoy, end=+1 mes) si `plan` viene
 *  - registra un AuditLog
 *
 * El sync con ARIZAR (HTTP) y el WhatsApp van DESPUÉS del commit (best-effort), del lado del caller.
 *
 * @param {import('@prisma/client').PrismaClient} prisma — cliente prisma (o tx)
 * @param {Object} input
 * @param {string} input.email
 * @param {string} input.firstName
 * @param {string} input.lastName
 * @param {string} [input.phone]
 * @param {Object} [input.plan] — registro Plan ya resuelto (con id). Si falta, sin membresía.
 * @param {Object} [input.vehicle] — { brand, model, year, color, licensePlate }. Se crea solo si hay brand.
 * @param {string} actorUserId — id del usuario (admin/empleado) que ejecuta la acción
 * @returns {Promise<{ user, vehicle, membership, tempPassword }>}
 */
async function provisionClient(prisma, { email, firstName, lastName, phone, plan, vehicle } = {}, actorUserId) {
  if (!email || !firstName || !lastName) {
    const e = new Error('Email, nombre y apellido son requeridos');
    e.statusCode = 400;
    throw e;
  }

  // Generate temporary password with cryptographically secure entropy (igual que /admin-create)
  const tempPassword = firstName.substring(0, 3) + crypto.randomBytes(16).toString('hex').slice(0, 10) + '!1';
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  // Escrituras de BD atómicas: user + vehicle + membership + audit. Si algo falla a mitad,
  // se revierte todo.
  const { user, vehicle: createdVehicle, membership } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, firstName, lastName, phone: phone || null, role: 'CLIENT' },
    });

    // Vehicle
    let createdVehicle = null;
    if (vehicle && vehicle.brand) {
      createdVehicle = await tx.vehicle.create({
        data: {
          userId: user.id,
          brand: vehicle.brand,
          model: vehicle.model || '',
          year: vehicle.year || new Date().getFullYear(),
          color: vehicle.color || '',
          licensePlate: vehicle.licensePlate || '',
          isPrimary: true,
        },
      });
    }

    // Plan
    let membership = null;
    if (plan) {
      const start = new Date();
      const end = new Date(); end.setMonth(end.getMonth() + 1);
      membership = await tx.membership.create({
        data: { userId: user.id, planId: plan.id, status: 'ACTIVE', startDate: start, endDate: end },
        include: { plan: true },
      });
    }

    // Audit
    await tx.auditLog.create({
      data: {
        entity: 'user',
        action: 'client_provisioned',
        entityId: user.id,
        userId: actorUserId || null,
        detailsJson: { clientEmail: email, plan: membership?.plan?.name || null, vehicle: createdVehicle ? `${createdVehicle.brand} ${createdVehicle.model}`.trim() : null },
      },
    });

    return { user, vehicle: createdVehicle, membership };
  });

  return { user, vehicle: createdVehicle, membership, tempPassword };
}

module.exports = { provisionClient };
