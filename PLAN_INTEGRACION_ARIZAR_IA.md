# 🔌 PLAN DE INTEGRACIÓN: LUXURY GARAGE × ARIZAR IA

> **Documento técnico para agentes IA de implementación**  
> **Fecha:** 22 de marzo de 2026  
> **Proyecto:** Luxury Garage — Lavadero Premium con Membresías  
> **CRM:** ARIZAR IA (GoHighLevel v2)  
> **Procesador de pagos:** MasFacil (Paraguay)  
> **Ubicación del proyecto:** `/home/luxury-garage/`  
> **API Reference:** `/home/Agente/arizar-ia-api/README.md`  
> **Dominio:** `https://luxurygarage.arizar-ia.cloud`

---

## 1. MODELO DE NEGOCIO — Contexto para los agentes

### 1.1 ¿Qué es Luxury Garage?
Un lavadero de autos premium en Paraguay que funciona con **membresías mensuales**. Los clientes pagan un plan y acceden a lavados según su nivel. No es un lavadero de paso — es un servicio recurrente, premium, basado en relación a largo plazo.

### 1.2 ¿Cómo llegan los clientes?
**Los clientes NO llegan por el portal web.** El portal es una herramienta de gestión.

Los clientes llegan por:
1. **WhatsApp** → Un amigo les recomienda, escriben al número del lavadero
2. **Publicidad en redes** → Ven un anuncio, clickean → llegan al WhatsApp o a un funnel
3. **Referidos** → Un cliente activo comparte un link a su conocido
4. **Presencial** → Llegan al lavadero físicamente, el empleado los registra

En TODOS estos casos, **ARIZAR IA es el primer punto de contacto digital**.

### 1.3 ¿Cómo se convierte un lead en cliente?
```
1. Persona contacta por WhatsApp
2. Bot IA de ARIZAR responde automáticamente (Conversation AI)
3. Bot explica planes, responde preguntas (alimentado por Knowledge Base)
4. Si quiere pagar → Bot envía link de pago (MasFacil)
5. Persona paga → MasFacil confirma → Webhook a Luxury Garage
6. Luxury Garage:
   a) Crea usuario en DB local
   b) Crea factura en ARIZAR IA
   c) Actualiza contacto con tags (miembro-activo, plan-xxx)
   d) Envía credenciales del portal por WhatsApp (ARIZAR)
7. Cliente accede al portal → agenda su primer turno
8. Turno se sincroniza con calendario de ARIZAR IA
```

### 1.4 ¿Cómo es el ciclo operativo diario?
```
Mañana:
  - Empleados abren el portal, ven los turnos del día
  - Clientes llegan según horario agendado
  
Atención:
  - Empleado marca "Iniciar servicio" en el portal
  - Cliente recibe WhatsApp: "Tu auto está siendo atendido"
  - Empleado termina, marca "Completar servicio"
  - Se registran observaciones del vehículo
  
Post-servicio:
  - Cliente recibe WhatsApp: "Tu auto está listo 🚗"
  - 2 horas después: "¿Cómo estuvo? Dejanos tu reseña ⭐"
  - Si califica bien → pedirle reseña en Google
  - Si califica mal → alerta al admin para contactar
```

### 1.5 ¿De dónde se cobra?
- **MasFacil** (procesador paraguayo) procesa la tarjeta/QR
- **ARIZAR IA** genera la factura y la envía al cliente
- El portal muestra las facturas (las trae de ARIZAR via API)

---

## 2. ARQUITECTURA DE DATOS — Qué vive dónde

### 2.1 Datos que VIVEN en ARIZAR IA (fuente de verdad)
| Dato | Módulo ARIZAR | Justificación |
|------|--------------|---------------|
| Contacto del cliente | Contacts | ARIZAR es el CRM central |
| Historial de conversaciones | Conversations | WhatsApp, SMS, Email |
| Facturas | Invoices | ARIZAR las emite y envía |
| Oportunidades de venta | Opportunities | Pipeline de conversión |
| Calendario de turnos | Calendars | Fuente de verdad de disponibilidad |
| Reseñas | Social Planner / Reviews | Gestión de reputación |
| Workflows/Automatizaciones | Workflows | Lógica de automatización |
| Bot IA | Conversation AI | Respuestas automáticas |
| Base de conocimiento | Knowledge Base | Info para alimentar el bot |

### 2.2 Datos que VIVEN en Luxury Garage DB (operación local)
| Dato | Tabla Prisma | Justificación |
|------|-------------|---------------|
| Usuario (login, password) | User | Autenticación del portal |
| Vehículos del cliente | Vehicle | Detalle operativo que ARIZAR no maneja nativamente |
| Registro de servicio | ServiceRecord | Qué hizo el empleado, observaciones del auto, duración |
| Membresía activa | Membership | Estado operativo para validar turnos |
| Historial de servicios | ServiceRecord | Detalle técnico del lavado |
| Inventario de insumos | Inventory | Stock de shampoo, cera, etc. |
| Billetera digital | WalletTransaction | Créditos prepagos |
| Configuración del negocio | BusinessSettings | Horarios, capacidad, etc. |

### 2.3 Datos SINCRONIZADOS (existen en ambos)
| Dato | ARIZAR | Luxury Garage | Sync |
|------|--------|--------------|------|
| Nombre, email, teléfono | Contact fields | User table | Bidireccional |
| Turno/cita | Calendar Event | Appointment table | Bidireccional |
| Estado de membresía | Contact Tags + Custom Fields | Membership table | LG → ARIZAR |
| Info del vehículo | Contact Custom Fields | Vehicle table | LG → ARIZAR |
| Último servicio | Contact Notes | ServiceRecord | LG → ARIZAR |

**Regla de sincronización:** La DB local es para operación rápida. ARIZAR es para CRM, marketing y comunicación. Cuando hay conflicto, **ARIZAR gana** en datos de contacto, **Luxury Garage gana** en datos operativos.

---

## 3. CUSTOM FIELDS EN ARIZAR IA

Estos campos personalizados DEBEN existir en ARIZAR para almacenar datos del lavadero:

```
Crear via API: POST /locations/{locationId}/customFields

Campos a crear:
  - luxury_plan          (texto)     → "basico" | "premium" | "vip"
  - luxury_plan_status   (texto)     → "active" | "expired" | "cancelled"
  - luxury_plan_expiry   (fecha)     → Fecha de vencimiento
  - luxury_vehicle_1     (texto)     → "Toyota Hilux 2024 - ABC-1234"
  - luxury_vehicle_2     (texto)     → Segundo vehículo si tiene
  - luxury_services_used (número)    → Cantidad de lavados realizados
  - luxury_last_visit    (fecha)     → Último servicio
  - luxury_wallet_balance(número)    → Saldo de billetera
  - luxury_referral_code (texto)     → Código de referido
  - luxury_user_id       (texto)     → ID del usuario en Luxury Garage DB
```

**Endpoint:** `POST /locations/{locationId}/customFields`
```json
{
  "name": "luxury_plan",
  "dataType": "TEXT",
  "placeholder": "Plan del cliente"
}
```

---

## 4. TAGS — Taxonomía completa

Los tags en ARIZAR organizan y segmentan a los contactos. Cada contacto puede tener múltiples tags.

### 4.1 Tags de origen
| Tag | Se aplica cuando |
|-----|-----------------|
| `luxury-garage` | Cualquier contacto vinculado al lavadero |
| `lead` | Primer contacto, aún no es cliente |
| `lead-whatsapp` | Llegó por WhatsApp |
| `lead-referido` | Llegó por referido |
| `lead-funnel` | Llegó por funnel/landing |
| `lead-presencial` | Registrado por empleado en el local |

### 4.2 Tags de estado de membresía
| Tag | Se aplica cuando |
|-----|-----------------|
| `miembro-activo` | Tiene membresía activa |
| `miembro-inactivo` | Membresía expirada o cancelada |
| `plan-basico` | Plan Basic activo |
| `plan-premium` | Plan Premium activo |
| `plan-vip` | Plan VIP activo |

### 4.3 Tags de comportamiento
| Tag | Se aplica cuando |
|-----|-----------------|
| `primer-lavado-completado` | Completó su primer servicio |
| `cliente-frecuente` | Más de 8 lavados en el mes |
| `cliente-inactivo-15d` | No visitó en 15 días |
| `cliente-inactivo-30d` | No visitó en 30 días |
| `resena-positiva` | Dejó reseña de 4 o 5 estrellas |
| `resena-negativa` | Dejó reseña de 1, 2 o 3 estrellas |
| `referidor-activo` | Tiene al menos 1 referido completado |

### 4.4 Tags de ciclo de vida
| Tag | Se aplica cuando |
|-----|-----------------|
| `renovacion-pendiente` | Membresía vence en 7 días o menos |
| `oferta-enviada` | Se le envió oferta de re-enganche |
| `recuperado` | Volvió después de estar inactivo |
| `churned` | Inactivo más de 60 días |

---

## 5. PIPELINE DE VENTAS — Stages

### Pipeline: "Luxury Garage" (ID: Olfl0Vretj17lDmbu5lj) ✅ CREADO

```
Stage 0: 📩 Consulta Recibida  (ff45edf1-dc39-448d-aa96-187a74882e8e)
  → Contacto recién creado — hay que responder rápido
  → Auto: se crea al registrar contacto

Stage 1: 💬 En Seguimiento     (3fb7716e-fd32-4098-bfb1-833734c2f11d)
  → Ya se está atendiendo al cliente potencial
  → Manual o workflow

Stage 2: 📋 Propuesta Enviada  (51ba4ba7-cb85-450b-8271-fa80240c3a6d)
  → Recibió planes y link de pago — esperar respuesta
  → Manual o workflow

Stage 3: 📅 Visita Agendada    (a9c8ec9f-2130-40a0-8c4f-b01b3e05ce8a)
  → Tiene cita en el lavadero — preparar recibimiento
  → Auto: cuando agenda turno en el portal

Stage 4: ✅ Miembro Activo     (54c3ce50-c9cb-43a9-b6b1-45ec867da3ae)
  → Pagó — onboarding y primer lavado
  → Auto: cuando se confirma pago

Stage 5: ❌ No Convirtió       (4eb2cbf5-e2f1-4c8d-b080-efd0dd57018f)
  → No concretó — evaluar recuperación
  → Auto: cuando membresía expira sin renovar
```

---

## 6. MÓDULOS — Plan de implementación detallado

---

### 6.1 CONVERSATION AI (Bot WhatsApp)

**Objetivo:** El bot atiende consultas 24/7, explica planes, agenda turnos, y envía links de pago.

**Setup en ARIZAR:**
1. Crear bot via `POST /conversation-ai/bot`
2. Alimentar con Knowledge Base (sección 6.2)
3. Configurar triggers: responder a cualquier mensaje entrante de contacto sin membresía

**Prompts del bot (instrucciones para cargar):**
```
Sos el asistente virtual de Luxury Garage, un lavadero de autos premium en Paraguay.

Tu personalidad:
- Amable, profesional, breve
- Usás español paraguayo (tuteo con "vos")
- Siempre ofrecés ayuda adicional

Información que conocés:
- Planes de membresía (cargados en Knowledge Base)
- Horarios de atención
- Servicios disponibles
- Promociones vigentes

Flujos que manejás:
1. Consultas generales → responder con info
2. Interés en membresía → explicar planes → enviar link de pago
3. Quiere agendar turno → preguntar fecha/hora → confirmar
4. Reclamo → escalar a humano

Reglas:
- Si el cliente está enojado, escalar inmediatamente a un agente humano
- Nunca inventar precios o servicios que no están en tu Knowledge Base
- Siempre cerrar con "¿Puedo ayudarte en algo más?"
```

**Implementación en Luxury Garage:**
- No requiere código en el backend — el bot vive 100% en ARIZAR
- El portal puede encender/apagar el bot via API: `PUT /conversation-ai/bot/{botId}`
- Los mensajes del bot generan webhooks `InboundMessage` / `OutboundMessage`

**Archivos a modificar:**
- `routes/arizar-admin.js` → Endpoint para ver estado del bot y encenderlo/apagarlo
- `ArizarPanel.jsx` → Sección en el panel para controlar el bot

---

### 6.2 KNOWLEDGE BASE (Base de Conocimiento del Bot)

**Objetivo:** Alimentar al bot IA con toda la información de Luxury Garage para que responda correctamente.

**Contenido a cargar:**

```
Documento 1: "Planes y Precios"
  - Plan Básico: ₲250.000/mes — 8 lavados exteriores
  - Plan Premium: ₲450.000/mes — 12 lavados completos + aspirado
  - Plan VIP: ₲800.000/mes — Lavados ilimitados + detailing + prioridad
  (Ajustar con precios reales del negocio)

Documento 2: "Servicios"
  - Lavado exterior: 30 min
  - Lavado completo: 45 min  
  - Lavado premium + aspirado: 60 min
  - Detailing completo: 120 min
  - Limpieza de tapizados: 90 min

Documento 3: "Horarios y Ubicación"
  - Lunes a viernes: 7:00 - 18:00
  - Sábados: 7:00 - 13:00
  - Domingos: Cerrado
  - Dirección: (completar)

Documento 4: "Preguntas Frecuentes"
  - ¿Puedo cambiar de plan? Sí, en cualquier momento.
  - ¿Qué pasa si no uso todos mis lavados? No se acumulan.
  - ¿Puedo traer más de un auto? Sí, con Plan Premium o VIP.
  - ¿Cómo agendo un turno? Desde el portal o por WhatsApp.
  - ¿Aceptan tarjeta? Sí, vía MasFacil.

Documento 5: "Políticas"
  - Cancelación de turno: hasta 2 horas antes sin penalidad
  - Cancelación de membresía: sin permanencia mínima
  - Lluvia: se reprograma automáticamente
```

**Endpoints:**
```
POST /knowledge-base/                    → Crear KB
POST /knowledge-base/{kbId}/documents    → Subir cada documento
POST /knowledge-base/{kbId}/faqs         → Cargar FAQs
```

**Archivos a crear:**
- `scripts/seed-knowledge-base.js` → Script que carga toda la info en ARIZAR
- Los contenidos se toman de la DB local (plans, services) + archivo de config

---

### 6.3 REVIEWS (Reseñas y Reputación)

**Objetivo:** Pedir reseñas automáticamente post-servicio, gestionar reputación.

**Flujo:**
```
Servicio completado en Luxury Garage
        ↓ (webhook/trigger)
ARIZAR workflow se activa:
  → Esperar 2 horas
  → Enviar WhatsApp:
    "Hola {nombre}, ¿cómo estuvo tu lavado de hoy?
     Calificanos del 1 al 5 ⭐"
        ↓
  Si responde 4 o 5:
    → "¡Gracias! Nos ayudaría mucho si dejás tu reseña en Google 🙏"
    → Enviar link a Google Reviews
    → Tag: "resena-positiva"
    
  Si responde 1, 2 o 3:
    → "Lamentamos escuchar eso. Un encargado se va a comunicar con vos."
    → Tag: "resena-negativa"
    → Crear tarea: "Contactar a {nombre} por experiencia negativa"
    → Notificar admin
```

**Implementación:**
- El **workflow se crea dentro de ARIZAR IA** (no por API, se configura en la UI)
- Luxury Garage solo necesita **disparar el trigger** cuando completa un servicio
- Se dispara agregando al contacto a un workflow: `POST /contacts/{id}/workflow/{workflowId}`

**Variables de entorno necesarias:**
```
ARIZAR_WORKFLOW_POST_SERVICE={workflowId}
ARIZAR_GOOGLE_REVIEW_LINK=https://g.page/r/xxx/review
```

**Leer reseñas desde el portal:**
```
GET /social-media-posting/reviews/{locationId}
```

**Archivos a modificar:**
- `services/arizarService.js` → Método `triggerPostServiceReview(contactId)`
- `routes/appointments.js` → En el endpoint de completar, llamar al método
- `routes/arizar-admin.js` → Endpoint GET para listar reseñas
- `ArizarPanel.jsx` → Tab de reseñas con listado y respuesta

---

### 6.4 INVOICES (Facturas via ARIZAR)

**Objetivo:** ARIZAR emite todas las facturas. El cliente las ve en su portal.

**Flujo de creación:**
```
MasFacil confirma pago (webhook)
        ↓
Luxury Garage backend:
  1. POST /invoices/ → Crear factura en ARIZAR
     {
       "locationId": "{locationId}",
       "contactId": "{contactId}",
       "name": "Membresía Premium - Marzo 2026",
       "items": [{ "name": "Plan Premium", "amount": 450000, "quantity": 1 }],
       "currency": "PYG",
       "status": "paid"
     }
  2. POST /invoices/{invoiceId}/send → Enviar por email
  3. POST /invoices/{invoiceId}/record-payment → Registrar pago
     { "amount": 450000, "mode": "custom", "notes": "MasFacil - Ref: xxx" }
```

**Flujo de consulta (portal del cliente):**
```
Cliente entra a "Mis Facturas" en el portal
        ↓
Frontend pide: GET /api/invoices/mine
        ↓
Backend consulta: GET /invoices/?altId={contactId}&altType=contact
        ↓
Retorna facturas de ARIZAR al frontend
```

**Archivos a crear/modificar:**
- `services/arizarService.js` → Métodos: `createInvoice()`, `sendInvoice()`, `recordPayment()`, `getContactInvoices()`
- `routes/invoices-arizar.js` → Nueva ruta que sirve facturas de ARIZAR al frontend
- Frontend: `MyInvoices.jsx` → Conectar con la nueva ruta (actualmente usa datos locales)

---

### 6.5 PAYMENTS — Integración MasFacil

**Objetivo:** Cobrar membresías y servicios extras con MasFacil.

**Flujo:**
```
1. Cliente quiere pagar (desde portal o desde bot WhatsApp)
2. Luxury Garage genera link de pago MasFacil via API
3. Cliente paga (tarjeta, QR, transferencia)
4. MasFacil envía webhook a Luxury Garage
5. Luxury Garage:
   a) Activa membresía en DB local
   b) Crea factura en ARIZAR (ver 6.4)
   c) Actualiza tags del contacto
   d) Envía confirmación por WhatsApp
```

**IMPORTANTE:** Investigar API de MasFacil:
- URL de la API
- Cómo generar links de pago
- Formato del webhook de confirmación
- Autenticación

**Archivos a crear:**
- `services/masfacilService.js` → Integración con MasFacil API
- `routes/masfacil-webhooks.js` → Recibir webhooks de pago
- Modificar `routes/memberships.js` → Endpoint para iniciar pago

**Variables necesarias:**
```
MASFACIL_API_KEY=xxx
MASFACIL_SECRET=xxx
MASFACIL_WEBHOOK_SECRET=xxx
MASFACIL_BASE_URL=https://api.masfacil.com.py
```

---

### 6.6 PRODUCTS (Planes como productos en ARIZAR)

**Objetivo:** Los planes de membresía existen como productos en ARIZAR para poder venderlos desde funnels y bots.

**Setup (una sola vez):**
```
POST /products/
{
  "locationId": "{locationId}",
  "name": "Plan Básico - Luxury Garage",
  "description": "8 lavados exteriores al mes",
  "productType": "SERVICE"
}

POST /products/{productId}/price
{
  "name": "Mensual",
  "amount": 250000,
  "currency": "PYG",
  "type": "recurring",
  "recurring": { "interval": "month", "intervalCount": 1 }
}
```

**Archivos a crear:**
- `scripts/seed-products.js` → Script que crea los productos en ARIZAR (se corre 1 vez)

---

### 6.7 WORKFLOWS (Automatizaciones)

**Objetivo:** Definir las secuencias automáticas que maneja ARIZAR.

**NOTA IMPORTANTE:** Los workflows se **crean en la UI de ARIZAR**, no por API. La API solo permite listarlos y agregar/quitar contactos. Los agentes deben documentar qué workflows crear.

**Workflows a crear en ARIZAR UI:**

#### Workflow 1: "Bienvenida Nuevo Miembro"
```
Trigger: Tag "miembro-activo" se agrega
  → Esperar 1 minuto
  → WhatsApp: "¡Bienvenido a Luxury Garage! 🚗 Ya podés agendar tu primer turno..."
  → Esperar 1 día
  → WhatsApp: "¿Ya agendaste tu primer lavado? Hacelo desde el portal..."
  → Si no agendó en 3 días:
    → WhatsApp: "Te estamos esperando. Tu primer lavado es especial 🌟"
    → Crear tarea: "Llamar a {nombre} - no agendó primer turno"
```

#### Workflow 2: "Post-Servicio + Reseña"
```
Trigger: Contacto agregado a este workflow (desde código)
  → Esperar 2 horas
  → WhatsApp: "¿Cómo estuvo tu lavado? Calificá del 1 al 5"
  → Esperar respuesta (máx 24h)
  → Si respuesta >= 4: Enviar link Google Reviews
  → Si respuesta <= 3: Crear tarea para admin
```

#### Workflow 3: "Recuperación de Inactivos"
```
Trigger: Tag "cliente-inactivo-15d" se agrega
  → WhatsApp: "Hola {nombre}, te extrañamos en Luxury Garage. ¿Agendamos un turno?"
  → Esperar 3 días
  → Si no respondió:
    → WhatsApp: "Tenemos 15% OFF en tu próximo lavado 🎁"
    → Tag: "oferta-enviada"
  → Esperar 7 días
  → Si sigue inactivo:
    → Crear tarea: "Llamar a {nombre} - posible churn"
```

#### Workflow 4: "Renovación de Membresía"
```
Trigger: Tag "renovacion-pendiente" se agrega
  → WhatsApp: "Tu membresía vence en 7 días. Renová para seguir disfrutando..."
  → Esperar 4 días
  → WhatsApp: "⚠️ Tu membresía vence en 3 días..."
  → Esperar 2 días
  → WhatsApp: "ÚLTIMO DÍA. Renová ahora con 10% OFF..."
  → Esperar 1 día
  → Si no renovó: Tag "miembro-inactivo"
```

**Variables de entorno necesarias:**
```
ARIZAR_WORKFLOW_BIENVENIDA={workflowId}
ARIZAR_WORKFLOW_POST_SERVICIO={workflowId}
ARIZAR_WORKFLOW_RECUPERACION={workflowId}
ARIZAR_WORKFLOW_RENOVACION={workflowId}
```

**Implementación en código:**
- Cuando el backend detecta un evento (servicio completado, membresía por vencer, inactividad), agrega al contacto al workflow correspondiente
- `POST /contacts/{contactId}/workflow/{workflowId}`

---

### 6.8 SOCIAL PLANNER (Redes Sociales)

**Objetivo:** Publicar contenido automáticamente en Instagram/Facebook.

**Uso:**
- Publicar fotos de autos lavados (con permiso del cliente)
- Publicar promos y ofertas
- Publicar tips de cuidado automotor

**Endpoints:**
```
GET  /social-media-posting/oauth/{locationId}/accounts → Ver cuentas conectadas
POST /social-media-posting/ → Crear post
{
  "locationId": "{locationId}",
  "type": "post",
  "accountIds": ["instagram_id", "facebook_id"],
  "mediaUrls": ["https://..."],
  "content": "Otro auto impecable sale de Luxury Garage 🚗✨ #LuxuryGarage",
  "scheduleDate": "2026-03-25T10:00:00Z"
}
```

**Archivos:**
- `routes/arizar-admin.js` → Endpoints para crear y programar posts
- `ArizarPanel.jsx` → Tab de redes sociales

---

### 6.9 FUNNELS (Landing Pages de Venta)

**Objetivo:** Páginas de aterrizaje para vender membresías.

**Nota:** Los funnels se **crean en ARIZAR UI** (drag & drop). Desde el código solo podemos:
- Listar funnels: `GET /funnels/funnel/list`
- Gestionar redirects: `POST /funnels/lookup/redirect`

**El funnel debería:**
1. Mostrar beneficios de las membresías
2. Testimonios de clientes
3. Botón "¡Quiero mi membresía!" → Link de pago MasFacil
4. Al pagar → ARIZAR crea contacto + Luxury Garage crea usuario (via webhook)

---

### 6.10 VOICE AI (Agente de Voz)

**Objetivo:** Atender llamadas telefónicas automáticamente.

**Setup:**
```
POST /voice-ai/agent
{
  "name": "Asistente Luxury Garage",
  "instructions": "Atendés llamadas de Luxury Garage, un lavadero premium...",
  "language": "es",
  "voice": "female_latin_american"
}
```

**Uso:** Cuando alguien llama al número del lavadero y nadie atiende, el agente de voz:
1. Saluda
2. Pregunta qué necesita
3. Si quiere turno → pide datos → lo agenda
4. Si tiene consulta → responde con info del Knowledge Base
5. Si quiere hablar con alguien → transfiere

---

## 7. COSAS NO CONSIDERADAS ANTERIORMENTE

### 7.1 Conflictos de sincronización
- **Problema:** Si un admin cambia el teléfono en ARIZAR y otro lo cambia en el portal.
- **Solución:** Timestamp de última modificación. El más reciente gana. Los webhooks incluyen timestamp.

### 7.2 Rate limiting
- ARIZAR permite máximo 100 requests / 10 segundos.
- **Solución:** Cola de mensajes con delay de 200ms entre llamadas en bulk sync y broadcasts.

### 7.3 Caída de ARIZAR
- **Problema:** Si ARIZAR está caído, ¿el portal deja de funcionar?
- **Solución:** NO. El portal funciona con su DB local. Las notificaciones y sync se encolan y reintentan cuando ARIZAR vuelve.
- Implementar: `services/arizarQueue.js` — cola con reintentos

### 7.4 Múltiples vehículos
- ARIZAR no tiene un campo nativo para vehículos.
- **Solución:** Custom fields `luxury_vehicle_1`, `luxury_vehicle_2` + notas del contacto.

### 7.5 Timezone
- Paraguay usa `America/Asuncion` (UTC-3 / UTC-4 según horario de verano).
- TODAS las fechas enviadas a ARIZAR deben usar esta timezone.

### 7.6 Idioma
- Todo mensaje, nota, tag y comunicación debe estar en español paraguayo.
- El bot debe usar "vos" (no "usted" ni "tú").

### 7.7 Capacidad del lavadero
- ¿Cuántos autos se pueden lavar simultáneamente?
- Esto afecta los slots del calendario. Si hay 3 bahías → máximo 3 turnos por slot.
- Configurar en ARIZAR Calendar como "resource-based scheduling".

### 7.8 Días de lluvia
- ¿Se cancelan turnos automáticamente?
- Se puede integrar con API de clima + workflow: si llueve → reprogramar y notificar.

### 7.9 Empleados en ARIZAR
- ¿Los empleados también deben ser users de ARIZAR? Esto permitiría asignarles turnos y tareas.
- Recomendación: Sí, como Users de ARIZAR con permisos limitados.

### 7.10 Métricas y reportes
- ARIZAR tiene dashboards propios, pero datos operativos (duración de lavado, insumos usados) viven solo en Luxury Garage.
- El admin dashboard debe combinar datos de ambos.

---

## 8. VARIABLES DE ENTORNO COMPLETAS

```env
# ═══ ARIZAR IA (GoHighLevel) ═══
ARIZAR_API_TOKEN=pit-a6607a37-a363-4065-a66d-0a820b2f6688
ARIZAR_BASE_URL=https://services.leadconnectorhq.com
ARIZAR_API_VERSION=2021-07-28
ARIZAR_LOCATION_ID=7vxGjfpLYraWDT9MrXWU
ARIZAR_CALENDAR_ID=0H4eHSKKDigbTAIuECww
ARIZAR_PIPELINE_ID=Olfl0Vretj17lDmbu5lj         # Pipeline: Luxury Garage
ARIZAR_FIRST_STAGE_ID=ff45edf1-dc39-448d-aa96-187a74882e8e   # 📩 Consulta Recibida
ARIZAR_STAGE_SEGUIMIENTO=3fb7716e-fd32-4098-bfb1-833734c2f11d  # 💬 En Seguimiento
ARIZAR_STAGE_PROPUESTA=51ba4ba7-cb85-450b-8271-fa80240c3a6d    # 📋 Propuesta Enviada
ARIZAR_STAGE_VISITA=a9c8ec9f-2130-40a0-8c4f-b01b3e05ce8a      # 📅 Visita Agendada
ARIZAR_STAGE_MIEMBRO=54c3ce50-c9cb-43a9-b6b1-45ec867da3ae     # ✅ Miembro Activo
ARIZAR_STAGE_PERDIDO=4eb2cbf5-e2f1-4c8d-b080-efd0dd57018f     # ❌ No Convirtió
ARIZAR_WEBHOOK_SECRET=pending_configuration
ARIZAR_EMAIL_FROM=noreply@arizar-ia.cloud

# Workflows (se obtienen después de crearlos en ARIZAR UI)
ARIZAR_WORKFLOW_BIENVENIDA=pending
ARIZAR_WORKFLOW_POST_SERVICIO=pending
ARIZAR_WORKFLOW_RECUPERACION=pending
ARIZAR_WORKFLOW_RENOVACION=pending

# IDs de Google Reviews
ARIZAR_GOOGLE_REVIEW_LINK=pending

# ═══ MASFACIL ═══
MASFACIL_API_KEY=pending
MASFACIL_SECRET=pending
MASFACIL_WEBHOOK_SECRET=pending
MASFACIL_BASE_URL=https://api.masfacil.com.py

# ═══ LUXURY GARAGE ═══
DATABASE_URL=postgresql://...
JWT_SECRET=xxxx
JWT_EXPIRES_IN=7d
PORT=3002
NODE_ENV=production
FRONTEND_URL=https://luxurygarage.arizar-ia.cloud
```

### 8.1 URLs y Accesos Importantes
```
# App de producción
FRONTEND: https://luxurygarage.arizar-ia.cloud
BACKEND API: https://luxurygarage.arizar-ia.cloud/api
PANEL CRM ADMIN: https://luxurygarage.arizar-ia.cloud/admin/crm
REGISTRO PÚBLICO: https://luxurygarage.arizar-ia.cloud/register
INFO PARA CRAWLER: https://luxurygarage.arizar-ia.cloud/info.html

# ARIZAR IA (GoHighLevel)
ARIZAR UI: https://app.arizar-ia.com/v2/location/7vxGjfpLYraWDT9MrXWU
MARKETPLACE APP: https://marketplace.gohighlevel.com
CUSTOM PAGE URL: https://luxurygarage.arizar-ia.cloud/admin/crm
  → Título: ARIZARIA X LUXURY
  → Placement: Left menu navigation
  → Visible on: Sub-account Left Navigation Menu
  → Icon: shower
```

---

## 9. ORDEN DE IMPLEMENTACIÓN

### Fase 1 — Fundación (PRIMERO)
1. Crear custom fields en ARIZAR (script)
2. Crear tags base en ARIZAR (script)
3. Crear productos/precios en ARIZAR (script)
4. Configurar pipeline en ARIZAR (UI)
5. Configurar calendario en ARIZAR (UI)
6. Obtener todos los IDs y configurar .env

### Fase 2 — Contactos y Sync (ya avanzado)
1. ✅ arizarService.js — métodos CRUD
2. ✅ arizarSync.js — sync bidireccional
3. ✅ webhooks.js — recibir eventos
4. ✅ auth.js — sync al registrar
5. Conectar custom fields en cada sync

### Fase 3 — Pagos y Facturas
1. Investigar e integrar API de MasFacil
2. Crear facturas en ARIZAR al confirmar pago
3. Endpoint para que frontend muestre facturas desde ARIZAR
4. Webhook de MasFacil para pagos automáticos

### Fase 4 — Bot IA y Knowledge Base
1. Cargar Knowledge Base (script)
2. Crear bot Conversation AI (API)
3. Configurar prompts del bot
4. Testear flujo completo WhatsApp → bot → pago

### Fase 5 — Workflows y Automatizaciones
1. Crear los 4 workflows en ARIZAR UI
2. Conectar triggers desde el código
3. Configurar workflow de reseñas post-servicio

### Fase 6 — Reseñas y Social
1. Integrar reviews en el portal
2. Conectar Social Planner
3. Template de publicaciones

### Fase 7 — Voice AI y Optimización
1. Configurar agente de voz
2. Optimizar rate limiting y colas
3. Dashboard combinado de métricas

---

## 10. PREGUNTAS PENDIENTES PARA EL NEGOCIO

Antes de implementar necesitamos respuestas:

1. **¿Cuáles son los precios reales de cada plan?**
2. **¿Cuántas bahías de lavado tiene el local?** (para capacidad del calendario)
3. **¿Horario de atención exacto?**
4. **¿Ya tenés cuenta de MasFacil con API?**
5. **¿Ya tenés la cuenta de ARIZAR IA creada?** → Necesito los IDs
6. **¿Tenés Google My Business?** → Para el link de reseñas
7. **¿Querés que el bot IA pueda agendar turnos directamente?** ¿O solo informa?
8. **¿Los empleados van a usar ARIZAR también?** ¿O solo el portal?
9. **¿Hay servicios extra fuera de membresía?** (ej: detailing que se cobra aparte)
10. **¿Dirección del local?**
