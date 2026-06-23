// ════════════════════════════════════════════════════════════════
//  journalService — asientos contables automáticos (partida doble)
// ════════════════════════════════════════════════════════════════
// Genera asientos contables BEST-EFFORT y POST-COMMIT a partir de Payments
// COMPLETED y Expenses. NUNCA debe correr dentro de la transacción de cobro,
// ni romper el flujo de pago: todo va en try/catch que loguea y no relanza.
//
// Idempotencia: cada asiento usa JournalEntry.reference = id del Payment/Expense.
// Si ya existe un asiento con esa referencia, no se crea otro.
//
// Códigos del plan de cuentas (ver prisma/seed.js):
//   1.1.01 Caja/Banco            (asset)
//   2.1.01 IVA Débito Fiscal     (liability)
//   1.1.02 IVA Crédito Fiscal    (asset)
//   4.1.01 Ingresos Membresías   (income)
//   4.1.02 Ingresos Servicios    (income)
//   4.1.03 Ingresos Billetera    (income)
//   5.1.01 Gastos Operativos     (expense)

// IVA general Paraguay (10%), incluido en el monto bruto:
//   base = bruto / 1.1 ; iva = bruto - base.  (misma fórmula que accounting.js)
const IVA_RATE = 0.1;
const ivaFromGross = (grossGs) => Math.round(grossGs - grossGs / (1 + IVA_RATE));

// Resuelve los ids de cuentas requeridas por code. Devuelve un mapa { code: id }.
async function resolveAccounts(prisma, codes) {
  const accounts = await prisma.account.findMany({ where: { code: { in: codes } } });
  const map = {};
  for (const a of accounts) map[a.code] = a.id;
  return map;
}

// Determina la cuenta de ingreso según la descripción del payment.
function incomeAccountCode(description) {
  const d = (description || '').toLowerCase();
  if (d.startsWith('appointment:')) return '4.1.02'; // Servicios
  if (d.startsWith('overage:')) return '4.1.02';      // Servicios (extra de turno)
  if (d.includes('recarga') || d.includes('topup')) return '4.1.03'; // Billetera
  return '4.1.01'; // Membresías (resto)
}

/**
 * Registra el asiento contable de un Payment COMPLETED (IDEMPOTENTE).
 * Asiento balanceado (IVA 10% incluido en amountGs):
 *   Debe  Caja/Banco (1.1.01)      = amountGs
 *   Haber Ingreso (4.1.0x)         = amountGs - iva
 *   Haber IVA Débito Fiscal (2.1.01) = iva
 * Best-effort: cualquier error se loguea y NO se relanza.
 */
async function recordPaymentEntry(prisma, payment) {
  try {
    if (!payment || !payment.id) return;
    const amountGs = Number(payment.amountGs) || 0;
    if (amountGs <= 0) return;

    // Los overages diferidos (description 'overage:*') NO se asientan individualmente: se cobran
    // DENTRO del Payment de renovación (su monto ya va incluido en chargeAmount = plan + overages),
    // así que asentarlos por separado duplicaría el ingreso en el libro mayor. El asiento de la
    // renovación cubre el total. (Hallazgo MEDIO de la verificación adversarial — 2026-06-22.)
    if (String(payment.description || '').startsWith('overage:')) return;

    // Idempotencia: ¿ya existe un asiento para este payment?
    const existing = await prisma.journalEntry.findFirst({ where: { reference: payment.id } });
    if (existing) return;

    const incomeCode = incomeAccountCode(payment.description);
    const codes = ['1.1.01', '2.1.01', incomeCode];
    const acc = await resolveAccounts(prisma, codes);

    // Si falta alguna cuenta del plan → no se puede balancear; log + return (no crash).
    for (const c of codes) {
      if (!acc[c]) {
        console.error(`[journal] cuenta ${c} no encontrada en el plan; se omite asiento de payment ${payment.id}`);
        return;
      }
    }

    const iva = ivaFromGross(amountGs);
    const incomeGs = amountGs - iva;

    // createdById: FK obligatoria → usar un SUPER_ADMIN existente.
    const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } });
    if (!admin) {
      console.error(`[journal] no hay usuario SUPER_ADMIN para createdById; se omite asiento de payment ${payment.id}`);
      return;
    }

    await prisma.journalEntry.create({
      data: {
        date: new Date(),
        description: payment.description || `Cobro ${payment.id}`,
        reference: payment.id,
        createdById: admin.id,
        lines: {
          create: [
            { accountId: acc['1.1.01'], debitGs: amountGs, creditGs: 0 },
            { accountId: acc[incomeCode], debitGs: 0, creditGs: incomeGs },
            { accountId: acc['2.1.01'], debitGs: 0, creditGs: iva },
          ],
        },
      },
    });
  } catch (e) {
    console.error('[journal] recordPaymentEntry error:', e?.message || e);
  }
}

/**
 * Helper POST-COMMIT: recarga el Payment fresco desde la DB y registra su asiento.
 * Minimiza el drift entre lo persistido y lo contabilizado. Best-effort.
 * Llamar SIEMPRE fuera de la transacción de cobro.
 */
async function postPaymentCompleted(prisma, paymentId) {
  try {
    if (!paymentId) return;
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== 'COMPLETED') return;
    await recordPaymentEntry(prisma, payment);
  } catch (e) {
    console.error('[journal] postPaymentCompleted error:', e?.message || e);
  }
}

/**
 * Registra el asiento contable de un Expense (IDEMPOTENTE por reference=expense.id).
 * Asiento balanceado (IVA crédito = expense.ivaGs):
 *   Debe  Gastos Operativos (5.1.01)    = amountGs - ivaGs
 *   Debe  IVA Crédito Fiscal (1.1.02)   = ivaGs
 *   Haber Caja/Banco (1.1.01)           = amountGs
 * Best-effort: cualquier error se loguea y NO se relanza.
 */
async function recordExpenseEntry(prisma, expense) {
  try {
    if (!expense || !expense.id) return;
    const amountGs = Number(expense.amountGs) || 0;
    if (amountGs <= 0) return;

    const existing = await prisma.journalEntry.findFirst({ where: { reference: expense.id } });
    if (existing) return;

    const codes = ['5.1.01', '1.1.02', '1.1.01'];
    const acc = await resolveAccounts(prisma, codes);
    for (const c of codes) {
      if (!acc[c]) {
        console.error(`[journal] cuenta ${c} no encontrada en el plan; se omite asiento de expense ${expense.id}`);
        return;
      }
    }

    const ivaGs = expense.ivaGs != null ? Number(expense.ivaGs) : ivaFromGross(amountGs);
    const baseGs = amountGs - ivaGs;

    const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } });
    if (!admin) {
      console.error(`[journal] no hay usuario SUPER_ADMIN para createdById; se omite asiento de expense ${expense.id}`);
      return;
    }

    await prisma.journalEntry.create({
      data: {
        date: expense.date ? new Date(expense.date) : new Date(),
        description: expense.description || `Gasto ${expense.id}`,
        reference: expense.id,
        createdById: admin.id,
        lines: {
          create: [
            { accountId: acc['5.1.01'], debitGs: baseGs, creditGs: 0 },
            { accountId: acc['1.1.02'], debitGs: ivaGs, creditGs: 0 },
            { accountId: acc['1.1.01'], debitGs: 0, creditGs: amountGs },
          ],
        },
      },
    });
  } catch (e) {
    console.error('[journal] recordExpenseEntry error:', e?.message || e);
  }
}

module.exports = {
  recordPaymentEntry,
  postPaymentCompleted,
  recordExpenseEntry,
  ivaFromGross,
};
