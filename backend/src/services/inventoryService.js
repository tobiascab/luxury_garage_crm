/**
 * Inventory Service — lógica de stock con ledger inmutable.
 * Cada cambio de stock pasa por `applyMovement`, que actualiza el item y registra
 * un StockMovement en una transacción (nunca se edita stock sin dejar rastro).
 *
 * Concurrencia: `applyMovement` toma un lock de fila (`SELECT ... FOR UPDATE`) sobre
 * el item y usa operaciones atómicas (`{ decrement }` / `{ increment }`) para evitar
 * lost updates entre movimientos concurrentes del mismo insumo. El mismo patrón de
 * lock pesimista se usa en appointments.js (debitWallet).
 */

const ADD_TYPES = new Set(['IN', 'RETURN']); // suman stock; el resto resta

/**
 * Núcleo del movimiento: corre SIEMPRE dentro de una transacción (`tx`).
 * - Lock de fila del item (`FOR UPDATE`) → serializa movimientos concurrentes del insumo.
 * - Lee el stock FRESCO dentro del lock (no un valor obsoleto del caller).
 * - Aplica el delta de forma atómica (`decrement` / `increment`), no escribiendo un
 *   valor absoluto calculado en JS (evita pisar el movimiento de otra transacción).
 * Lanza error 400/404 salvo allowNegative.
 */
async function applyMovementTx(tx, {
  itemId, type, quantity, reason, unitCostGs, userId, serviceRecordId, supplierId, allowNegative = false,
}) {
  // Lock pesimista de la fila del item: serializa los movimientos concurrentes del insumo.
  // Devuelve [] si el item no existe (FOR UPDATE no bloquea filas inexistentes).
  const locked = await tx.$queryRaw`SELECT current_stock FROM inventory_items WHERE id = ${itemId} FOR UPDATE`;
  if (!locked.length) throw Object.assign(new Error('Insumo no encontrado'), { statusCode: 404 });

  const qty = Math.abs(Number(quantity) || 0);
  if (!qty) throw Object.assign(new Error('Cantidad inválida'), { statusCode: 400 });

  const isAdd = ADD_TYPES.has(type);
  const before = Number(locked[0].current_stock); // stock fresco bajo el lock
  const after = before + (isAdd ? qty : -qty);
  if (after < 0 && !allowNegative) {
    throw Object.assign(new Error('El stock resultante no puede ser negativo'), { statusCode: 400 });
  }

  // Operación atómica: no escribimos `after` absoluto, dejamos que la DB aplique el delta.
  const updated = await tx.inventoryItem.update({
    where: { id: itemId },
    data: { currentStock: isAdd ? { increment: qty } : { decrement: qty } },
  });

  const movement = await tx.stockMovement.create({
    data: {
      itemId, type, quantity: qty, quantityBefore: before, quantityAfter: after,
      reason: reason || null, unitCostGs: unitCostGs ?? null,
      userId: userId || null, serviceRecordId: serviceRecordId || null, supplierId: supplierId || null,
    },
  });

  return { item: updated, movement, before, after };
}

/**
 * Aplica un movimiento de stock a un item y lo registra en el ledger (atómico).
 * `quantity` siempre positivo; el signo lo define `type`.
 * Acepta un `tx` opcional (Prisma transaction client) para componerse dentro de una
 * transacción mayor; si no se pasa, abre su propia transacción interactiva.
 * Lanza error 400/404 salvo allowNegative (ej. consumo de un servicio ya realizado).
 */
async function applyMovement(prisma, args, tx = null) {
  if (tx) return applyMovementTx(tx, args);
  return prisma.$transaction((t) => applyMovementTx(t, args));
}

/**
 * Descuenta stock automáticamente al completar un servicio, según su receta
 * (ServiceConsumption). Elige la receta del tamaño exacto y, si no hay, la genérica
 * (vehicleSize null).
 *
 * ATÓMICO: todos los ítems de la receta se descuentan en UNA sola transacción; si uno
 * falla, se revierte el lote completo (no deja stock parcialmente descontado).
 *
 * NO bloquea el flujo del servicio (allowNegative): un servicio ya realizado se registra
 * igual aunque el stock quede negativo, pero cada caso así deja una traza VISIBLE
 * (console.error + AuditLog) — nunca pasa en silencio.
 *
 * Firma retrocompatible: el 4º arg `tx` es opcional. Si el caller ya está dentro de una
 * transacción puede pasarla; si no, se abre una propia.
 *
 * Devuelve { consumed, failed, negative, errors }. Si la transacción entera falla,
 * devuelve { consumed: 0, ..., error } (no relanza, para no bloquear el completar-servicio),
 * pero deja registro de auditoría para que el fallo no pase desapercibido.
 */
async function consumeStockForService(prisma, { serviceRecordId, serviceId, vehicleSize, employeeId }, tx = null) {
  let recipes;
  try {
    recipes = await prisma.serviceConsumption.findMany({ where: { serviceId } });
  } catch (e) {
    await logConsumptionFailure(prisma, { serviceRecordId, serviceId, employeeId, reason: 'recipe_lookup_failed', message: e.message });
    return { consumed: 0, failed: 0, negative: 0, errors: [e.message], error: e.message };
  }

  // Para cada item, quedarse con la receta del tamaño exacto; si no, la genérica (null).
  const byItem = new Map();
  for (const r of recipes) {
    if (r.vehicleSize && r.vehicleSize !== vehicleSize) continue; // receta de otro tamaño
    const prev = byItem.get(r.itemId);
    if (!prev || (r.vehicleSize === vehicleSize && prev.vehicleSize == null)) byItem.set(r.itemId, r);
  }
  const items = [...byItem.values()];

  // Todo el trabajo real (lock idempotente + consumo + marca de consumido) en UNA transacción.
  // IDEMPOTENTE: bajo lock de la fila del service_record, si ya tiene inventory_consumed_at,
  // se omite el descuento. Esto evita doble-consumo si /complete y /qr/scan cierran el mismo turno.
  const runInTx = async (t) => {
    // Lock pesimista de la fila del service_record → serializa cierres concurrentes del mismo turno.
    // (Mismo patrón FOR UPDATE usado para items aquí y para users en paymentReconciliation.js.)
    const locked = await t.$queryRaw`SELECT inventory_consumed_at FROM service_records WHERE id = ${serviceRecordId} FOR UPDATE`;
    // Si ya se consumió el inventario de este turno → no volver a descontar.
    if (locked.length && locked[0].inventory_consumed_at != null) {
      return { skipped: true, negatives: [], noRecipe: false };
    }

    // Caso SIN receta: no hay nada que descontar, pero igual marcamos como consumido
    // (para no re-alertar en reintentos) y dejamos auditoría VISIBLE.
    if (items.length === 0) {
      await t.$executeRaw`UPDATE service_records SET inventory_consumed_at = now() WHERE id = ${serviceRecordId}`;
      return { skipped: false, negatives: [], noRecipe: true };
    }

    const negatives = [];
    for (const r of items) {
      const { before, after } = await applyMovementTx(t, {
        itemId: r.itemId, type: 'CONSUMPTION', quantity: r.quantity,
        reason: 'Consumo automático de servicio', userId: employeeId,
        serviceRecordId, allowNegative: true,
      });
      if (after < 0) negatives.push({ itemId: r.itemId, quantity: r.quantity, before, after });
    }
    // Tras consumir con éxito, marcar el turno como consumido en la MISMA transacción.
    await t.$executeRaw`UPDATE service_records SET inventory_consumed_at = now() WHERE id = ${serviceRecordId}`;
    return { skipped: false, negatives, noRecipe: false };
  };

  try {
    const { skipped, negatives, noRecipe } = tx ? await runInTx(tx) : await prisma.$transaction(runInTx);

    // Ya estaba consumido: nada que descontar ni reportar.
    if (skipped) return { consumed: 0, failed: 0, negative: 0, errors: [], skipped: true };

    // SIN receta: el inventario quedó marcado como consumido; dejamos traza VISIBLE.
    if (noRecipe) {
      await safeAudit(prisma, {
        userId: employeeId || null,
        action: 'SERVICE_NO_RECIPE',
        entity: 'inventory_consumption',
        entityId: serviceRecordId || null,
        detailsJson: { serviceId, vehicleSize: vehicleSize || null },
      });
      return { consumed: 0, failed: 0, negative: 0, errors: [], warning: 'NO_RECIPE' };
    }

    // Stock negativo: el servicio se completó igual (allowNegative), pero NO en silencio.
    // Traza clara para reponer/auditar. Best-effort: no rompe el resultado si el log falla.
    for (const n of negatives) {
      console.error(
        `[inventory] STOCK NEGATIVO tras consumo de servicio: item=${n.itemId} `
        + `quedó en ${n.after} (consumió ${n.quantity}, había ${n.before}). serviceRecord=${serviceRecordId}`,
      );
    }
    if (negatives.length) {
      await safeAudit(prisma, {
        userId: employeeId || null,
        action: 'STOCK_NEGATIVE',
        entity: 'inventory_consumption',
        entityId: serviceRecordId || null,
        detailsJson: { serviceId, vehicleSize: vehicleSize || null, items: negatives },
      });
    }

    return { consumed: items.length, failed: 0, negative: negatives.length, errors: [] };
  } catch (e) {
    // La transacción se revirtió: NO hubo consumo parcial. Antes esto se tragaba con
    // console.warn y devolvía {consumed:0} como si fuera éxito → ahora queda registro VISIBLE.
    console.error(`[inventory] consumeStockForService FALLÓ (rollback completo) serviceRecord=${serviceRecordId}:`, e.message);
    await logConsumptionFailure(prisma, {
      serviceRecordId, serviceId, vehicleSize, employeeId,
      reason: 'consume_transaction_failed', message: e.message, itemCount: items.length,
    });
    return { consumed: 0, failed: items.length, negative: 0, errors: [e.message], error: e.message };
  }
}

/** AuditLog best-effort: nunca debe tumbar el flujo de negocio si el log falla. */
async function safeAudit(prisma, data) {
  try {
    await prisma.auditLog.create({ data });
  } catch (e) {
    console.error('[inventory] no se pudo registrar AuditLog:', e.message);
  }
}

/** Registra un fallo de consumo de stock de forma visible (log error + auditoría). */
async function logConsumptionFailure(prisma, { serviceRecordId, serviceId, vehicleSize, employeeId, reason, message, itemCount }) {
  console.error(`[inventory] consumo de stock fallido (${reason}) serviceRecord=${serviceRecordId} service=${serviceId}:`, message);
  await safeAudit(prisma, {
    userId: employeeId || null,
    action: 'STOCK_CONSUMPTION_FAILED',
    entity: 'inventory_consumption',
    entityId: serviceRecordId || null,
    detailsJson: { serviceId, vehicleSize: vehicleSize || null, reason, message, itemCount: itemCount ?? null },
  });
}

module.exports = { applyMovement, consumeStockForService };
