# 🔧 WORKFLOW COMPLETO — Integración ARIZAR IA × Luxury Garage

> **Objetivo:** Tener TODO funcionando al 100%  
> **Estado actual:** Backend y frontend deployados. Falta configuración en ARIZAR IA UI.

---

## FASE 1: Base de Conocimiento 📚
> **Dónde:** ARIZAR IA → Settings → Conversation AI → Knowledge Base  
> **Estado:** ⏳ Pendiente (la API no soporta FAQs con este token)

Ir a ARIZAR IA y crear una Knowledge Base llamada **"Luxury Garage"**.  
Luego agregar estos 10 documentos (copiar/pegar cada uno como FAQ o texto):

### Documento 1: Sobre Luxury Garage
```
LUXURY GARAGE es un lavadero de autos premium en Lambaré, Paraguay.
Dirección: Avenida Cacique Lambaré 2030, Lambaré.
Email: avanzatecgroupsa@gmail.com

Misión: Ofrecer el mejor servicio de lavado y cuidado automotor en Paraguay.
Diferenciadores: Membresías con beneficios, portal web, notificaciones WhatsApp, productos premium importados, personal capacitado, área de espera con WiFi y café.
```

### Documento 2: Planes de Membresía
```
PLAN BÁSICO — ₲250.000/mes
- 8 lavados exteriores al mes
- Aspirado básico incluido
- 1 vehículo

PLAN PREMIUM — ₲450.000/mes (MÁS ELEGIDO)
- 12 lavados completos (exterior + interior)
- Aspirado interior completo
- Prioridad en agenda
- 15% descuento en extras
- Hasta 2 vehículos

PLAN VIP — ₲800.000/mes
- Lavados ILIMITADOS
- 1 detailing mensual incluido (valor ₲350.000)
- Máxima prioridad
- 25% descuento en extras
- Vehículos ilimitados

Sin contrato. Sin permanencia. Cancelás cuando quieras.
Lavados no usados no se acumulan.
Pago online por MasFacil (tarjetas, QR, transferencias).
```

### Documento 3: Servicios
```
LAVADO EXTERIOR — 30 min
Agua a presión, shampoo premium, enjuague, secado microfibra, llantas.

LAVADO COMPLETO — 45 min
Exterior + aspirado interior + tablero + vidrios internos.

LAVADO PREMIUM — 60 min
Completo + vidrios interior/exterior + abrillantado + perfumado.

DETAILING COMPLETO — 120 min — ₲350.000
Pulido, encerado carnauba, hidratación plásticos, limpieza profunda interior, acondicionamiento cueros.

LIMPIEZA TAPIZADOS — 90 min — ₲250.000
Lavado vapor, extracción manchas, desinfección.

TRATAMIENTO CERÁMICO — 180 min — ₲500.000
Coating cerámico profesional, protección 6 meses a 1 año.

PULIDO FAROS — 30 min — ₲80.000
Remoción opacidad, pulido, sellado UV.
```

### Documento 4: Horarios y Agenda
```
HORARIOS:
Lunes a Viernes: 7:00 a 18:00
Sábados: 7:00 a 13:00
Domingos y Feriados: CERRADO

CÓMO AGENDAR:
1. Portal web: luxurygarage.arizar-ia.cloud/client/book
2. WhatsApp: respondé a este chat
3. Presencial: Av. Cacique Lambaré 2030

Se recomienda agendar con 1 día de anticipación.
Cancelar hasta 2 horas antes sin penalidad.
Si no cancelás y no venís, cuenta como lavado usado.
Premium y VIP tienen prioridad en agenda.
Recordatorio WhatsApp 24h antes.
Si llueve, reprogramamos sin costo.
Podés dejar tu auto y te avisamos por WhatsApp cuando termina.
```

### Documento 5: Pagos y Facturación
```
MÉTODOS DE PAGO:
- Tarjeta crédito/débito (todas) vía MasFacil
- QR (Tigo Money, Personal Pay)
- Transferencia bancaria
- Efectivo solo para servicios extra

PROCESO:
1. Elegís plan en el portal
2. Se genera link de pago seguro
3. Pagás con tu método preferido
4. Membresía se activa automáticamente
5. Confirmación por WhatsApp + email
6. Factura digital generada

Las facturas se ven en el portal, sección "Mi Membresía".
Te avisamos 7 días antes del vencimiento.
Nuevo recordatorio 2 días antes.
Renovás desde el portal en cualquier momento.
```

### Documento 6: Preguntas Frecuentes
```
¿Cómo me hago miembro? → Portal web, elegí plan, pagá online. Se activa al instante.
¿Puedo cambiar de plan? → Sí, en cualquier momento. Aplica desde el próximo ciclo.
¿Se acumulan los lavados? → No, los no usados no pasan al mes siguiente.
¿Puedo traer más de un auto? → Básico: 1. Premium: 2. VIP: ilimitado.
¿Cómo agendo turno? → Portal web o WhatsApp.
¿Aceptan tarjetas? → Sí, todas vía MasFacil. También QR y transferencias.
¿Y si llueve? → Reprogramamos sin costo. No cuenta como lavado.
¿Puedo cancelar membresía? → Sí, sin permanencia ni penalidad.
¿Tienen estacionamiento? → Sí. Te avisamos por WhatsApp cuando termina.
¿Productos seguros? → Sí, premium importados, biodegradables.
¿Regalar membresía? → Sí, contactanos por WhatsApp.
¿Servicio a domicilio? → No, solo presencial en Lambaré.
¿Referir amigos? → Sí, tenés código en tu portal. Ambos ganan un lavado gratis.
¿Lavan motos? → Sí, todo tipo de vehículo.
¿Cuánto tarda? → Exterior 30min, Completo 45min, Premium 60min, Detailing 120min.
¿Reclamo? → Respondé a este WhatsApp, te atendemos de inmediato.
```

### Documento 7: Programa de Referidos
```
1. Cada miembro tiene código de referido en su portal.
2. Compartilo por WhatsApp o redes.
3. Cuando tu referido se registra y activa membresía:
   - VOS: 1 lavado premium GRATIS
   - TU REFERIDO: 10% descuento primer mes
4. Sin límite de referidos.
5. Créditos se acumulan en tu billetera.
```

### Documento 8: Portal Web del Cliente
```
URL: luxurygarage.arizar-ia.cloud
Funciones: ver membresía, agendar turnos, historial de servicios, facturas, gestionar vehículos, código de referido, cambiar plan, editar perfil, ver promos.
Acceso desde celular, tablet o computadora con email y contraseña.
```

### Documento 9: Garantía de Calidad
```
Si no estás conforme con el resultado, contactanos en 24h y lo repetimos sin costo.
Revisamos cada vehículo antes de empezar.
Productos certificados para no dañar pintura.
Tu vehículo está bajo nuestra responsabilidad durante el servicio.
Productos biodegradables. Sistema de reciclaje de agua.
```

### Documento 10: Promociones
```
PROMO REFERIDOS: Referí un amigo → 1 lavado premium gratis para vos.
NUEVO MIEMBRO: Primer lavado premium de cortesía al registrarte.
PLAN VIP: Incluye 1 detailing mensual gratis (valor ₲350.000).
EMPRESAS: Planes corporativos para flotas. Contactar por WhatsApp.
```

---

## FASE 2: Plantillas WhatsApp 📱
> **Dónde:** ARIZAR IA → Settings → WhatsApp → Message Templates  
> **Estado:** ⏳ Pendiente

Crear las 11 plantillas detalladas en el documento `prompts_workflows_ghl.md`:

| # | Nombre | Categoría | Variables |
|---|--------|-----------|-----------|
| 1 | `bienvenida_miembro` | UTILITY | {{1}}=nombre, {{2}}=plan, {{3}}=vehículo |
| 2 | `recordatorio_primer_lavado` | UTILITY | {{1}}=nombre, {{2}}=plan |
| 3 | `recordatorio_usar_membresia` | UTILITY | {{1}}=plan, {{2}}=nombre, {{3}}=lavados |
| 4 | `solicitud_resena` | UTILITY | {{1}}=nombre, {{2}}=vehículo, {{3}}=link reviews |
| 5 | `agradecimiento_resena` | UTILITY | {{1}}=nombre, {{2}}=vehículo |
| 6 | `resena_negativa_disculpa` | UTILITY | {{1}}=nombre |
| 7 | `recuperacion_inactivo` | UTILITY | {{1}}=nombre, {{2}}=plan, {{3}}=vehículo |
| 8 | `recuperacion_oferta` | MARKETING | {{1}}=nombre, {{2}}=vehículo |
| 9 | `renovacion_7dias` | UTILITY | {{1}}=nombre, {{2}}=plan, {{3}}=fecha vencimiento |
| 10 | `renovacion_2dias` | UTILITY | {{1}}=plan, {{2}}=nombre, {{3}}=vehículo |
| 11 | `membresia_expirada` | UTILITY | {{1}}=plan, {{2}}=nombre, {{3}}=vehículo |

> Texto exacto de cada plantilla → ver `prompts_workflows_ghl.md`

---

## FASE 3: Workflows ⚙️
> **Dónde:** ARIZAR IA → Automation → Workflows → Create → Use AI  
> **Estado:** ⏳ Pendiente  
> **Requiere:** Fase 2 completada (plantillas aprobadas por Meta)

| # | Workflow | Trigger (Tag) | Prompt |
|---|---------|---------------|--------|
| 1 | Bienvenida Luxury Garage | `miembro-activo` | → ver `prompts_workflows_ghl.md` |
| 2 | Post-Servicio Reseña | `primer-lavado-completado` | → ver `prompts_workflows_ghl.md` |
| 3 | Recuperación Inactivos | `cliente-inactivo-15d` | → ver `prompts_workflows_ghl.md` |
| 4 | Renovación Membresía | `renovacion-pendiente` | → ver `prompts_workflows_ghl.md` |

**Después de crear cada workflow:** copiar el Workflow ID de la URL y enviármelo.

---

## FASE 4: Webhooks 🔗
> **Dónde:** ARIZAR IA → Settings → Integrations → Webhooks  
> **Estado:** ⏳ Pendiente

Registrar webhook manualmente:
- **URL:** `https://luxurygarage.arizar-ia.cloud/api/webhooks/arizar`
- **Eventos:** ContactCreate, ContactUpdate, ContactTagUpdate, AppointmentCreate, AppointmentUpdate, PaymentReceived, InboundMessage, OpportunityStageUpdate, InvoiceCreate, FormSubmission

---

## FASE 5: MasFacil (Pagos) 💳
> **Estado:** ⏳ Pendiente (necesito API Key)

1. Crear cuenta en MasFacil (si no existe)
2. Obtener API Key + Secret
3. Enviarme los datos para configurar en el backend
4. Testear un pago de prueba

---

## FASE 6: Google Reviews ⭐
> **Estado:** ⏳ Pendiente

1. Buscar "Luxury Garage Lambaré" en Google Maps
2. Copiar el link de "Escribir una reseña"
3. Enviarme el link para configurar en plantillas y workflows

---

## FASE 7: Bot de Conversación IA 🤖
> **Dónde:** ARIZAR IA → Conversation AI → Create Bot  
> **Estado:** ⏳ Pendiente (requiere Knowledge Base de Fase 1)

Crear bot con esta configuración:
- **Nombre:** Luxury Garage
- **Knowledge Base:** La creada en Fase 1
- **Canales:** WhatsApp
- **Prompt del sistema:**
```
Sos el asistente virtual de Luxury Garage, un lavadero de autos premium en Lambaré, Paraguay.

Tu personalidad:
- Amable, profesional, breve
- Español paraguayo (tuteo con "vos")
- Usás emojis moderadamente
- Siempre ofrecés ayuda adicional

Flujos:
1. Saludo → saludá y preguntá en qué podés ayudar
2. Consulta general → respondé con info de tu Knowledge Base
3. Interés en membresía → explicá planes → preguntá cuál le interesa → enviá link del portal
4. Quiere agendar → enviá link: https://luxurygarage.arizar-ia.cloud/client/book
5. Reclamo/enojo → escalá a humano diciendo "Te comunico con un asesor"
6. Precio individual (no miembro) → dar precio del servicio y sugerir membresía

Reglas:
- Nunca inventés precios o servicios que no estén en tu Knowledge Base
- Siempre cerrá con "¿Puedo ayudarte en algo más?"
- Si no sabés algo, decí "Dejame consultar y te respondo a la brevedad"
- No des info técnica del sistema, solo del lavadero
```

---

## FASE 8: Verificación Final ✅
> Después de completar todas las fases

| Test | Cómo verificar |
|------|---------------|
| Bot responde consultas | Enviar WhatsApp al número del negocio |
| Registro crea contacto en CRM | Registrar usuario en portal → verificar en ARIZAR Contacts |
| Pago activa membresía | Hacer pago de prueba con MasFacil |
| Pipeline se mueve | Verificar que el contacto pasa de stage automáticamente |
| Turno agenda en calendario | Agendar turno → verificar en ARIZAR Calendar |
| Workflow se dispara | Verificar que el tag "miembro-activo" activa el workflow de bienvenida |
| Factura se genera | Verificar que al pagar se crea factura en ARIZAR |
| Reseña se solicita | Completar un servicio → esperar 2h → verificar WhatsApp |
| Inactividad se detecta | Esperar 15 días sin actividad → verificar tag y workflow |
| Renovación se notifica | Esperar 7 días antes de vencimiento → verificar WhatsApp |

---

## 📊 Resumen de Estado

| Fase | Componente | Estado |
|------|-----------|--------|
| ✅ | Backend (servicios, rutas, sync, cron jobs) | COMPLETADO |
| ✅ | Frontend (panel CRM, registro público) | COMPLETADO |
| ✅ | Custom Fields (13 campos) | COMPLETADO |
| ✅ | Tags (24 tags) | COMPLETADO |
| ✅ | Productos (3 planes) | COMPLETADO |
| ✅ | Pipeline "Luxury Garage" (6 stages) | COMPLETADO |
| ✅ | Calendario "Detailing Services" | COMPLETADO |
| ✅ | Conexión API ARIZAR IA | COMPLETADO |
| ⏳ | Fase 1: Knowledge Base | Por hacer en UI |
| ⏳ | Fase 2: Plantillas WhatsApp | Por hacer en UI |
| ⏳ | Fase 3: Workflows (4) | Por hacer en UI |
| ⏳ | Fase 4: Webhooks | Por hacer en UI |
| ⏳ | Fase 5: MasFacil | Necesita API Key |
| ⏳ | Fase 6: Google Reviews | Necesita link |
| ⏳ | Fase 7: Bot IA | Por hacer en UI |
| ⏳ | Fase 8: Verificación | Después de todo |
