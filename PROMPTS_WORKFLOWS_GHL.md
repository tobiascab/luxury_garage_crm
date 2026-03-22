# 🤖 Guía Completa — Workflows GoHighLevel para Luxury Garage

> **Cuenta:** Luxury Garage — Location ID: `7vxGjfpLYraWDT9MrXWU`  
> **Fecha:** 22 de marzo de 2026

---

## ✅ Campos Personalizados (YA CREADOS en ARIZAR IA)

Los siguientes 13 campos ya existen en la tabla de contactos. Usá las **Field Keys** en workflows y plantillas:

| Campo | Tipo | Field Key (para usar en plantillas/workflows) | ID |
|-------|------|----------------------------------------------|-----|
| **Plan del cliente** | TEXT | `{{contact.luxury_plan}}` | OMNoyQsZgy1NXlFgaKRq |
| **Estado del plan** | TEXT | `{{contact.luxury_plan_status}}` | DY62rprSAZ1NfEqODKz0 |
| **Vencimiento del plan** | DATE | `{{contact.luxury_plan_expiry}}` | PjyPt05KYEGVnIodN6CU |
| **Vehículo 1** | TEXT | `{{contact.luxury_vehicle_1}}` | AW0dOVb7HdECoUyewluf |
| **Vehículo 2** | TEXT | `{{contact.luxury_vehicle_2}}` | 1ilDSGNSUeDYd9YmOySF |
| **Lavados realizados** | NUMERICAL | `{{contact.luxury_services_used}}` | k0TOMc0ws8FsVnYCCGMU |
| **Última visita** | DATE | `{{contact.luxury_last_visit}}` | zTQkUCsFPXCY7v9hpZHg |
| **Saldo billetera (Gs)** | NUMERICAL | `{{contact.luxury_wallet_balance}}` | gjfH5yOZafuQqRYggGJd |
| **Código de referido** | TEXT | `{{contact.luxury_referral_code}}` | ttHHCiRq9uHIxCf7n7UB |
| **ID interno** | TEXT | `{{contact.luxury_user_id}}` | l84SiBGBdn1qQceauRrq |
| **Marca vehículo** | TEXT | `{{contact.make}}` | pVaMQPP1rH2Jy1JVNhT7 |
| **Modelo vehículo** | TEXT | `{{contact.model}}` | 7pLyVhl9PCEH20cM9DpA |
| **Año vehículo** | NUMERICAL | `{{contact.year}}` | sKdtDS334CLIk7msdW9g |

---

## ✅ Pipeline (YA EXISTE en ARIZAR IA)

**Nombre:** `Marketing Pipeline`  
**ID:** `4FSeHaWZgmDl2rVBe2Iw`

| Posición | Stage | ID | Uso en Luxury Garage |
|----------|-------|----|---------------------|
| 0 | New Lead | bb715007-b256-4e9c-8574-9e1e63f9b8cb | Cliente nuevo llega (WhatsApp, portal, referido) |
| 1 | Hot Lead | fbc09ae9-8b30-49e7-9af0-c6775323d866 | Mostró interés en membresía |
| 2 | New Booking | 8b64f145-9fee-485e-87b5-92fc597a71a8 | Agendó su primer turno |
| 3 | Visit Attended | df1a9c0c-84d3-4468-93d1-d8d17ae50637 | Asistió al lavadero |
| 4 | Sale | 4f100df4-dc42-4b8c-818e-946083f2deb0 | Pagó membresía activa |
| 5 | Left a Review | 95f277d9-ad12-411b-8f4d-89e1f299b90a | Dejó reseña en Google |

---

## PASO 1: Crear Plantillas de WhatsApp

> Ir a **Settings → WhatsApp → Message Templates → Create Template**

### Plantilla 1: `bienvenida_miembro`
- **Categoría:** UTILITY
- **Idioma:** Spanish
- **Cuerpo del mensaje:**
```
🚗 ¡Bienvenido a la familia Luxury Garage, {{1}}!

Estamos felices de tenerte como miembro con el plan {{2}}.

✅ Agendá tu primer turno desde tu portal:
https://luxurygarage.arizar-ia.cloud/client/book

🚘 Tu vehículo registrado: {{3}}

📱 O respondé a este mensaje y te ayudamos.
¡Nos vemos pronto! 🏎️
```
- **Mapeo de variables:**
  - `{{1}}` → `{{contact.first_name}}` (Nombre)
  - `{{2}}` → `{{contact.luxury_plan}}` (Plan del cliente)
  - `{{3}}` → `{{contact.luxury_vehicle_1}}` (Vehículo 1)

---

### Plantilla 2: `recordatorio_primer_lavado`
- **Categoría:** UTILITY
- **Idioma:** Spanish
- **Cuerpo del mensaje:**
```
👋 ¡Hola {{1}}! Notamos que todavía no agendaste tu primer lavado.

Tu plan {{2}} está activo y tenés lavados disponibles. ¿Sabías que podés agendar en menos de 1 minuto?

👉 https://luxurygarage.arizar-ia.cloud/client/book

Si necesitás ayuda, respondé este mensaje. 😊
```
- **Mapeo de variables:**
  - `{{1}}` → `{{contact.first_name}}`
  - `{{2}}` → `{{contact.luxury_plan}}`

---

### Plantilla 3: `recordatorio_usar_membresia`
- **Categoría:** UTILITY
- **Idioma:** Spanish
- **Cuerpo del mensaje:**
```
🏆 ¡Recordá que tu membresía {{1}} incluye lavados que podés usar cuando quieras, {{2}}!

📊 Lavados realizados este mes: {{3}}

Agendá acá: https://luxurygarage.arizar-ia.cloud/client/book
¡Tu auto lo merece! 🚗✨
```
- **Mapeo de variables:**
  - `{{1}}` → `{{contact.luxury_plan}}`
  - `{{2}}` → `{{contact.first_name}}`
  - `{{3}}` → `{{contact.luxury_services_used}}`

---

### Plantilla 4: `solicitud_resena`
- **Categoría:** UTILITY
- **Idioma:** Spanish
- **Cuerpo del mensaje:**
```
✨ ¡Gracias por confiar en Luxury Garage, {{1}}!

Esperamos que tu {{2}} haya quedado impecable. 🚗

¿Cómo fue tu experiencia? Tu opinión nos ayuda mucho.

⭐ Dejanos tu reseña acá (30 segundos):
{{3}}

¡Gracias por ser parte de la familia! 💙
```
- **Mapeo de variables:**
  - `{{1}}` → `{{contact.first_name}}`
  - `{{2}}` → `{{contact.luxury_vehicle_1}}`
  - `{{3}}` → URL fija de Google Reviews (ponela directamente en la plantilla o como variable custom)

---

### Plantilla 5: `agradecimiento_resena`
- **Categoría:** UTILITY
- **Idioma:** Spanish
- **Cuerpo del mensaje:**
```
🎉 ¡Gracias por tu reseña, {{1}}!

Nos alegra saber que te gustó el servicio para tu {{2}}.

Como agradecimiento, tenés un 10% de descuento en tu próximo servicio extra. ¡Mencionalo al agendar! 🎁
```
- **Mapeo de variables:**
  - `{{1}}` → `{{contact.first_name}}`
  - `{{2}}` → `{{contact.luxury_vehicle_1}}`

---

### Plantilla 6: `resena_negativa_disculpa`
- **Categoría:** UTILITY
- **Idioma:** Spanish
- **Cuerpo del mensaje:**
```
Hola {{1}}, lamentamos que tu experiencia no haya sido la mejor.

Queremos solucionarlo personalmente. Un asesor te contactará en breve para asegurarnos de que quedes conforme.
```
- **Mapeo de variables:**
  - `{{1}}` → `{{contact.first_name}}`

---

### Plantilla 7: `recuperacion_inactivo`
- **Categoría:** UTILITY
- **Idioma:** Spanish
- **Cuerpo del mensaje:**
```
👋 ¡Hola {{1}}! Te extrañamos en Luxury Garage.

Tu membresía {{2}} sigue activa y tenés lavados disponibles. ¡No dejes que se pierdan tus beneficios!

🚘 Tu vehículo {{3}} merece estar impecable.

📅 Agendá tu próximo turno:
https://luxurygarage.arizar-ia.cloud/client/book

¿Necesitás ayuda? Respondé este mensaje. 😊
```
- **Mapeo de variables:**
  - `{{1}}` → `{{contact.first_name}}`
  - `{{2}}` → `{{contact.luxury_plan}}`
  - `{{3}}` → `{{contact.luxury_vehicle_1}}`

---

### Plantilla 8: `recuperacion_oferta`
- **Categoría:** MARKETING  ⚠️ (tiene promoción)
- **Idioma:** Spanish
- **Cuerpo del mensaje:**
```
🎁 ¡{{1}}, tenemos algo especial para vos!

Te ofrecemos un LAVADO PREMIUM GRATIS para tu {{2}} en tu próxima visita.

Solo agendá y mencioná esta promo:
https://luxurygarage.arizar-ia.cloud/client/book

⏰ Válido por 7 días. ¡Te esperamos! 🚗✨
```
- **Mapeo de variables:**
  - `{{1}}` → `{{contact.first_name}}`
  - `{{2}}` → `{{contact.luxury_vehicle_1}}`

---

### Plantilla 9: `renovacion_7dias`
- **Categoría:** UTILITY
- **Idioma:** Spanish
- **Cuerpo del mensaje:**
```
📋 ¡Hola {{1}}! Tu membresía {{2}} en Luxury Garage vence el {{3}}.

Para seguir disfrutando de tus beneficios sin interrupción, renová desde tu portal:

👉 https://luxurygarage.arizar-ia.cloud/client/membership

Si tenés dudas, respondé este mensaje. 💙
```
- **Mapeo de variables:**
  - `{{1}}` → `{{contact.first_name}}`
  - `{{2}}` → `{{contact.luxury_plan}}`
  - `{{3}}` → `{{contact.luxury_plan_expiry}}`

---

### Plantilla 10: `renovacion_2dias`
- **Categoría:** UTILITY
- **Idioma:** Spanish
- **Cuerpo del mensaje:**
```
⚠️ Tu membresía {{1}} vence en 2 días, {{2}}.

Si no renovás, perderás acceso a tus lavados y beneficios para tu {{3}}.

Renovar es rápido:
👉 https://luxurygarage.arizar-ia.cloud/client/membership

¿Querés hablar con alguien? Respondé este mensaje. 🙏
```
- **Mapeo de variables:**
  - `{{1}}` → `{{contact.luxury_plan}}`
  - `{{2}}` → `{{contact.first_name}}`
  - `{{3}}` → `{{contact.luxury_vehicle_1}}`

---

### Plantilla 11: `membresia_expirada`
- **Categoría:** UTILITY
- **Idioma:** Spanish
- **Cuerpo del mensaje:**
```
😔 Tu membresía {{1}} ha expirado, {{2}}.

Pero no te preocupes, podés reactivarla en cualquier momento:
👉 https://luxurygarage.arizar-ia.cloud/client/membership

Tu {{3}} te lo va a agradecer. ¡Esperamos verte pronto! 🚗
```
- **Mapeo de variables:**
  - `{{1}}` → `{{contact.luxury_plan}}`
  - `{{2}}` → `{{contact.first_name}}`
  - `{{3}}` → `{{contact.luxury_vehicle_1}}`

---

## PASO 2: Crear los 4 Workflows

> Ir a **Automation → Workflows → Create Workflow → Start from Scratch → Use AI**

---

### WORKFLOW 1: Bienvenida Nuevo Miembro

```
Crea un workflow llamado "Bienvenida Luxury Garage" que se active cuando un contacto reciba el tag "miembro-activo".

El workflow debe hacer lo siguiente en orden:

1. Esperar 1 minuto después del trigger.

2. Enviar un WhatsApp al contacto usando la plantilla "bienvenida_miembro" con estas variables:
   - {{1}} = Nombre del contacto ({{contact.first_name}})
   - {{2}} = Campo personalizado Plan ({{contact.luxury_plan}})
   - {{3}} = Campo personalizado Vehículo 1 ({{contact.luxury_vehicle_1}})

3. Esperar 24 horas.

4. Enviar un email al contacto con asunto "Tu guía de miembro - Luxury Garage" y cuerpo:
"Hola {{contact.first_name}},

¡Gracias por elegir Luxury Garage! Tu plan {{contact.luxury_plan}} está activo.

Como miembro, tenés acceso a:
🔹 Lavados incluidos en tu plan
🔹 Agenda prioritaria
🔹 Descuentos exclusivos en servicios extra
🔹 Portal web para gestionar todo

📅 Agendá tu primer turno: https://luxurygarage.arizar-ia.cloud/client/book

¿Tenés dudas? Respondé este email o escribinos por WhatsApp.

¡Que disfrutes la experiencia premium!
Equipo Luxury Garage"

5. Esperar 3 días.

6. Agregar una condición IF/ELSE: Si el contacto NO tiene el tag "primer-lavado-completado", entonces:
   - Enviar un WhatsApp usando la plantilla "recordatorio_primer_lavado" con:
     - {{1}} = {{contact.first_name}}
     - {{2}} = {{contact.luxury_plan}}

7. Si el contacto SÍ tiene el tag "primer-lavado-completado", finalizar.

8. Esperar 4 días más.

9. Enviar un WhatsApp usando la plantilla "recordatorio_usar_membresia" con:
   - {{1}} = {{contact.luxury_plan}}
   - {{2}} = {{contact.first_name}}
   - {{3}} = {{contact.luxury_services_used}}

10. Enviar una notificación interna al usuario asignado: "El miembro {{contact.first_name}} {{contact.last_name}} no ha usado su membresía {{contact.luxury_plan}} en 7 días."

Fin del workflow.
```

---

### WORKFLOW 2: Post-Servicio y Solicitud de Reseña

```
Crea un workflow llamado "Post-Servicio Reseña Luxury Garage" que se active cuando un contacto reciba el tag "primer-lavado-completado" o cuando un contacto sea agregado manualmente al workflow.

El workflow debe hacer lo siguiente en orden:

1. Esperar 2 horas después del trigger.

2. Enviar un WhatsApp usando la plantilla "solicitud_resena" con:
   - {{1}} = {{contact.first_name}}
   - {{2}} = {{contact.luxury_vehicle_1}}
   - {{3}} = Link de Google Reviews del negocio

3. Esperar 24 horas.

4. Agregar una condición IF/ELSE: Si el contacto NO tiene el tag "resena-positiva" y NO tiene el tag "resena-negativa", entonces:
   - Enviar un email con asunto "¿Cómo fue tu experiencia? ⭐ - Luxury Garage" y cuerpo:
   "Hola {{contact.first_name}},

   ¡Gracias por traer tu {{contact.luxury_vehicle_1}} a Luxury Garage!

   Tu opinión es super importante para nosotros. ¿Podés regalarnos 30 segundos para dejarnos una reseña?

   ⭐ Dejá tu reseña acá: [LINK DE GOOGLE REVIEWS]

   ¡Muchas gracias!
   Equipo Luxury Garage"

5. Si el contacto SÍ tiene alguno de esos tags, no hacer nada.

6. Esperar 48 horas más.

7. Agregar otra condición IF/ELSE: Si el contacto tiene el tag "resena-positiva", entonces:
   - Enviar un WhatsApp usando la plantilla "agradecimiento_resena" con:
     - {{1}} = {{contact.first_name}}
     - {{2}} = {{contact.luxury_vehicle_1}}
   - Agregar el tag "oferta-enviada".

8. Si el contacto tiene el tag "resena-negativa", entonces:
   - Enviar notificación interna: "⚠️ {{contact.first_name}} {{contact.last_name}} dejó una reseña negativa. Contactar inmediatamente."
   - Enviar un WhatsApp usando la plantilla "resena_negativa_disculpa" con:
     - {{1}} = {{contact.first_name}}

Fin del workflow.
```

---

### WORKFLOW 3: Recuperación de Clientes Inactivos

```
Crea un workflow llamado "Recuperación Inactivos Luxury Garage" que se active cuando un contacto reciba el tag "cliente-inactivo-15d".

El workflow debe hacer lo siguiente en orden:

1. Esperar 30 minutos después del trigger.

2. Enviar un WhatsApp usando la plantilla "recuperacion_inactivo" con:
   - {{1}} = {{contact.first_name}}
   - {{2}} = {{contact.luxury_plan}}
   - {{3}} = {{contact.luxury_vehicle_1}}

3. Esperar 3 días.

4. Agregar una condición IF/ELSE: Si el contacto todavía tiene el tag "cliente-inactivo-15d", entonces:
   - Enviar un email con asunto "Te guardamos un turno especial 🚗" y cuerpo:
   "Hola {{contact.first_name}},

   Notamos que hace un tiempo no traés tu {{contact.luxury_vehicle_1}} y queremos que sepas que te guardamos los mejores horarios.

   Tu plan {{contact.luxury_plan}} sigue activo y tenés lavados disponibles. ¡No los desperdicies!

   👉 Agendá acá: https://luxurygarage.arizar-ia.cloud/client/book

   Equipo Luxury Garage"

5. Si el contacto ya NO tiene el tag, finalizar.

6. Esperar 7 días más.

7. Agregar condición: Si el contacto tiene el tag "cliente-inactivo-30d", entonces:
   - Enviar un WhatsApp usando la plantilla "recuperacion_oferta" con:
     - {{1}} = {{contact.first_name}}
     - {{2}} = {{contact.luxury_vehicle_1}}
   - Agregar el tag "oferta-enviada".
   - Notificación interna: "Cliente inactivo 30d: {{contact.first_name}} {{contact.last_name}} - Plan: {{contact.luxury_plan}}"

8. Esperar 7 días más.

9. Si todavía tiene "cliente-inactivo-30d":
   - Agregar tag "churned".
   - Notificación interna: "⚠️ Cliente perdido: {{contact.first_name}} {{contact.last_name}}"

Fin del workflow.
```

---

### WORKFLOW 4: Renovación de Membresía

```
Crea un workflow llamado "Renovación Membresía Luxury Garage" que se active cuando un contacto reciba el tag "renovacion-pendiente".

El workflow debe hacer lo siguiente en orden:

1. Esperar 10 minutos después del trigger.

2. Enviar un WhatsApp usando la plantilla "renovacion_7dias" con:
   - {{1}} = {{contact.first_name}}
   - {{2}} = {{contact.luxury_plan}}
   - {{3}} = {{contact.luxury_plan_expiry}}

3. Esperar 3 días.

4. Enviar un email con asunto "Tu membresía vence pronto - Luxury Garage" y cuerpo:
"Hola {{contact.first_name}},

Tu plan {{contact.luxury_plan}} vence el {{contact.luxury_plan_expiry}}.

Renovando ahora, seguís con:
✅ Todos tus lavados incluidos
✅ Agenda prioritaria para tu {{contact.luxury_vehicle_1}}
✅ Descuentos exclusivos

👉 Renovar: https://luxurygarage.arizar-ia.cloud/client/membership

Equipo Luxury Garage"

5. Esperar 2 días más.

6. Enviar un WhatsApp usando la plantilla "renovacion_2dias" con:
   - {{1}} = {{contact.luxury_plan}}
   - {{2}} = {{contact.first_name}}
   - {{3}} = {{contact.luxury_vehicle_1}}

7. Esperar 2 días más.

8. Condición IF/ELSE: Si todavía tiene "renovacion-pendiente":
   - Enviar WhatsApp usando plantilla "membresia_expirada" con:
     - {{1}} = {{contact.luxury_plan}}
     - {{2}} = {{contact.first_name}}
     - {{3}} = {{contact.luxury_vehicle_1}}
   - Remover tag "renovacion-pendiente"
   - Agregar tag "miembro-inactivo"
   - Notificación interna: "Membresía expirada: {{contact.first_name}} {{contact.last_name}} - Plan: {{contact.luxury_plan}}"

9. Si ya NO tiene el tag, no hacer nada.

Fin del workflow.
```

---

## 📋 Después de Crear Todo

1. **Pasame los 4 Workflow IDs** (están en la URL de cada workflow)
2. **Pasame tu link de Google Reviews** para reemplazar en la plantilla `solicitud_resena`
3. Yo los configuro en el backend y queda 100% automático
