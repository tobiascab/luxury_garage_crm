const router = require('express').Router();
const { z } = require('zod');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const bancardService = require('../services/bancardService');
const { recordExpenseEntry } = require('../services/journalService');

// Todo el módulo contable es admin-only.
const adminOnly = [authenticate, authorize('SUPER_ADMIN', 'ADMIN')];

// IVA general Paraguay (10%). El IVA está incluido en el monto bruto:
// base = bruto / 1.1 ; iva = bruto - base.
const IVA_RATE = 0.1;
const ivaFromGross = (grossGs) => Math.round(grossGs - grossGs / (1 + IVA_RATE));

// Registra un AuditLog sin romper el request si falla (best-effort).
async function audit(prisma, { userId, action, entity, entityId, detailsJson, ipAddress }) {
  try {
    await prisma.auditLog.create({ data: { userId, action, entity, entityId, detailsJson, ipAddress } });
  } catch (e) {
    console.error('accounting audit log error:', e?.message || e);
  }
}

// ════════════════════════════════════════════════════════════════
//  SCHEMAS
// ════════════════════════════════════════════════════════════════

const intGs = z.number().int('Debe ser un entero (PYG)').nonnegative('No puede ser negativo');

const expenseSchema = z.object({
  date: z.string().datetime().or(z.string().min(8)), // ISO o date corta
  amountGs: intGs.refine((v) => v > 0, 'El monto debe ser mayor a 0'),
  description: z.string().min(1, 'Descripción requerida'),
  categoryId: z.string().min(1, 'Categoría requerida'),
  supplier: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  ivaGs: intGs.optional().nullable(),
  notes: z.string().optional().nullable(),
});

const expenseCategorySchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color hex inválido').optional().nullable(),
});

const creditNoteSchema = z.object({
  paymentId: z.string().optional().nullable(),
  userId: z.string().min(1, 'Cliente requerido'),
  amountGs: intGs.refine((v) => v > 0, 'El monto debe ser mayor a 0'),
  reason: z.string().min(1, 'Motivo requerido'),
  type: z.enum(['refund', 'cancellation', 'adjustment']),
});

const journalLineSchema = z.object({
  accountId: z.string().min(1),
  debitGs: intGs.default(0),
  creditGs: intGs.default(0),
});

const journalEntrySchema = z.object({
  date: z.string().datetime().or(z.string().min(8)),
  description: z.string().min(1, 'Descripción requerida'),
  reference: z.string().optional().nullable(),
  lines: z.array(journalLineSchema).min(2, 'Un asiento necesita al menos 2 líneas'),
});

const accountSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  type: z.enum(['asset', 'liability', 'income', 'expense', 'equity']),
});

// Parsea una fecha de query (from/to) tolerando ISO o YYYY-MM-DD; null si inválida.
function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// ════════════════════════════════════════════════════════════════
//  EGRESOS / GASTOS
// ════════════════════════════════════════════════════════════════

// GET /api/accounting/expenses — lista con filtros de fecha/categoría y paginación.
router.get('/expenses', ...adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, from, to, categoryId } = req.query;
    const take = Math.min(parseInt(limit) || 20, 100);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const where = {};
    const gte = parseDate(from);
    const lte = parseDate(to);
    if (gte || lte) {
      where.date = {};
      if (gte) where.date.gte = gte;
      if (lte) where.date.lte = lte;
    }
    if (categoryId) where.categoryId = categoryId;

    const [items, total, agg] = await Promise.all([
      req.prisma.expense.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        include: {
          category: { select: { id: true, name: true, color: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      req.prisma.expense.count({ where }),
      req.prisma.expense.aggregate({ where, _sum: { amountGs: true, ivaGs: true } }),
    ]);

    res.json({
      success: true,
      data: items,
      totals: { amountGs: agg._sum.amountGs || 0, ivaGs: agg._sum.ivaGs || 0 },
      pagination: { page: parseInt(page) || 1, limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err) { next(err); }
});

// GET /api/accounting/expenses/summary — totales del período + desglose por categoría.
// Lo consume ExpensesManager (tarjetas de total, IVA y "gasto por categoría"). Antes NO
// existía → el frontend recibía 404 y las tarjetas de resumen quedaban vacías.
router.get('/expenses/summary', ...adminOnly, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = {};
    const gte = parseDate(from);
    const lte = parseDate(to);
    if (gte || lte) {
      where.date = {};
      if (gte) where.date.gte = gte;
      if (lte) where.date.lte = lte;
    }

    const [agg, grouped, categories] = await Promise.all([
      req.prisma.expense.aggregate({ where, _sum: { amountGs: true, ivaGs: true }, _count: true }),
      req.prisma.expense.groupBy({ by: ['categoryId'], where, _sum: { amountGs: true } }),
      req.prisma.expenseCategory.findMany({ select: { id: true, name: true, color: true } }),
    ]);

    const catMap = new Map(categories.map((c) => [c.id, c]));
    const byCategory = grouped
      .map((g) => ({
        categoryId: g.categoryId,
        name: catMap.get(g.categoryId)?.name || 'Sin categoría',
        color: catMap.get(g.categoryId)?.color || null,
        totalGs: g._sum.amountGs || 0,
      }))
      .sort((a, b) => b.totalGs - a.totalGs);

    res.json({
      success: true,
      data: {
        totalGs: agg._sum.amountGs || 0,
        ivaGs: agg._sum.ivaGs || 0,
        count: agg._count || 0,
        byCategory,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/accounting/expenses — registrar gasto. createdById = req.user.id.
router.post('/expenses', ...adminOnly, validateBody(expenseSchema), async (req, res, next) => {
  try {
    const b = req.validatedBody;
    const date = parseDate(b.date);
    if (!date) return res.status(400).json({ success: false, message: 'Fecha inválida' });

    // Verificar que la categoría exista (FK clara antes de fallar en DB).
    const category = await req.prisma.expenseCategory.findUnique({ where: { id: b.categoryId } });
    if (!category) return res.status(400).json({ success: false, message: 'Categoría no encontrada' });

    // Si no mandan ivaGs, lo calculamos asumiendo IVA 10% incluido en el bruto.
    const ivaGs = b.ivaGs == null ? ivaFromGross(b.amountGs) : b.ivaGs;

    const expense = await req.prisma.expense.create({
      data: {
        date,
        amountGs: b.amountGs,
        description: b.description,
        categoryId: b.categoryId,
        supplier: b.supplier || null,
        paymentMethod: b.paymentMethod || null,
        ivaGs,
        notes: b.notes || null,
        createdById: req.user.id,
      },
      include: { category: { select: { id: true, name: true, color: true } } },
    });

    await audit(req.prisma, {
      userId: req.user.id, action: 'EXPENSE_CREATE', entity: 'Expense', entityId: expense.id,
      detailsJson: { amountGs: expense.amountGs, categoryId: expense.categoryId, description: expense.description },
      ipAddress: req.ip,
    });

    // Asiento contable del gasto (best-effort, no bloqueante).
    recordExpenseEntry(req.prisma, expense).catch(() => {});

    res.status(201).json({ success: true, data: expense });
  } catch (err) { next(err); }
});

// PUT /api/accounting/expenses/:id — actualizar gasto.
router.put('/expenses/:id', ...adminOnly, validateBody(expenseSchema.partial()), async (req, res, next) => {
  try {
    const existing = await req.prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Gasto no encontrado' });

    const b = req.validatedBody;
    const data = {};
    if (b.date !== undefined) {
      const date = parseDate(b.date);
      if (!date) return res.status(400).json({ success: false, message: 'Fecha inválida' });
      data.date = date;
    }
    if (b.amountGs !== undefined) data.amountGs = b.amountGs;
    if (b.description !== undefined) data.description = b.description;
    if (b.categoryId !== undefined) {
      const category = await req.prisma.expenseCategory.findUnique({ where: { id: b.categoryId } });
      if (!category) return res.status(400).json({ success: false, message: 'Categoría no encontrada' });
      data.categoryId = b.categoryId;
    }
    if (b.supplier !== undefined) data.supplier = b.supplier || null;
    if (b.paymentMethod !== undefined) data.paymentMethod = b.paymentMethod || null;
    if (b.ivaGs !== undefined) data.ivaGs = b.ivaGs;
    if (b.notes !== undefined) data.notes = b.notes || null;

    const expense = await req.prisma.expense.update({
      where: { id: req.params.id },
      data,
      include: { category: { select: { id: true, name: true, color: true } } },
    });

    await audit(req.prisma, {
      userId: req.user.id, action: 'EXPENSE_UPDATE', entity: 'Expense', entityId: expense.id,
      detailsJson: { changed: Object.keys(data) }, ipAddress: req.ip,
    });

    res.json({ success: true, data: expense });
  } catch (err) { next(err); }
});

// DELETE /api/accounting/expenses/:id — eliminar gasto.
router.delete('/expenses/:id', ...adminOnly, async (req, res, next) => {
  try {
    const existing = await req.prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Gasto no encontrado' });

    await req.prisma.expense.delete({ where: { id: req.params.id } });

    await audit(req.prisma, {
      userId: req.user.id, action: 'EXPENSE_DELETE', entity: 'Expense', entityId: req.params.id,
      detailsJson: { amountGs: existing.amountGs, description: existing.description }, ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Gasto eliminado' });
  } catch (err) { next(err); }
});

// ── Categorías de gasto ──────────────────────────────────────────

// GET /api/accounting/expense-categories — lista + conteo de gastos por categoría.
router.get('/expense-categories', ...adminOnly, async (req, res, next) => {
  try {
    const categories = await req.prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { expenses: true } } },
    });
    res.json({ success: true, data: categories });
  } catch (err) { next(err); }
});

// POST /api/accounting/expense-categories — crear categoría (name @unique).
router.post('/expense-categories', ...adminOnly, validateBody(expenseCategorySchema), async (req, res, next) => {
  try {
    const category = await req.prisma.expenseCategory.create({
      data: { name: req.validatedBody.name, color: req.validatedBody.color || null },
    });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'Ya existe una categoría con ese nombre' });
    next(err);
  }
});

// ════════════════════════════════════════════════════════════════
//  NOTAS DE CRÉDITO / REEMBOLSOS
// ════════════════════════════════════════════════════════════════

// GET /api/accounting/credit-notes — lista con filtros (tipo, cliente, rango) + paginación.
router.get('/credit-notes', ...adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, userId, from, to } = req.query;
    const take = Math.min(parseInt(limit) || 20, 100);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const where = {};
    if (type) where.type = type;
    if (userId) where.userId = userId;
    const gte = parseDate(from);
    const lte = parseDate(to);
    if (gte || lte) {
      where.createdAt = {};
      if (gte) where.createdAt.gte = gte;
      if (lte) where.createdAt.lte = lte;
    }

    const [items, total, agg] = await Promise.all([
      req.prisma.creditNote.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          payment: { select: { id: true, amountGs: true, status: true, createdAt: true } },
        },
      }),
      req.prisma.creditNote.count({ where }),
      req.prisma.creditNote.aggregate({ where, _sum: { amountGs: true } }),
    ]);

    res.json({
      success: true,
      data: items,
      totals: { amountGs: agg._sum.amountGs || 0 },
      pagination: { page: parseInt(page) || 1, limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err) { next(err); }
});

// POST /api/accounting/credit-notes — emitir nota de crédito.
// Si type === 'refund' y referencia un Payment con cobro Bancard, intenta el rollback real.
router.post('/credit-notes', ...adminOnly, validateBody(creditNoteSchema), async (req, res, next) => {
  try {
    const b = req.validatedBody;

    const user = await req.prisma.user.findUnique({ where: { id: b.userId } });
    if (!user) return res.status(400).json({ success: false, message: 'Cliente no encontrado' });

    let payment = null;
    if (b.paymentId) {
      payment = await req.prisma.payment.findUnique({ where: { id: b.paymentId } });
      if (!payment) return res.status(400).json({ success: false, message: 'Pago no encontrado' });
      if (b.amountGs > payment.amountGs) {
        return res.status(400).json({ success: false, message: 'El monto supera el del pago original' });
      }
    }

    // Reembolso por Bancard (best-effort): Bancard no tiene refund general por API, solo `rollback`,
    // que normalmente funciona únicamente el mismo día del cobro. Si tiene éxito, guardamos el ref
    // en la columna existente `stripeRefundId` (reutilizada para no migrar el schema; acá va el ref
    // del rollback de Bancard, no de Stripe). Si no se puede, la nota queda registrada igual con ese
    // campo en null (pendiente de conciliación manual), sin romper.
    let stripeRefundId = null; // NOTA: reutilizado para el identificador de rollback de Bancard
    let refundPending = false;
    let refundDone = false;
    if (b.type === 'refund' && payment) {
      if (payment.bancardShopProcessId && bancardService.isConfigured()) {
        try {
          const result = await bancardService.rollback(payment.bancardShopProcessId);
          if (result?.success) {
            stripeRefundId = `bancard_rollback:${payment.bancardShopProcessId}`;
            refundDone = true;
          } else {
            refundPending = true; // el rollback no aplicó (probablemente fuera del mismo día)
          }
        } catch (e) {
          console.error('credit-note bancard rollback error:', e?.message || e);
          refundPending = true; // registramos la nota igual, marcada como pendiente
        }
      } else {
        refundPending = true; // sin shop_process_id de Bancard → conciliación manual
      }
    }

    const creditNote = await req.prisma.creditNote.create({
      data: {
        paymentId: b.paymentId || null,
        userId: b.userId,
        amountGs: b.amountGs,
        reason: b.reason,
        type: b.type,
        stripeRefundId, // ref del rollback de Bancard (columna reutilizada)
        createdById: req.user.id,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        payment: { select: { id: true, amountGs: true, status: true } },
      },
    });

    // Si el pago quedó totalmente reembolsado en Bancard, reflejarlo en el Payment.
    if (refundDone && payment && b.amountGs >= payment.amountGs) {
      await req.prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } }).catch(() => {});
    }

    await audit(req.prisma, {
      userId: req.user.id, action: 'CREDIT_NOTE_CREATE', entity: 'CreditNote', entityId: creditNote.id,
      detailsJson: { type: b.type, amountGs: b.amountGs, paymentId: b.paymentId || null, bancardRollbackRef: stripeRefundId, refundPending },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: creditNote,
      meta: { bancardRollbackRef: stripeRefundId, refundPending },
      message: refundPending
        ? 'Nota de crédito registrada. El reembolso por Bancard quedó pendiente de conciliación manual.'
        : 'Nota de crédito registrada',
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  CUENTAS POR COBRAR
// ════════════════════════════════════════════════════════════════

// GET /api/accounting/receivables — saldos pendientes por cliente.
// Usa Credit con status 'open' (campos nuevos del contrato) y, además,
// suma los Payment en estado PENDING como cobros aún no realizados.
router.get('/receivables', ...adminOnly, async (req, res, next) => {
  try {
    const now = new Date();

    // 1) Créditos marcados como cuentas por cobrar (status open o legacy con saldo).
    const credits = await req.prisma.credit.findMany({
      where: {
        OR: [
          { status: 'open' },
          { AND: [{ status: null }, { dueDate: { not: null } }] },
        ],
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { dueDate: 'asc' },
    });

    const creditReceivables = credits
      .map((c) => {
        const outstanding = (c.amount || 0) - (c.settledGs || 0);
        return {
          source: 'credit',
          id: c.id,
          userId: c.userId,
          user: c.user,
          amountGs: c.amount,
          settledGs: c.settledGs || 0,
          outstandingGs: outstanding,
          dueDate: c.dueDate,
          overdue: !!(c.dueDate && new Date(c.dueDate) < now),
          description: c.description,
          createdAt: c.createdAt,
        };
      })
      .filter((r) => r.outstandingGs > 0);

    // 2) Pagos PENDING (cobros emitidos no acreditados todavía).
    const pendingPayments = await req.prisma.payment.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const paymentReceivables = pendingPayments.map((p) => ({
      source: 'payment',
      id: p.id,
      userId: p.userId,
      user: p.user,
      amountGs: p.amountGs,
      settledGs: 0,
      outstandingGs: p.amountGs,
      dueDate: null,
      overdue: false,
      description: p.description,
      createdAt: p.createdAt,
    }));

    const items = [...creditReceivables, ...paymentReceivables];

    // Agrupado por cliente para el panel.
    const byClientMap = new Map();
    for (const it of items) {
      const key = it.userId;
      const entry = byClientMap.get(key) || {
        userId: it.userId,
        user: it.user,
        outstandingGs: 0,
        overdueGs: 0,
        count: 0,
      };
      entry.outstandingGs += it.outstandingGs;
      if (it.overdue) entry.overdueGs += it.outstandingGs;
      entry.count += 1;
      byClientMap.set(key, entry);
    }
    const byClient = Array.from(byClientMap.values()).sort((a, b) => b.outstandingGs - a.outstandingGs);

    const totalOutstandingGs = items.reduce((s, it) => s + it.outstandingGs, 0);
    const totalOverdueGs = items.reduce((s, it) => s + (it.overdue ? it.outstandingGs : 0), 0);

    res.json({
      success: true,
      data: {
        items,
        byClient,
        totals: { outstandingGs: totalOutstandingGs, overdueGs: totalOverdueGs, count: items.length },
      },
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  CONTABILIDAD DE PARTIDA DOBLE
// ════════════════════════════════════════════════════════════════

// GET /api/accounting/accounts — plan de cuentas.
router.get('/accounts', ...adminOnly, async (req, res, next) => {
  try {
    const { type } = req.query;
    const where = {};
    if (type) where.type = type;
    const accounts = await req.prisma.account.findMany({ where, orderBy: { code: 'asc' } });
    res.json({ success: true, data: accounts });
  } catch (err) { next(err); }
});

// POST /api/accounting/accounts — crear cuenta del plan (code @unique).
router.post('/accounts', ...adminOnly, validateBody(accountSchema), async (req, res, next) => {
  try {
    const account = await req.prisma.account.create({ data: req.validatedBody });
    res.status(201).json({ success: true, data: account });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'Ya existe una cuenta con ese código' });
    next(err);
  }
});

// GET /api/accounting/journal — asientos contables (paginado, con rango de fecha).
router.get('/journal', ...adminOnly, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, from, to } = req.query;
    const take = Math.min(parseInt(limit) || 20, 100);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const where = {};
    const gte = parseDate(from);
    const lte = parseDate(to);
    if (gte || lte) {
      where.date = {};
      if (gte) where.date.gte = gte;
      if (lte) where.date.lte = lte;
    }

    const [entries, total] = await Promise.all([
      req.prisma.journalEntry.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          lines: { include: { account: { select: { id: true, code: true, name: true, type: true } } } },
        },
      }),
      req.prisma.journalEntry.count({ where }),
    ]);

    res.json({
      success: true,
      data: entries,
      pagination: { page: parseInt(page) || 1, limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err) { next(err); }
});

// POST /api/accounting/journal — crear asiento (valida debe === haber).
router.post('/journal', ...adminOnly, validateBody(journalEntrySchema), async (req, res, next) => {
  try {
    const b = req.validatedBody;
    const date = parseDate(b.date);
    if (!date) return res.status(400).json({ success: false, message: 'Fecha inválida' });

    // Cada línea usa debe O haber (no ambos), y al menos uno > 0.
    for (const ln of b.lines) {
      if (ln.debitGs > 0 && ln.creditGs > 0) {
        return res.status(400).json({ success: false, message: 'Cada línea usa debe o haber, no ambos' });
      }
      if (ln.debitGs === 0 && ln.creditGs === 0) {
        return res.status(400).json({ success: false, message: 'Cada línea debe tener un monto en debe o haber' });
      }
    }

    const totalDebit = b.lines.reduce((s, ln) => s + ln.debitGs, 0);
    const totalCredit = b.lines.reduce((s, ln) => s + ln.creditGs, 0);
    if (totalDebit !== totalCredit) {
      return res.status(400).json({
        success: false,
        message: `El asiento no balancea: debe ₲${totalDebit.toLocaleString('es-PY')} ≠ haber ₲${totalCredit.toLocaleString('es-PY')}`,
      });
    }

    // Verificar que las cuentas existan.
    const accountIds = [...new Set(b.lines.map((l) => l.accountId))];
    const accountsCount = await req.prisma.account.count({ where: { id: { in: accountIds } } });
    if (accountsCount !== accountIds.length) {
      return res.status(400).json({ success: false, message: 'Una o más cuentas no existen' });
    }

    const entry = await req.prisma.journalEntry.create({
      data: {
        date,
        description: b.description,
        reference: b.reference || null,
        createdById: req.user.id,
        lines: { create: b.lines.map((l) => ({ accountId: l.accountId, debitGs: l.debitGs, creditGs: l.creditGs })) },
      },
      include: { lines: { include: { account: { select: { id: true, code: true, name: true, type: true } } } } },
    });

    await audit(req.prisma, {
      userId: req.user.id, action: 'JOURNAL_ENTRY_CREATE', entity: 'JournalEntry', entityId: entry.id,
      detailsJson: { totalDebit, totalCredit, lines: b.lines.length, reference: b.reference || null },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: entry });
  } catch (err) { next(err); }
});

// GET /api/accounting/ledger — libro mayor: saldo por cuenta (con rango de fecha).
router.get('/ledger', ...adminOnly, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const gte = parseDate(from);
    const lte = parseDate(to);
    const entryWhere = {};
    if (gte || lte) {
      entryWhere.date = {};
      if (gte) entryWhere.date.gte = gte;
      if (lte) entryWhere.date.lte = lte;
    }

    const lines = await req.prisma.journalLine.findMany({
      where: { entry: entryWhere },
      include: { account: { select: { id: true, code: true, name: true, type: true } } },
    });

    const map = new Map();
    for (const ln of lines) {
      const a = ln.account;
      const entry = map.get(a.id) || { accountId: a.id, code: a.code, name: a.name, type: a.type, debitGs: 0, creditGs: 0 };
      entry.debitGs += ln.debitGs;
      entry.creditGs += ln.creditGs;
      map.set(a.id, entry);
    }

    // Saldo según naturaleza de la cuenta: activo/gasto = debe - haber; resto = haber - debe.
    const ledger = Array.from(map.values()).map((e) => {
      const debitNature = e.type === 'asset' || e.type === 'expense';
      return { ...e, balanceGs: debitNature ? e.debitGs - e.creditGs : e.creditGs - e.debitGs };
    }).sort((a, b) => a.code.localeCompare(b.code));

    const totalDebit = ledger.reduce((s, e) => s + e.debitGs, 0);
    const totalCredit = ledger.reduce((s, e) => s + e.creditGs, 0);

    res.json({ success: true, data: { ledger, totals: { debitGs: totalDebit, creditGs: totalCredit, balanced: totalDebit === totalCredit } } });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  REPORTES
// ════════════════════════════════════════════════════════════════

// GET /api/accounting/reports/income-statement?from&to
// Ingresos = Payment COMPLETED; Egresos = Expense; Utilidad = ingresos − egresos.
router.get('/reports/income-statement', ...adminOnly, async (req, res, next) => {
  try {
    const gte = parseDate(req.query.from);
    const lte = parseDate(req.query.to);

    const incomeWhere = { status: 'COMPLETED' };
    if (gte || lte) {
      incomeWhere.createdAt = {};
      if (gte) incomeWhere.createdAt.gte = gte;
      if (lte) incomeWhere.createdAt.lte = lte;
    }

    const expenseWhere = {};
    if (gte || lte) {
      expenseWhere.date = {};
      if (gte) expenseWhere.date.gte = gte;
      if (lte) expenseWhere.date.lte = lte;
    }

    const [incomeAgg, expensesByCat, expenseTotal, creditNotesAgg, categories] = await Promise.all([
      req.prisma.payment.aggregate({ where: incomeWhere, _sum: { amountGs: true, applicationFeeGs: true }, _count: true }),
      req.prisma.expense.groupBy({ by: ['categoryId'], where: expenseWhere, _sum: { amountGs: true }, _count: true }),
      req.prisma.expense.aggregate({ where: expenseWhere, _sum: { amountGs: true } }),
      // Notas de crédito de tipo refund/cancellation reducen los ingresos del período.
      req.prisma.creditNote.aggregate({
        where: {
          type: { in: ['refund', 'cancellation'] },
          ...(gte || lte ? { createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } } : {}),
        },
        _sum: { amountGs: true },
      }),
      req.prisma.expenseCategory.findMany({ select: { id: true, name: true, color: true } }),
    ]);

    const catMap = new Map(categories.map((c) => [c.id, c]));
    const expenseBreakdown = expensesByCat
      .map((g) => {
        const cat = catMap.get(g.categoryId);
        return {
          categoryId: g.categoryId,
          name: cat?.name || 'Sin categoría',
          color: cat?.color || null,
          amountGs: g._sum.amountGs || 0,
          count: g._count,
        };
      })
      .sort((a, b) => b.amountGs - a.amountGs);

    const grossIncomeGs = incomeAgg._sum.amountGs || 0;
    const refundsGs = creditNotesAgg._sum.amountGs || 0;
    const netIncomeGs = grossIncomeGs - refundsGs;
    const platformFeesGs = incomeAgg._sum.applicationFeeGs || 0;
    const totalExpensesGs = expenseTotal._sum.amountGs || 0;
    const profitGs = netIncomeGs - totalExpensesGs;

    res.json({
      success: true,
      data: {
        period: { from: gte, to: lte },
        income: {
          grossGs: grossIncomeGs,
          refundsGs,
          netGs: netIncomeGs,
          platformFeesGs,
          paymentCount: incomeAgg._count,
        },
        expenses: { totalGs: totalExpensesGs, breakdown: expenseBreakdown },
        profitGs,
        marginPercent: netIncomeGs > 0 ? Math.round((profitGs / netIncomeGs) * 100) : 0,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/accounting/reports/iva?month=YYYY-MM
// IVA débito (ventas) vs IVA de egresos. IVA incluido en montos (general 10%).
router.get('/reports/iva', ...adminOnly, async (req, res, next) => {
  try {
    const month = req.query.month; // YYYY-MM
    let start, end;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 1);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    const [salesAgg, expenseAgg] = await Promise.all([
      req.prisma.payment.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: start, lt: end } },
        _sum: { amountGs: true },
      }),
      req.prisma.expense.findMany({
        where: { date: { gte: start, lt: end } },
        select: { amountGs: true, ivaGs: true },
      }),
    ]);

    // IVA débito (ventas): el monto cobrado incluye IVA 10% → débito = bruto - bruto/1.1.
    const salesGrossGs = salesAgg._sum.amountGs || 0;
    const ivaDebitoGs = ivaFromGross(salesGrossGs);

    // IVA crédito (egresos): usa ivaGs si está cargado; si no, lo estima del bruto.
    let expenseGrossGs = 0;
    let ivaCreditoGs = 0;
    for (const e of expenseAgg) {
      expenseGrossGs += e.amountGs || 0;
      ivaCreditoGs += e.ivaGs != null ? e.ivaGs : ivaFromGross(e.amountGs || 0);
    }

    const ivaNetoGs = ivaDebitoGs - ivaCreditoGs; // a pagar si > 0; a favor si < 0

    res.json({
      success: true,
      data: {
        period: { month: month || `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`, from: start, to: end },
        rate: IVA_RATE,
        sales: { grossGs: salesGrossGs, ivaDebitoGs },
        expenses: { grossGs: expenseGrossGs, ivaCreditoGs },
        ivaNetoGs,
        status: ivaNetoGs >= 0 ? 'a_pagar' : 'a_favor',
      },
    });
  } catch (err) { next(err); }
});

// GET /api/accounting/reports/summary — KPIs reales para el dashboard contable.
router.get('/reports/summary', ...adminOnly, async (req, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      incomeMonth, incomePrevMonth, expenseMonth, expensePrevMonth,
      pendingPaymentsAgg, openCredits, creditNotesMonth,
    ] = await Promise.all([
      req.prisma.payment.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: monthStart, lt: nextMonthStart } }, _sum: { amountGs: true }, _count: true }),
      req.prisma.payment.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: prevMonthStart, lt: monthStart } }, _sum: { amountGs: true } }),
      req.prisma.expense.aggregate({ where: { date: { gte: monthStart, lt: nextMonthStart } }, _sum: { amountGs: true }, _count: true }),
      req.prisma.expense.aggregate({ where: { date: { gte: prevMonthStart, lt: monthStart } }, _sum: { amountGs: true } }),
      req.prisma.payment.aggregate({ where: { status: 'PENDING' }, _sum: { amountGs: true }, _count: true }),
      req.prisma.credit.findMany({ where: { status: 'open' }, select: { amount: true, settledGs: true, dueDate: true } }),
      req.prisma.creditNote.aggregate({ where: { createdAt: { gte: monthStart, lt: nextMonthStart } }, _sum: { amountGs: true }, _count: true }),
    ]);

    const incomeMonthGs = incomeMonth._sum.amountGs || 0;
    const incomePrevGs = incomePrevMonth._sum.amountGs || 0;
    const expenseMonthGs = expenseMonth._sum.amountGs || 0;
    const expensePrevGs = expensePrevMonth._sum.amountGs || 0;

    // Cuentas por cobrar (créditos abiertos) + pagos pendientes.
    let receivablesGs = pendingPaymentsAgg._sum.amountGs || 0;
    let overdueGs = 0;
    for (const c of openCredits) {
      const out = (c.amount || 0) - (c.settledGs || 0);
      if (out > 0) {
        receivablesGs += out;
        if (c.dueDate && new Date(c.dueDate) < now) overdueGs += out;
      }
    }

    const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : (cur > 0 ? 100 : 0));

    res.json({
      success: true,
      data: {
        month: { income: incomeMonthGs, expenses: expenseMonthGs, profit: incomeMonthGs - expenseMonthGs },
        trend: { incomePercent: pct(incomeMonthGs, incomePrevGs), expensePercent: pct(expenseMonthGs, expensePrevGs) },
        counts: { payments: incomeMonth._count, expenses: expenseMonth._count, creditNotes: creditNotesMonth._count },
        receivables: { totalGs: receivablesGs, overdueGs, pendingPayments: pendingPaymentsAgg._count },
        creditNotesMonthGs: creditNotesMonth._sum.amountGs || 0,
      },
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  CONCILIACIÓN STRIPE
// ════════════════════════════════════════════════════════════════

// GET /api/accounting/reconciliation?from&to
// Ventas registradas (Payment COMPLETED) vs StripeLedgerEntry; comisiones y diferencias.
router.get('/reconciliation', ...adminOnly, async (req, res, next) => {
  try {
    const gte = parseDate(req.query.from);
    const lte = parseDate(req.query.to);

    const paymentWhere = { status: 'COMPLETED' };
    if (gte || lte) {
      paymentWhere.createdAt = {};
      if (gte) paymentWhere.createdAt.gte = gte;
      if (lte) paymentWhere.createdAt.lte = lte;
    }

    const ledgerWhere = {};
    if (gte || lte) {
      ledgerWhere.createdAt = {};
      if (gte) ledgerWhere.createdAt.gte = gte;
      if (lte) ledgerWhere.createdAt.lte = lte;
    }

    const [paymentAgg, ledgerEntries] = await Promise.all([
      req.prisma.payment.aggregate({ where: paymentWhere, _sum: { amountGs: true, applicationFeeGs: true }, _count: true }),
      req.prisma.stripeLedgerEntry.findMany({
        where: ledgerWhere,
        select: { type: true, direction: true, amountGs: true, status: true, paymentId: true },
      }),
    ]);

    // Agregar el ledger por tipo de movimiento (charge, application_fee, transfer, payout, refund).
    const byType = {};
    for (const le of ledgerEntries) {
      const k = le.type || 'unknown';
      if (!byType[k]) byType[k] = { type: k, count: 0, amountGs: 0 };
      byType[k].count += 1;
      byType[k].amountGs += le.amountGs || 0;
    }
    const ledgerByType = Object.values(byType).sort((a, b) => b.amountGs - a.amountGs);

    const registeredSalesGs = paymentAgg._sum.amountGs || 0;
    const registeredFeesGs = paymentAgg._sum.applicationFeeGs || 0;
    const ledgerChargesGs = byType.charge?.amountGs || 0;
    const ledgerFeesGs = byType.application_fee?.amountGs || 0;
    const ledgerRefundsGs = byType.refund?.amountGs || 0;

    // Pagos COMPLETED sin ninguna entrada en el ledger (posible discrepancia).
    const ledgerPaymentIds = new Set(ledgerEntries.map((l) => l.paymentId).filter(Boolean));
    const completedPayments = await req.prisma.payment.findMany({
      where: paymentWhere,
      select: { id: true, amountGs: true, createdAt: true, stripePaymentIntentId: true },
    });
    const unmatchedPayments = completedPayments.filter((p) => !ledgerPaymentIds.has(p.id));

    res.json({
      success: true,
      data: {
        period: { from: gte, to: lte },
        registered: { salesGs: registeredSalesGs, feesGs: registeredFeesGs, count: paymentAgg._count },
        stripeLedger: { chargesGs: ledgerChargesGs, feesGs: ledgerFeesGs, refundsGs: ledgerRefundsGs, byType: ledgerByType },
        differences: {
          salesVsCharges: registeredSalesGs - ledgerChargesGs,
          feesVsLedgerFees: registeredFeesGs - ledgerFeesGs,
        },
        unmatchedPayments: unmatchedPayments.map((p) => ({ id: p.id, amountGs: p.amountGs, createdAt: p.createdAt })),
        reconciled: registeredSalesGs === ledgerChargesGs && unmatchedPayments.length === 0,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
