#!/usr/bin/env node
/**
 * Crear Base de Conocimiento detallada en ARIZAR IA
 * para alimentar el Bot IA de Luxury Garage
 */
require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.ARIZAR_API_TOKEN;
const LOCATION_ID = process.env.ARIZAR_LOCATION_ID;

const client = axios.create({
  baseURL: 'https://services.leadconnectorhq.com',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json',
  },
});

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('📚 Creando Base de Conocimiento en ARIZAR IA...\n');

  // 1. Create knowledge base
  const kbRes = await client.post('/knowledge-base/', {
    locationId: LOCATION_ID,
    name: 'Luxury Garage - Base de Conocimiento',
    description: 'Información completa del lavadero premium para el asistente IA',
  });
  const kbId = kbRes.data?.data?.id || kbRes.data?.id;
  console.log(`✅ Knowledge Base creada: ${kbId}\n`);

  if (!kbId) {
    console.error('❌ No se pudo obtener el ID');
    process.exit(1);
  }

  await delay(1000);

  // 2. Upload text documents
  const documents = [
    {
      title: '1. SOBRE LUXURY GARAGE',
      body: `LUXURY GARAGE es un lavadero de autos premium ubicado en Lambaré, Paraguay.
Dirección: Avenida Cacique Lambaré 2030, Lambaré.
Contacto: WhatsApp y teléfono disponible.
Email: avanzatecgroupsa@gmail.com

MISIÓN: Ofrecer el mejor servicio de lavado y cuidado automotor en Paraguay, con tecnología de punta, productos premium y atención personalizada.

VISIÓN: Ser el lavadero de referencia en el Gran Asunción, reconocido por la calidad del servicio, la innovación y la satisfacción de nuestros miembros.

VALORES:
- Excelencia en cada lavado
- Atención personalizada
- Productos premium ecológicos
- Compromiso con el cuidado del vehículo
- Puntualidad y respeto por el tiempo del cliente

DIFERENCIADORES:
- Sistema de membresías con beneficios exclusivos
- Portal web para agendar turnos online
- Notificaciones por WhatsApp en cada etapa del servicio
- Productos de limpieza premium importados
- Personal capacitado y uniformado
- Área de espera cómoda con WiFi y café`,
    },
    {
      title: '2. PLANES DE MEMBRESÍA',
      body: `LUXURY GARAGE ofrece 3 planes de membresía mensual:

PLAN BÁSICO — ₲250.000/mes
Incluye:
- 8 lavados exteriores al mes
- Aspirado básico incluido en cada lavado
- Agenda por portal web o WhatsApp
- Notificaciones por WhatsApp
Ideal para: personas que quieren mantener su auto limpio con lavados regulares.

PLAN PREMIUM — ₲450.000/mes (EL MÁS ELEGIDO)
Incluye:
- 12 lavados completos al mes (exterior + interior)
- Aspirado interior completo incluido
- Prioridad en agenda (turnos preferentes)
- Descuento del 15% en servicios extra (detailing, tapizados)
- Hasta 2 vehículos registrados
Ideal para: personas exigentes que quieren un servicio completo y frecuente.

PLAN VIP — ₲800.000/mes
Incluye:
- Lavados ILIMITADOS (sin restricción de cantidad)
- Detailing mensual incluido (valor individual: ₲350.000)
- Máxima prioridad en agenda
- Descuento del 25% en todos los servicios extra
- Vehículos ilimitados registrados
- Trato preferencial y atención dedicada
Ideal para: familias, empresas o personas con múltiples vehículos.

INFORMACIÓN IMPORTANTE SOBRE MEMBRESÍAS:
- Todos los planes son mensuales, sin contrato ni permanencia mínima.
- Se puede cambiar de plan en cualquier momento. El cambio aplica desde el próximo ciclo.
- Se puede cancelar en cualquier momento sin penalidad.
- Los lavados no utilizados en el mes NO se acumulan para el siguiente.
- El pago se realiza online a través de MasFacil (tarjetas, QR, transferencias).
- Al pagar, la membresía se activa inmediatamente y dura 30 días.`,
    },
    {
      title: '3. SERVICIOS DISPONIBLES',
      body: `SERVICIOS DE LAVADO (incluidos en membresías según plan):

LAVADO EXTERIOR — 30 minutos
- Lavado con agua a presión
- Shampoo automotor premium
- Enjuague completo
- Secado con paños de microfibra
- Limpieza de llantas y neumáticos

LAVADO COMPLETO — 45 minutos
- Todo el lavado exterior
- Aspirado interior completo
- Limpieza de tablero y consola
- Limpieza de vidrios internos

LAVADO PREMIUM + ASPIRADO — 60 minutos
- Todo el lavado completo
- Limpieza de vidrios interior y exterior
- Abrillantado de pintura
- Acondicionamiento de plásticos exteriores
- Perfumado interior

SERVICIOS EXTRA (con costo adicional, descuento para miembros):

DETAILING COMPLETO — 120 minutos — ₲350.000
- Lavado premium completo
- Pulido de pintura (corrección de microrayas)
- Encerado con cera de carnauba
- Hidratación de plásticos y gomas
- Limpieza profunda de interior
- Acondicionamiento de cueros

LIMPIEZA DE TAPIZADOS — 90 minutos — ₲250.000
- Lavado profundo de asientos con vapor
- Extracción de manchas
- Desinfección y sanitización
- Secado profesional

TRATAMIENTO CERÁMICO — 180 minutos — ₲500.000
- Preparación de pintura
- Aplicación de coating cerámico profesional
- Protección por 6 meses a 1 año
- Brillo extremo y repelencia al agua

PULIDO DE FAROS — 30 minutos — ₲80.000
- Remoción de opacidad
- Pulido progresivo
- Sellado protector UV`,
    },
    {
      title: '4. HORARIOS Y AGENDA',
      body: `HORARIOS DE ATENCIÓN:
- Lunes a Viernes: 7:00 a 18:00
- Sábados: 7:00 a 13:00
- Domingos y Feriados: CERRADO

CÓMO AGENDAR UN TURNO:
1. Desde el portal web: https://luxurygarage.arizar-ia.cloud/client/book
   - Iniciar sesión con tu cuenta
   - Elegir servicio, vehículo, fecha y hora
   - Confirmar el turno
2. Por WhatsApp: Escribir a nuestro número y te ayudamos a agendar
3. Presencialmente: Venir al local en Av. Cacique Lambaré 2030

POLÍTICA DE TURNOS:
- Se recomienda agendar con al menos 1 día de anticipación.
- Los turnos pueden cancelarse hasta 2 horas antes sin penalidad.
- Si no cancelás y no venís, se cuenta como lavado utilizado de tu plan.
- La capacidad por día depende de la disponibilidad. Los miembros Premium y VIP tienen prioridad.
- Te avisamos por WhatsApp 24 horas antes de tu turno como recordatorio.
- Si llueve, te contactamos para reprogramar tu turno.

DURANTE EL SERVICIO:
- Podés dejar tu auto y retirarlo cuando esté listo.
- Te avisamos por WhatsApp cuando terminamos.
- Área de espera con WiFi y café disponible si preferís quedarte.`,
    },
    {
      title: '5. PAGOS Y FACTURACIÓN',
      body: `MÉTODOS DE PAGO:
- Tarjeta de crédito (todas las marcas) vía MasFacil
- Tarjeta de débito vía MasFacil
- Pago QR (Tigo Money, Personal Pay, Billetera Personal)
- Transferencia bancaria
- Efectivo (solo para servicios extra, no para membresías)

PROCESO DE PAGO DE MEMBRESÍA:
1. Elegís tu plan desde el portal web
2. Se genera un link de pago seguro (MasFacil)
3. Pagás con tu método preferido
4. La membresía se activa automáticamente
5. Recibís confirmación por WhatsApp y email
6. Se genera factura digital en el sistema

FACTURACIÓN:
- Las facturas se generan automáticamente al confirmar el pago.
- Podés ver todas tus facturas desde tu portal en la sección "Mi Membresía".
- Las facturas se envían también por email.
- Si necesitás factura con RUC empresarial, contactanos por WhatsApp.

RENOVACIÓN:
- Te avisamos 7 días antes del vencimiento por WhatsApp.
- Nuevo recordatorio 2 días antes.
- Si no renovás, la membresía expira y perdés los beneficios.
- Podés reactivar en cualquier momento sin costo extra.`,
    },
    {
      title: '6. PREGUNTAS FRECUENTES',
      body: `¿Cómo me hago miembro?
Registrate en nuestro portal (luxurygarage.arizar-ia.cloud), elegí tu plan y pagá online. ¡Tu membresía se activa al instante!

¿Puedo cambiar de plan?
Sí, en cualquier momento desde tu portal. El cambio aplica desde el próximo ciclo de facturación.

¿Qué pasa si no uso todos mis lavados del mes?
No se acumulan para el mes siguiente. Te recomendamos aprovecharlos todos.

¿Puedo traer más de un auto?
Con el Plan Básico: 1 vehículo. Con el Plan Premium: hasta 2 vehículos. Con el Plan VIP: sin límite.

¿Cómo agendo un turno?
Desde tu portal web o escribiéndonos por WhatsApp. Te lleva menos de 1 minuto.

¿Aceptan tarjeta de crédito/débito?
Sí, aceptamos todas las tarjetas a través de MasFacil. También QR y transferencias.

¿Y si llueve el día de mi turno?
Te notificamos y reprogramamos automáticamente. No se cuenta como lavado usado.

¿Puedo cancelar mi membresía?
Sí, sin permanencia mínima ni penalidad. Podés cancelar cuando quieras desde tu portal.

¿Tienen estacionamiento?
Sí, podés dejar tu auto y retirarlo cuando esté listo. Te avisamos por WhatsApp cuando terminamos.

¿Los productos que usan son seguros para mi auto?
Sí, usamos productos premium importados, biodegradables y seguros para todo tipo de pintura y acabado.

¿Puedo regalar una membresía?
Sí, contactanos por WhatsApp y te generamos un link de pago para regalar.

¿Ofrecen servicio a domicilio?
Por el momento no. Nuestro servicio es presencial en nuestro local de Lambaré.

¿Puedo referir amigos?
¡Sí! Tenés un código de referido en tu portal. Cuando tu referido se registra y activa su membresía, ambos reciben un lavado gratis.

¿Lavan motos, camionetas o utilitarios?
Sí, lavamos todo tipo de vehículo. Los planes de membresía aplican para todos.

¿Cuánto tarda un lavado?
Lavado exterior: 30 min. Lavado completo: 45 min. Premium: 60 min. Detailing: 120 min.

¿Qué pasa si tengo un reclamo?
Respondé a cualquier mensaje de WhatsApp o contactanos directamente. Nuestro equipo te atiende de inmediato.`,
    },
    {
      title: '7. PROGRAMA DE REFERIDOS',
      body: `CÓMO FUNCIONA EL PROGRAMA DE REFERIDOS:
1. Cada miembro tiene un código de referido único en su portal.
2. Compartí tu código o link con amigos y familia.
3. Cuando tu referido se registra usando tu código y activa su membresía:
   - VOS recibís: 1 lavado premium GRATIS
   - TU REFERIDO recibe: 10% de descuento en su primer mes
4. No hay límite de referidos. Cuantos más referís, más lavados gratis ganás.
5. Los créditos de referido se acumulan en tu billetera y los podés usar en cualquier momento.

CÓMO COMPARTIR TU CÓDIGO:
- Ingresá a tu portal → sección "Referidos"
- Copiá tu link o código
- Compartilo por WhatsApp, redes sociales o como quieras`,
    },
    {
      title: '8. PORTAL WEB DEL CLIENTE',
      body: `EL PORTAL WEB es tu centro de control como miembro de Luxury Garage.

URL: https://luxurygarage.arizar-ia.cloud

FUNCIONALIDADES:
- Ver estado de tu membresía (plan, vigencia, lavados usados)
- Agendar y cancelar turnos
- Ver historial de servicios realizados
- Ver tus facturas y pagos
- Gestionar tus vehículos (agregar, editar, eliminar)
- Ver y compartir tu código de referido
- Cambiar o renovar tu plan
- Editar tu perfil y datos personales
- Ver promociones exclusivas

ACCESO:
- Desde cualquier navegador (celular, tablet, computadora)
- Credenciales: el email y contraseña con los que te registraste
- Si olvidaste tu contraseña, usá la opción de recuperación en la página de login`,
    },
    {
      title: '9. POLÍTICA DE CALIDAD Y GARANTÍA',
      body: `GARANTÍA DE SATISFACCIÓN:
Si no estás conforme con el resultado del lavado, contactanos dentro de las 24 horas y lo repetimos sin costo.

CUIDADOS ESPECIALES:
- Revisamos cada vehículo antes de empezar para identificar daños preexistentes.
- Documentamos el estado del vehículo con fotos si es necesario.
- Usamos técnicas de lavado sin contacto para las zonas más delicadas.
- Los productos son testeados y certificados para no dañar pintura, plásticos ni vinil.

SEGURO:
- Tu vehículo está bajo nuestra responsabilidad durante el servicio.
- En caso de cualquier incidente, nos hacemos cargo.

ECOLOGÍA:
- Usamos productos biodegradables.
- Sistema de reciclaje de agua.
- Comprometidos  con el medio ambiente.`,
    },
    {
      title: '10. PROMOCIONES Y BENEFICIOS ACTIVOS',
      body: `PROMOCIONES VIGENTES:
(Las promociones se actualizan periódicamente)

PROMO REFERIDOS: Referí a un amigo → 1 lavado premium gratis para vos.
NUEVO MIEMBRO: Registrate hoy y recibí tu primer lavado premium de cortesía.
PLAN VIP ESPECIAL: El plan VIP incluye 1 detailing mensual gratis (valor ₲350.000).

BENEFICIOS PERMANENTES PARA MIEMBROS:
- Descuentos en servicios extra según tu plan
- Prioridad en agenda
- Portal web exclusivo
- Notificaciones WhatsApp personalizadas
- Código de referido con recompensas
- Área de espera VIP con WiFi y café

PARA EMPRESAS:
Si tenés una flota de vehículos, ofrecemos planes corporativos con condiciones especiales. Contactanos por WhatsApp para recibir una propuesta personalizada.`,
    },
  ];

  // Upload each document as text
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    try {
      // Try FAQ format first
      await client.post(`/knowledge-base/${kbId}/faqs`, {
        question: doc.title,
        answer: doc.body,
      });
      console.log(`  📄 ${i + 1}/${documents.length} — ${doc.title}`);
    } catch (e1) {
      // Try as text content
      try {
        const blob = new Blob([`# ${doc.title}\n\n${doc.body}`], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', blob, `${doc.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`);
        await client.post(`/knowledge-base/${kbId}/content`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        console.log(`  📄 ${i + 1}/${documents.length} — ${doc.title} (como archivo)`);
      } catch (e2) {
        console.error(`  ❌ ${doc.title}:`, e1.response?.data?.message || e1.message);
      }
    }
    await delay(500);
  }

  console.log(`\n✅ Base de conocimiento creada con ${documents.length} documentos`);
  console.log(`   ID: ${kbId}`);
  console.log(`   Nombre: Luxury Garage - Base de Conocimiento`);
  console.log(`\n📋 Siguiente paso: Asignar esta KB al Conversation AI Bot en ARIZAR IA`);
}

main().catch(err => {
  console.error('❌ Error:', err.response?.data || err.message);
  process.exit(1);
});
