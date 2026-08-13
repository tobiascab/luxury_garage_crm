#!/usr/bin/env node
/**
 * Repara planes que dan cobertura a servicios que ya no existen.
 *
 * Los planes guardan a qué servicios cubren por `slug` (en `plan.servicesIncluded`). Si a un
 * servicio le cambian el slug —lo que pasaba al renombrarlo desde el panel— el plan queda
 * apuntando al vacío y **deja de cubrir ese servicio**: el cliente pasa a pagar cada lavado
 * aparte pese a tener plan pago. Este script detecta esos huérfanos y los reapunta.
 *
 * Para cada slug huérfano busca el servicio de destino por, en este orden:
 *   1. coincidencia exacta de slug (nada que hacer),
 *   2. el slug huérfano contenido en el actual o viceversa (típico de un renombre),
 *   3. similitud alta entre las palabras del slug.
 * Si no encuentra un único candidato claro, NO adivina: lo reporta para resolver a mano.
 *
 * Uso:
 *   node scripts/reparar-planes-huerfanos.js             → diagnóstico, no cambia nada
 *   node scripts/reparar-planes-huerfanos.js --aplicar   → aplica las reparaciones seguras
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');

const APLICAR = process.argv.includes('--aplicar');
const client = new Client({ connectionString: process.env.DATABASE_URL });

const palabras = (s) => new Set(String(s).split('-').filter((w) => w.length > 2));
function similitud(a, b) {
  const A = palabras(a), B = palabras(b);
  if (!A.size || !B.size) return 0;
  const comunes = [...A].filter((w) => B.has(w)).length;
  return comunes / Math.max(A.size, B.size);
}

(async () => {
  await client.connect();
  try {
    const { rows: servicios } = await client.query('SELECT id, slug, name, is_active FROM services');
    const { rows: planes } = await client.query('SELECT id, name, services_included FROM plans ORDER BY price_gs');
    const slugsVivos = new Set(servicios.map((s) => s.slug));

    const reparaciones = [];
    const sinResolver = [];

    for (const plan of planes) {
      const incluidos = Array.isArray(plan.services_included) ? plan.services_included : [];
      let cambio = false;
      const nuevos = incluidos.map((item) => {
        if (!item?.slug || slugsVivos.has(item.slug)) return item;

        // Candidatos: por contención (renombre típico) o por similitud de palabras.
        const porContencion = servicios.filter(
          (s) => s.slug.includes(item.slug) || item.slug.includes(s.slug)
        );
        const porSimilitud = servicios
          .map((s) => ({ s, sim: similitud(item.slug, s.slug) }))
          .filter((x) => x.sim >= 0.6)
          .sort((a, b) => b.sim - a.sim);

        const candidatos = porContencion.length ? porContencion : porSimilitud.map((x) => x.s);
        if (candidatos.length === 1) {
          cambio = true;
          reparaciones.push({ plan: plan.name, de: item.slug, a: candidatos[0].slug, servicio: candidatos[0].name });
          return { ...item, slug: candidatos[0].slug };
        }
        sinResolver.push({ plan: plan.name, slug: item.slug, candidatos: candidatos.map((c) => c.slug) });
        return item;
      });
      plan._nuevos = cambio ? nuevos : null;
    }

    console.log(`Servicios en el catálogo: ${servicios.length} · Planes: ${planes.length}\n`);

    if (!reparaciones.length && !sinResolver.length) {
      console.log('✅ Todos los planes apuntan a servicios que existen. Nada que reparar.');
      return;
    }

    if (reparaciones.length) {
      console.log('🔧 Coberturas rotas que se pueden reparar:');
      reparaciones.forEach((r) => console.log(`   • ${r.plan}: "${r.de}" → "${r.a}"  (${r.servicio})`));
    }
    if (sinResolver.length) {
      console.log('\n⚠️  Sin candidato claro (resolver a mano desde Admin › Planes):');
      sinResolver.forEach((r) => console.log(`   • ${r.plan}: "${r.slug}"  candidatos: ${r.candidatos.join(', ') || 'ninguno'}`));
    }

    if (!APLICAR) {
      console.log('\n🧪 Diagnóstico solamente. Corré con --aplicar para reparar.');
      return;
    }

    await client.query('BEGIN');
    let n = 0;
    for (const plan of planes) {
      if (!plan._nuevos) continue;
      await client.query('UPDATE plans SET services_included = $1 WHERE id = $2', [JSON.stringify(plan._nuevos), plan.id]);
      n++;
    }
    await client.query('COMMIT');
    console.log(`\n✅ ${n} plan(es) reparado(s).`);

    const { rows: check } = await client.query('SELECT name, services_included FROM plans ORDER BY price_gs');
    console.log('\nCobertura resultante:');
    check.forEach((p) => {
      const items = Array.isArray(p.services_included) ? p.services_included : [];
      const detalle = items.map((i) => `${i.slug}${Number(i.quota) === -1 ? ' (ilimitado)' : ` (${i.quota})`}${slugsVivos.has(i.slug) ? '' : ' ❌'}`);
      console.log(`   • ${p.name}: ${detalle.join(', ') || '(sin servicios)'}`);
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
