#!/usr/bin/env node
/**
 * ARIZAR IA Setup Script
 * Crea custom fields, tags y productos en ARIZAR IA
 * 
 * Uso: node scripts/setup-arizar.js
 * Requiere: ARIZAR_API_TOKEN y ARIZAR_LOCATION_ID en .env
 */
require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.ARIZAR_BASE_URL || 'https://services.leadconnectorhq.com';
const TOKEN = process.env.ARIZAR_API_TOKEN;
const LOCATION_ID = process.env.ARIZAR_LOCATION_ID;
const VERSION = process.env.ARIZAR_API_VERSION || '2021-07-28';

if (!TOKEN || TOKEN === 'pending_configuration') {
  console.error('❌ ARIZAR_API_TOKEN no configurado. Setéalo en .env');
  process.exit(1);
}
if (!LOCATION_ID || LOCATION_ID === 'pending_configuration') {
  console.error('❌ ARIZAR_LOCATION_ID no configurado. Setéalo en .env');
  process.exit(1);
}

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Version': VERSION,
    'Content-Type': 'application/json',
  },
});

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════
// 1. CUSTOM FIELDS
// ═══════════════════════════════════════
const CUSTOM_FIELDS = [
  { name: 'luxury_plan', dataType: 'TEXT', placeholder: 'Plan del cliente (basico/premium/vip)' },
  { name: 'luxury_plan_status', dataType: 'TEXT', placeholder: 'Estado (active/expired/cancelled)' },
  { name: 'luxury_plan_expiry', dataType: 'DATE', placeholder: 'Fecha de vencimiento del plan' },
  { name: 'luxury_vehicle_1', dataType: 'TEXT', placeholder: 'Vehículo 1: Marca Modelo Año - Patente' },
  { name: 'luxury_vehicle_2', dataType: 'TEXT', placeholder: 'Vehículo 2: Marca Modelo Año - Patente' },
  { name: 'luxury_services_used', dataType: 'NUMERICAL', placeholder: 'Cantidad de lavados realizados' },
  { name: 'luxury_last_visit', dataType: 'DATE', placeholder: 'Fecha del último servicio' },
  { name: 'luxury_wallet_balance', dataType: 'NUMERICAL', placeholder: 'Saldo de billetera en Gs' },
  { name: 'luxury_referral_code', dataType: 'TEXT', placeholder: 'Código de referido' },
  { name: 'luxury_user_id', dataType: 'TEXT', placeholder: 'ID interno en Luxury Garage' },
];

async function createCustomFields() {
  console.log('\n═══ CREANDO CUSTOM FIELDS ═══');
  
  // Get existing fields first
  let existing = [];
  try {
    const res = await client.get(`/locations/${LOCATION_ID}/customFields`);
    existing = res.data?.customFields || res.data?.data || [];
    console.log(`  📋 Campos existentes: ${existing.length}`);
  } catch (e) {
    console.log('  ⚠️ No se pudieron obtener campos existentes:', e.response?.data?.message || e.message);
  }

  const existingNames = existing.map(f => f.name);
  let created = 0;

  for (const field of CUSTOM_FIELDS) {
    if (existingNames.includes(field.name)) {
      console.log(`  ✅ ${field.name} — ya existe`);
      continue;
    }
    try {
      await client.post(`/locations/${LOCATION_ID}/customFields`, {
        ...field,
        model: 'contact',
      });
      console.log(`  🆕 ${field.name} — creado`);
      created++;
      await delay(200);
    } catch (e) {
      console.error(`  ❌ ${field.name} — error:`, e.response?.data?.message || e.message);
    }
  }
  console.log(`  Resumen: ${created} creados, ${CUSTOM_FIELDS.length - created} ya existían`);
}

// ═══════════════════════════════════════
// 2. TAGS
// ═══════════════════════════════════════
const TAGS = [
  // Origen
  'luxury-garage', 'lead', 'lead-whatsapp', 'lead-referido', 'lead-funnel', 'lead-presencial',
  // Estado membresía
  'miembro-activo', 'miembro-inactivo', 'plan-basico', 'plan-premium', 'plan-vip',
  // Comportamiento
  'primer-lavado-completado', 'cliente-frecuente', 'cliente-inactivo-15d', 'cliente-inactivo-30d',
  'resena-positiva', 'resena-negativa', 'referidor-activo',
  // Ciclo de vida
  'renovacion-pendiente', 'oferta-enviada', 'recuperado', 'churned',
  // Sistema
  'auto-creado', 'credenciales-enviadas',
];

async function createTags() {
  console.log('\n═══ CREANDO TAGS ═══');
  
  let existing = [];
  try {
    const res = await client.get(`/locations/${LOCATION_ID}/tags`);
    existing = res.data?.tags || res.data?.data || [];
    console.log(`  📋 Tags existentes: ${existing.length}`);
  } catch (e) {
    console.log('  ⚠️ No se pudieron obtener tags:', e.response?.data?.message || e.message);
  }

  const existingNames = existing.map(t => (t.name || t).toLowerCase());
  let created = 0;

  for (const tag of TAGS) {
    if (existingNames.includes(tag.toLowerCase())) {
      console.log(`  ✅ ${tag} — ya existe`);
      continue;
    }
    try {
      await client.post(`/locations/${LOCATION_ID}/tags`, { name: tag });
      console.log(`  🆕 ${tag} — creado`);
      created++;
      await delay(200);
    } catch (e) {
      console.error(`  ❌ ${tag} — error:`, e.response?.data?.message || e.message);
    }
  }
  console.log(`  Resumen: ${created} creados, ${TAGS.length - created} ya existían`);
}

// ═══════════════════════════════════════
// 3. PRODUCTOS (Planes de membresía)
// ═══════════════════════════════════════
const PRODUCTS = [
  {
    name: 'Plan Básico - Luxury Garage',
    description: '8 lavados exteriores al mes. Ideal para mantener tu vehículo impecable.',
    price: { name: 'Mensual', amount: 250000, currency: 'PYG', type: 'one_time' },
  },
  {
    name: 'Plan Premium - Luxury Garage',
    description: '12 lavados completos al mes + aspirado interior. El más elegido.',
    price: { name: 'Mensual', amount: 450000, currency: 'PYG', type: 'one_time' },
  },
  {
    name: 'Plan VIP - Luxury Garage',
    description: 'Lavados ilimitados + detailing + prioridad en agenda. La experiencia máxima.',
    price: { name: 'Mensual', amount: 800000, currency: 'PYG', type: 'one_time' },
  },
];

async function createProducts() {
  console.log('\n═══ CREANDO PRODUCTOS ═══');

  let existing = [];
  try {
    const res = await client.get(`/products/?locationId=${LOCATION_ID}`);
    existing = res.data?.products || res.data?.data || [];
    console.log(`  📋 Productos existentes: ${existing.length}`);
  } catch (e) {
    console.log('  ⚠️ No se pudieron obtener productos:', e.response?.data?.message || e.message);
  }

  const existingNames = existing.map(p => p.name);

  for (const product of PRODUCTS) {
    if (existingNames.includes(product.name)) {
      console.log(`  ✅ ${product.name} — ya existe`);
      continue;
    }
    try {
      const res = await client.post('/products/', {
        locationId: LOCATION_ID,
        name: product.name,
        description: product.description,
        productType: 'SERVICE',
      });
      const productId = res.data?.id || res.data?.product?.id;
      console.log(`  🆕 ${product.name} — creado (ID: ${productId})`);

      // Create price
      if (productId) {
        await delay(200);
        try {
          await client.post(`/products/${productId}/price`, {
            ...product.price,
            locationId: LOCATION_ID,
          });
          console.log(`    💰 Precio creado: ₲${product.price.amount.toLocaleString()}`);
        } catch (pe) {
          console.error(`    ❌ Error creando precio:`, pe.response?.data?.message || pe.message);
        }
      }
      await delay(200);
    } catch (e) {
      console.error(`  ❌ ${product.name} — error:`, e.response?.data?.message || e.message);
    }
  }
}

// ═══════════════════════════════════════
// 4. WEBHOOK REGISTRATION
// ═══════════════════════════════════════
async function registerWebhooks() {
  console.log('\n═══ REGISTRANDO WEBHOOKS ═══');

  const webhookUrl = 'https://luxurygarage.arizar-ia.cloud/api/webhooks/arizar';
  const events = [
    'ContactCreate', 'ContactUpdate', 'ContactTagUpdate',
    'AppointmentCreate', 'AppointmentUpdate', 'AppointmentDelete',
    'OpportunityCreate', 'OpportunityStageUpdate', 'OpportunityStatusUpdate',
    'PaymentReceived', 'OrderCreate',
    'SubscriptionCreate', 'SubscriptionCancel',
    'InvoiceCreate', 'InvoiceSent', 'InvoicePartiallyPaid',
    'InboundMessage', 'OutboundMessage',
    'FormSubmission', 'SurveySubmission',
    'WorkflowContactAdd', 'WorkflowContactRemove',
  ];

  try {
    const res = await client.post('/webhooks/', {
      url: webhookUrl,
      events,
      locationId: LOCATION_ID,
    });
    console.log(`  ✅ Webhook registrado: ${events.length} eventos → ${webhookUrl}`);
    console.log(`  🆔 Webhook ID: ${res.data?.id || JSON.stringify(res.data)}`);
  } catch (e) {
    if (e.response?.status === 422 || e.response?.data?.message?.includes('already')) {
      console.log('  ✅ Webhooks ya registrados');
    } else {
      console.error('  ❌ Error:', e.response?.data?.message || e.message);
    }
  }
}

// ═══════════════════════════════════════
// 5. KNOWLEDGE BASE
// ═══════════════════════════════════════
async function setupKnowledgeBase() {
  console.log('\n═══ CONFIGURANDO KNOWLEDGE BASE ═══');

  try {
    // Create KB
    const kbRes = await client.post('/knowledge-base/', {
      locationId: LOCATION_ID,
      name: 'Luxury Garage - Info Completa',
      description: 'Información del lavadero para alimentar el bot IA',
    });
    const kbId = kbRes.data?.id || kbRes.data?.knowledgeBase?.id;
    console.log(`  🆕 Knowledge Base creada: ${kbId}`);

    if (!kbId) {
      console.log('  ⚠️ No se pudo obtener el ID. Skipping documents.');
      return;
    }

    await delay(500);

    // Documents to upload
    const documents = [
      {
        title: 'Planes y Precios',
        content: `LUXURY GARAGE - PLANES DE MEMBRESÍA

Plan Básico - ₲250.000/mes
- 8 lavados exteriores al mes
- Aspirado básico incluido
- Agenda por portal o WhatsApp

Plan Premium - ₲450.000/mes (MÁS ELEGIDO)
- 12 lavados completos al mes
- Aspirado interior incluido
- Prioridad en agenda
- Descuento en servicios extra

Plan VIP - ₲800.000/mes
- Lavados ilimitados
- Detailing mensual incluido
- Máxima prioridad en agenda
- Descuentos exclusivos en accesorios
- Trato preferencial

Todos los planes son mensuales sin permanencia mínima.
Se puede cambiar o cancelar en cualquier momento.
Los lavados no usados no se acumulan para el mes siguiente.`
      },
      {
        title: 'Servicios Disponibles',
        content: `LUXURY GARAGE - SERVICIOS

Lavado Exterior (30 min)
- Lavado con agua a presión, shampoo premium, enjuague y secado

Lavado Completo (45 min)
- Exterior + aspirado interior + limpieza de tablero

Lavado Premium + Aspirado (60 min)
- Completo + limpieza de vidrios interior/exterior + abrillantado

Detailing Completo (120 min)
- Lavado premium + pulido + encerado + hidratación de plásticos + limpieza profunda de interior

Limpieza de Tapizados (90 min)
- Lavado profundo de asientos y tapizados con vapor

Servicios extra disponibles para no-miembros con precios individuales.`
      },
      {
        title: 'Horarios y Ubicación',
        content: `LUXURY GARAGE - HORARIOS

Lunes a Viernes: 7:00 a 18:00
Sábados: 7:00 a 13:00
Domingos y Feriados: Cerrado

Los turnos se agendan desde el portal web o por WhatsApp.
Se recomienda agendar con al menos un día de anticipación.
Los turnos pueden cancelarse hasta 2 horas antes sin penalidad.`
      },
      {
        title: 'Preguntas Frecuentes',
        content: `LUXURY GARAGE - PREGUNTAS FRECUENTES

¿Cómo me hago miembro?
Podés elegir tu plan y pagar online. Una vez pagado, te creamos tu cuenta y ya podés agendar turnos.

¿Puedo cambiar de plan?
Sí, en cualquier momento. El cambio aplica desde el próximo ciclo de facturación.

¿Qué pasa si no uso todos mis lavados del mes?
No se acumulan para el mes siguiente.

¿Puedo traer más de un auto?
Sí, con el Plan Premium podés traer hasta 2 vehículos, y con el VIP es ilimitado.

¿Cómo agendo un turno?
Desde tu portal web (luxurygarage.arizar-ia.cloud) o escribiéndonos por WhatsApp.

¿Aceptan tarjeta de crédito/débito?
Sí, aceptamos todas las tarjetas via MasFacil. También aceptamos QR y transferencias.

¿Y si llueve?
Te notificamos y reprogramamos tu turno automáticamente.

¿Puedo cancelar mi membresía?
Sí, sin permanencia mínima. Podés cancelar cuando quieras.

¿Tienen estacionamiento?
Sí, podés dejar tu auto y retirarlo cuando esté listo. Te avisamos por WhatsApp.`
      },
    ];

    for (const doc of documents) {
      try {
        // Knowledge base documents are typically uploaded as files or text
        // Using FAQ format as it's more compatible
        await client.post(`/knowledge-base/${kbId}/faqs`, {
          question: doc.title,
          answer: doc.content,
        });
        console.log(`  📄 FAQ subida: ${doc.title}`);
        await delay(300);
      } catch (de) {
        console.error(`  ❌ Error subiendo "${doc.title}":`, de.response?.data?.message || de.message);
      }
    }
  } catch (e) {
    console.error('  ❌ Error creando Knowledge Base:', e.response?.data?.message || e.message);
  }
}

// ═══════════════════════════════════════
// 6. CONVERSATION AI BOT
// ═══════════════════════════════════════
async function setupConversationBot() {
  console.log('\n═══ CONFIGURANDO BOT IA ═══');

  try {
    const botRes = await client.post('/conversation-ai/bot', {
      locationId: LOCATION_ID,
      name: 'Luxury Garage Bot',
      instructions: `Sos el asistente virtual de Luxury Garage, un lavadero de autos premium en Paraguay.

Tu personalidad:
- Amable, profesional, breve
- Usás español paraguayo (tuteo con "vos")
- Siempre ofrecés ayuda adicional
- Usás emojis moderadamente

Información que conocés:
- Planes de membresía (está en tu Knowledge Base)
- Horarios de atención
- Servicios disponibles
- Preguntas frecuentes

Flujos que manejás:
1. Consultas generales → respondé con info de tu Knowledge Base
2. Interés en membresía → explicá los planes → preguntá cuál le interesa
3. Quiere agendar turno → pedile que entre al portal: https://luxurygarage.arizar-ia.cloud/login
4. Reclamo → escalar a humano inmediatamente
5. Saludo simple → saludá y preguntá en qué podés ayudar

Reglas estrictas:
- Si el cliente está enojado, escalá inmediatamente diciendo "Te comunico con un asesor"
- Nunca inventés precios o servicios
- Siempre cerrá con "¿Puedo ayudarte en algo más?"
- No des información técnica sobre el sistema, solo sobre el lavadero`,
      enabled: true,
    });
    console.log(`  🤖 Bot creado: ${botRes.data?.id || botRes.data?.bot?.id || 'OK'}`);
  } catch (e) {
    if (e.response?.status === 422) {
      console.log('  ✅ Bot ya existe');
    } else {
      console.error('  ❌ Error:', e.response?.data?.message || e.message);
    }
  }
}

// ═══════════════════════════════════════
// RUN ALL
// ═══════════════════════════════════════
async function main() {
  console.log('🚗 LUXURY GARAGE × ARIZAR IA — Setup Completo');
  console.log(`📡 Base URL: ${BASE_URL}`);
  console.log(`📍 Location: ${LOCATION_ID}`);
  console.log('');

  await createCustomFields();
  await createTags();
  await createProducts();
  await registerWebhooks();
  await setupKnowledgeBase();
  await setupConversationBot();

  console.log('\n═══════════════════════════════');
  console.log('✅ Setup completo de ARIZAR IA');
  console.log('═══════════════════════════════');
  console.log('\n📋 Próximos pasos manuales (en ARIZAR UI):');
  console.log('  1. Crear Pipeline "Membresías Luxury Garage" con 5 stages');
  console.log('  2. Crear Calendario "Turnos Luxury Garage"');
  console.log('  3. Crear los 4 Workflows (ver docs/integraciones/arizar/PLAN_INTEGRACION_ARIZAR_IA.md)');
  console.log('  4. Copiar IDs generados al archivo .env del backend');
  console.log('');
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
