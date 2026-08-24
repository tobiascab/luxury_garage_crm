# 🏦 PLAN DE INTEGRACIÓN: MasFazzil × Luxury Garage

> **Fecha:** 25 de Marzo 2026  
> **Objetivo:** Integrar la pasarela de pagos MasFazzil para cobros automáticos y manuales  
> **API Docs:** `api-doc.pdf` + `masfazzil-api-catastros.pdf` (en esta misma carpeta)

---

## 📊 ESTADO ACTUAL DEL PROYECTO

### ✅ Lo que YA existe (pero necesita actualización):
- `masfacilService.js` — Servicio básico con endpoints **INCORRECTOS** (usa API genérica, no la real de MasFazzil)
- `masfacil-webhooks.js` — Webhook handler + endpoint `create-payment` (estructura correcta pero endpoints falsos)
- `payments.js` route — Solo un GET básico, sin integración real
- Modelo `Payment` en Prisma — Estructura base funcional
- Frontend `MyMembership.jsx` — Muestra planes pero **sin botón de pago real**
- Frontend `MyWallet.jsx` — Wallet con top-up pero **sin conexión a pasarela**

### ❌ Lo que FALTA:
- Autenticación OAuth2 real contra MasFazzil
- Registro/catastro de tarjetas del cliente
- Cobros reales a tarjetas registradas
- Gestión de clientes en MasFazzil
- Sistema de débitos automáticos (operaciones + cuotas)
- Almacenar `masfazzil_customer_uuid` por usuario
- Panel administrativo de pagos
- Frontend para gestionar tarjetas del cliente

---

## 🎯 FASES DE IMPLEMENTACIÓN (De más importante a menos)

---

### 🔴 FASE 1: AUTENTICACIÓN + SERVICIO BASE (CRÍTICO)
**Prioridad:** ⭐⭐⭐⭐⭐ | **Tiempo estimado:** 1-2 horas

Reescribir completamente `masfacilService.js` usando la API real documentada.

#### 1.1 Variables de entorno necesarias
```env
# .env del backend
MASFAZZIL_AUTH_URL=https://auth.masfazzil.com.py
MASFAZZIL_GATEWAY_URL=https://gateway.masfazzil.com.py
MASFAZZIL_STAGE=prod          # o 'sandbox' para pruebas
MASFAZZIL_CLIENT_ID=xxx       # Proporcionado por MasFazzil
MASFAZZIL_CLIENT_SECRET=xxx   # Proporcionado por MasFazzil
MASFAZZIL_MERCHANT_UUID=xxx   # UUID del comercio en MasFazzil
MASFAZZIL_WEBHOOK_SECRET=xxx  # Para verificar webhooks
```

#### 1.2 Tareas:
- [ ] Reescribir `masfacilService.js` con OAuth2 real (`POST /oauth2/token`)
- [ ] Implementar cache de token (expira en 3600s)
- [ ] Implementar auto-refresh de token antes de expirar
- [ ] Crear métodos para cada endpoint de la API
- [ ] Agregar logging y manejo de errores robusto

#### Endpoints a implementar en el servicio:
| Método | Función | API Endpoint |
|--------|---------|-------------|
| `authenticate()` | Obtener/refrescar token | `POST /oauth2/token` |
| `registerCard(customerData)` | Catastrar tarjeta | `POST /card/register` |
| `listCards(customerUuid)` | Listar tarjetas | `GET /card/list` |
| `chargeCard(chargeData)` | Cobrar | `POST /card/charge` |
| `deleteCard(cardId)` | Eliminar tarjeta | `DELETE /card` |
| `createClient(clientData)` | Crear cliente | `POST /debit/clients` |
| `getClientByDocument(docNumber)` | Buscar por CI | `GET /debit/clients/by-document/{doc}` |
| `getClientPaymentTokens(uuid)` | Tarjetas del cliente | `GET /debit/clients/{uuid}/payment-tokens` |
| `createOperation(opData)` | Crear débito programado | `POST /debit/operations` |
| `getOperation(code)` | Buscar operación | `GET /debit/operations?search={code}` |
| `getOperationStatus(uuid)` | Estado de operación | `GET /operations/{uuid}` |
| `getOperationPreview(uuid)` | Resumen de cuotas | `GET /operations/{uuid}/preview` |
| `getInstallments(uuid)` | Detalle de cuotas | `GET /operations/{uuid}/installments` |
| `deleteClient(uuid)` | Eliminar cliente | `DELETE /debit/clients/{uuid}` |

---

### 🟠 FASE 2: GESTIÓN DE CLIENTES EN MASFAZZIL (ALTA)
**Prioridad:** ⭐⭐⭐⭐ | **Tiempo estimado:** 1-2 horas

Sincronizar usuarios de Luxury Garage con clientes de MasFazzil.

#### 2.1 Actualizar schema de Prisma:
```prisma
model User {
  // ... campos existentes ...
  masfazzilCustomerUuid  String?  @map("masfazzil_customer_uuid")
  masfazzilDocumentType  String?  @map("masfazzil_document_type")  // CI o RUC
  documentNumber         String?  @map("document_number")          // Cédula
}
```

#### 2.2 Tareas:
- [ ] Migración de DB: agregar campos `masfazzil_customer_uuid`, `document_number`, `document_type`
- [ ] Al registrar o editar un cliente → crear/actualizar en MasFazzil automáticamente
- [ ] Endpoint: `POST /api/payments/sync-customer` — sincroniza usuario con MasFazzil
- [ ] En el registro de usuario, pedir CI obligatorio
- [ ] Agregar campo CI al formulario de registro/perfil del frontend
- [ ] Manejo de duplicados (buscar primero por documento antes de crear)

---

### 🟡 FASE 3: REGISTRO DE TARJETAS (ALTA)
**Prioridad:** ⭐⭐⭐⭐ | **Tiempo estimado:** 2-3 horas

Permitir que los clientes registren sus tarjetas de débito/crédito.

#### 3.1 Backend:
- [ ] `POST /api/payments/card/register` — Inicia catastro, devuelve `redirect_url`
- [ ] `GET /api/payments/cards` — Lista tarjetas del usuario logueado
- [ ] `DELETE /api/payments/card/:cardId` — Elimina tarjeta
- [ ] Almacenar `card_id`, `brand`, `masked_number`, `is_primary` en nueva tabla o JSON en usuario

#### 3.2 Frontend — Nueva página "Mis Tarjetas" (o sección dentro de MyWallet):
- [ ] Botón "Agregar Tarjeta" → abre URL de MasFazzil en iframe o nueva ventana
- [ ] Lista de tarjetas registradas con opción de eliminar
- [ ] Seleccionar tarjeta principal
- [ ] Indicador visual de marca (Visa, Mastercard, etc.)

#### 3.3 Nuevo modelo Prisma (opcional, se puede usar JSON en User):
```prisma
model PaymentCard {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  masfazzilCardId String   @unique @map("masfazzil_card_id")
  alias           String?
  maskedNumber    String   @map("masked_number")
  brand           String
  issuer          String?
  cardType        String?  @map("card_type")  // Débito/Crédito
  isPrimary       Boolean  @default(false) @map("is_primary")
  createdAt       DateTime @default(now()) @map("created_at")
  user            User     @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@map("payment_cards")
}
```

---

### 🟢 FASE 4: COBROS DE MEMBRESÍAS (ALTA)
**Prioridad:** ⭐⭐⭐⭐ | **Tiempo estimado:** 2-3 horas

Lo que genera dinero — cobrar membresías con la tarjeta registrada.

#### 4.1 Backend:
- [ ] Reescribir `POST /api/masfacil/create-payment` → usar `card/charge` real
- [ ] Flujo: Cliente elige plan → selecciona tarjeta → se cobra automáticamente
- [ ] Crear registro `Payment` en DB con todos los datos de la transacción
- [ ] Webhook de confirmación → activar membresía (ya existe base)
- [ ] Endpoint: `POST /api/payments/charge-membership` con `{ planId, cardId }`

#### 4.2 Frontend — Actualizar `MyMembership.jsx`:
- [ ] Botón "Pagar" en cada plan → modal con selección de tarjeta
- [ ] Mostrar tarjetas registradas del usuario
- [ ] Confirmación de cobro con monto y tarjeta
- [ ] Loading state + feedback de éxito/error
- [ ] Si no tiene tarjeta → redirigir a registrar tarjeta primero

#### 4.3 Flujo completo:
```
Cliente → Elige Plan → Selecciona Tarjeta → Confirma
  → Backend cobra con /card/charge
    → MasFazzil procesa
      → Si éxito → Activar Membresía + Crear Payment + Notificar
      → Si falla → Mostrar error + Sugerir otra tarjeta
```

---

### 🔵 FASE 5: DÉBITOS AUTOMÁTICOS / CUOTAS (MEDIA)
**Prioridad:** ⭐⭐⭐ | **Tiempo estimado:** 3-4 horas

Cobro automático mensual de membresías usando el sistema de operaciones.

#### 5.1 Backend:
- [ ] Al activar membresía con `autoRenew: true` → crear operación en MasFazzil
- [ ] `POST /api/payments/operations` — Crear operación de débito
- [ ] `GET /api/payments/operations/:id` — Estado de operación
- [ ] `GET /api/payments/operations/:id/installments` — Ver cuotas
- [ ] Cron job: verificar estado de cuotas diariamente
- [ ] Webhook: procesar notificaciones de cobros automáticos

#### 5.2 Nuevo modelo Prisma:
```prisma
model DebitOperation {
  id                    String   @id @default(uuid())
  userId                String   @map("user_id")
  membershipId          String?  @map("membership_id")
  masfazzilOperationId  String   @unique @map("masfazzil_operation_id")
  code                  String   @unique
  status                String   @default("ACTIVE")
  installments          Int
  amountPerInstallment  Int      @map("amount_per_installment")
  startDate             DateTime @map("start_date")
  createdAt             DateTime @default(now()) @map("created_at")
  user                  User     @relation(fields: [userId], references: [id])
  
  @@map("debit_operations")
}
```

#### 5.3 Frontend:
- [ ] En MyMembership: toggle de "Débito automático"
- [ ] Vista de cuotas pagadas/pendientes/vencidas
- [ ] Indicador visual del estado del débito

---

### 🟣 FASE 6: PANEL ADMIN DE PAGOS (MEDIA)
**Prioridad:** ⭐⭐⭐ | **Tiempo estimado:** 3-4 horas

Dashboard financiero para el administrador.

#### 6.1 Backend:
- [ ] `GET /api/admin/payments` — Listar todos los pagos con filtros
- [ ] `GET /api/admin/payments/stats` — Estadísticas financieras
- [ ] `POST /api/admin/payments/charge` — Cobro manual a un cliente
- [ ] `GET /api/admin/payments/operations` — Ver operaciones de débito
- [ ] `POST /api/admin/payments/refund` — Procesar reembolsos

#### 6.2 Frontend — Actualizar `FinanceDashboard.jsx`:
- [ ] Cards: Ingresos del mes, cobros pendientes, cuotas vencidas, tasa de cobro
- [ ] Tabla de transacciones con filtros (fecha, estado, cliente, monto)
- [ ] Gráfico de ingresos mensuales
- [ ] Lista de cuotas vencidas con acción de re-cobro
- [ ] Botón de cobro manual a un cliente específico

---

### ⚪ FASE 7: WALLET TOP-UP VÍA TARJETA (BAJA)
**Prioridad:** ⭐⭐ | **Tiempo estimado:** 1-2 horas

Permitir cargar saldo a la billetera del showroom usando MasFazzil.

#### 7.1 Tareas:
- [ ] Actualizar `MyWallet.jsx` — botón "Cargar" usa tarjeta registrada
- [ ] Backend: `POST /api/credits/topup-card` — cobra monto y acredita en wallet
- [ ] Montos rápidos (₲50.000, ₲100.000, ₲200.000, ₲500.000)
- [ ] Historial de cargas con referencia de transacción MasFazzil

---

### ⚫ FASE 8: SERVICIOS EXTRAS + COBROS PUNTUALES (BAJA)
**Prioridad:** ⭐⭐ | **Tiempo estimado:** 2-3 horas

Cobrar servicios adicionales no incluidos en la membresía.

#### 8.1 Tareas:
- [ ] Al agendar servicio extra → mostrar precio y opción de pagar
- [ ] Cobro al confirmar cita si el servicio tiene costo
- [ ] Descuento automático por membresía (ej: Premium = 15% off extras)
- [ ] Opción de cobrar con saldo de wallet o con tarjeta

---

## 🔐 CREDENCIALES NECESARIAS (Antes de empezar)

Para arrancar necesito que me proporciones:

| Dato | Descripción | ¿Lo tenés? |
|------|-------------|------------|
| `client_id` | ID de cliente OAuth2 de MasFazzil | ❓ |
| `client_secret` | Secret key OAuth2 | ❓ |
| `merchant_uuid` | UUID de tu comercio | ❓ |
| `stage` | Ambiente (sandbox o prod) | ❓ |
| `webhook_secret` | Secret para verificar webhooks | ❓ |

---

## 📅 CRONOGRAMA SUGERIDO

| Fase | Nombre | Duración | Dependencias |
|------|--------|----------|-------------|
| 1 | Autenticación + Servicio Base | 1-2h | Credenciales |
| 2 | Gestión de Clientes | 1-2h | Fase 1 |
| 3 | Registro de Tarjetas | 2-3h | Fases 1, 2 |
| 4 | Cobros de Membresías | 2-3h | Fases 1, 2, 3 |
| 5 | Débitos Automáticos | 3-4h | Fases 1-4 |
| 6 | Panel Admin de Pagos | 3-4h | Fases 1-4 |
| 7 | Wallet Top-up | 1-2h | Fases 1, 3 |
| 8 | Servicios Extras | 2-3h | Fases 1, 3, 4 |

**Total estimado: 15-23 horas de desarrollo**

---

## ⚡ RECOMENDACIÓN DE INICIO

**Empezar por Fases 1 → 2 → 3 → 4** en ese orden exacto.  
Con esas 4 fases completadas, los clientes ya podrán:
1. ✅ Registrar su tarjeta
2. ✅ Elegir un plan
3. ✅ Pagar su membresía
4. ✅ Que la membresía se active automáticamente

Eso cubre el **80% del valor de negocio** con solo ~8 horas de trabajo.
