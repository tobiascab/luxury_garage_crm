const bancardService = require('./bancardService');

/**
 * Trae las tarjetas del cliente desde Bancard y las deja iguales en nuestra base.
 *
 * Existe porque las dos puntas se pueden desincronizar: Bancard redirige el navegador al
 * terminar el catastro, así que si el cliente no vuelve a la app —o cierra antes— la tarjeta
 * queda registrada allá y no acá. El resultado es un callejón sin salida: no la ve en su
 * perfil y, al intentar cargarla de nuevo, Bancard la rechaza con "la tarjeta ya ha sido
 * catastrada por ese usuario". Sincronizar deshace ese nudo.
 *
 * Además refresca el alias_token, que vence rápido y es lo que después permite cobrar.
 *
 * @returns {{cards: Array, nuevas: number}}
 */
async function sincronizarTarjetas(prisma, user) {
  if (!user?.bancardUserId) return { cards: [], nuevas: 0 };

  const enBancard = await bancardService.getUserCards(user.bancardUserId);
  const locales = await prisma.paymentCard.findMany({ where: { userId: user.id } });

  let nuevas = 0;
  for (const card of enBancard || []) {
    const bancardCardId = parseInt(card.card_id);
    if (!Number.isFinite(bancardCardId)) continue;
    const existente = locales.find((c) => c.bancardCardId === bancardCardId);

    if (existente) {
      await prisma.paymentCard.update({
        where: { id: existente.id },
        data: {
          bancardAliasToken: card.alias_token,
          maskedNumber: card.card_masked_number || existente.maskedNumber,
          brand: card.card_brand || existente.brand,
          cardType: card.card_type || existente.cardType,
          expirationDate: card.expiration_date || existente.expirationDate,
        },
      });
    } else {
      // La primera tarjeta del cliente queda como principal: es la que se usa por defecto
      // para cobrar sin que tenga que elegir nada.
      const esPrimera = locales.length === 0 && nuevas === 0;
      await prisma.paymentCard.create({
        data: {
          userId: user.id,
          bancardCardId,
          bancardAliasToken: card.alias_token,
          maskedNumber: card.card_masked_number || '****',
          brand: card.card_brand || 'Tarjeta',
          cardType: card.card_type || null,
          expirationDate: card.expiration_date || null,
          alias: `${card.card_brand || 'Tarjeta'} ${card.card_masked_number ? '...' + card.card_masked_number.slice(-4) : ''}`.trim(),
          isPrimary: esPrimera,
        },
      });
      nuevas++;
    }
  }

  const cards = await prisma.paymentCard.findMany({
    where: { userId: user.id },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
  });
  return { cards, nuevas };
}

module.exports = { sincronizarTarjetas };
