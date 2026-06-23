# Luxury Garage — Modelo de Negocio y Ruta de Procesos

> Documento vivo. Mapea cómo funciona el negocio de punta a punta (verificado contra el código real, 2026-06-20) y marca qué cierra y qué falta cerrar. Sirve como guía operativa y de producto.

---

## 0. Veredicto en una línea

**El modelo tiene sentido de principio a fin y está bien pensado** (embudo comercial → membresía → reserva → servicio → fidelización → backoffice, todo conectado y con CRM). Lo que falta no es el "qué" sino **cerrar bordes**: (1) **facturación legal paraguaya**, (2) **unificar el cierre de servicio** (QR vs panel), y (3) **automatizar la conversión de leads**. Nada de esto invalida el modelo; son los últimos pasos para operar prolijo.

---

## 1. La cadena de valor (6 fases)

```
 FASE 0           FASE 1          FASE 2            FASE 3        FASE 4          FASE 5            FASE 6
 CATÁLOGO   →    CAPTACIÓN   →   CONVERSIÓN   →    RESERVA   →   SERVICIO   →   FIDELIZACIÓN  →   BACKOFFICE
 (configurar)    (lead)          (membresía/pago)  (turno)       (ejecución)    (recurrencia)     (medir/cobrar)
```

### FASE 0 — Catálogo (lo configura el ADMIN antes de operar)
Es la base sobre la que corre todo. Sin esto bien cargado, las fases siguientes fallan.
- **Planes** (`plans`): Básico ₲250.000 (4 lavados), Premium ₲450.000 (exterior ilimitado + 1 sellador), VIP ₲750.000 (todo ilimitado + domicilio). Cada plan define **cobertura por servicio** (`servicesIncluded`: slug + cupo + adicionales incluidos).
- **Servicios** (`services`): hoy 2 reales — *Ducha+Cera Carnauba* (40 min) y *Sellador Cerámico* (120 min). Precio **por tamaño de vehículo** (`pricingBySize`) + **adicionales** (`addons`: parte baja, motor).
- **Recetas de inventario** (`ServiceConsumption`): qué insumos consume cada servicio por tamaño. ⚠️ *Si no se carga, el stock nunca se descuenta.*
- **Bahías** (`bays_count`, default 3) → capacidad simultánea (anti-doble-booking).
- **Promociones** (`promotions`): códigos % o monto fijo con cupo y vigencia.

### FASE 1 — Captación (de visitante a lead)
1. Cliente entra a la **landing** pública.
2. Se vuelve **lead** por uno de 3 caminos:
   - **Cuestionario "Solicitar Membresía"** → `POST /api/membership-requests` → crea `MembershipRequest` (estado NEW) **+ entra a ARIZAR** (contacto + oportunidad en "Consulta Recibida"). *(Nuevo, recién implementado.)*
   - **Auto-registro** → `POST /api/auth/public-register` (crea cuenta CLIENT sin plan).
   - **Referido** → link con código → al registrarse completa el `Referral`.
3. El **admin** ve el lead en `/admin/solicitudes` y lo mueve: **Nuevo → Contactado → Convertido / Descartado**. En paralelo, ARIZAR corre el pipeline: *Consulta Recibida → Seguimiento → Propuesta → Visita → Miembro → Perdido*.

### FASE 2 — Conversión (de lead a miembro que paga)
1. Cliente elige plan (`GET /api/plans`).
2. **Registra tarjeta** (catastro Bancard) → `POST /api/payments/card/register` (iframe).
3. **Paga la membresía** → `POST /api/payments/charge-membership` (+ `charge-3ds-complete` si hay 3DS).
4. Se crea `Membership` **ACTIVE** (1 mes) y `Payment` COMPLETED. ARIZAR → **Miembro Activo** + WhatsApp de bienvenida.
5. Opcional: **recarga la billetera** (`charge-topup`) para pagar extras/showroom con saldo.

> Integridad financiera blindada (auditoría 2026-06-20): monto siempre desde la DB, locks anti doble-cobro, webhook que acredita, reconciliación cada 5 min. Ver `MEMORY/project_bancard_integridad`.

### FASE 3 — Reserva (turno)
1. Cliente pide cobertura (`GET /api/appointments/coverage/:serviceId`) → ¿lo cubre el plan? ¿cuánto cupo queda?
2. **Reserva** (`POST /api/appointments`). Modelo **híbrido** según cobertura:
   - **Cubierto** por el plan → ₲0.
   - **Pagar ahora** (cupo agotado o sin plan) → con tarjeta o billetera.
   - **Cargar al próximo mes** (overage) → se difiere a la renovación.
3. **Anti-doble-booking**: valida solape contra capacidad de bahías (dentro de transacción). Resultado: `Appointment` **CONFIRMED**.

### FASE 4 — Servicio (ejecución en el local)
1. Cliente llega y muestra su **carnet QR** (`GET /api/luxury/qr/token`, **firmado con HMAC**, vence 15 min).
2. **Empleado escanea** (`POST /api/luxury/qr/scan`) → valida firma → **redime la reserva CONFIRMED** → la marca COMPLETED → **descuenta inventario** (receta) → notifica al cliente.
3. *(Camino alternativo: panel del empleado con `/:id/start` → `/:id/complete`.)*

### FASE 5 — Fidelización y recurrencia
- **Notificaciones push** (turno, lavado listo, vencimiento, créditos).
- **Referidos** (créditos por traer clientes).
- **Renovación automática** de membresía (cron, con cobro Bancard si `autoRenew`).

### FASE 6 — Backoffice (medir y cobrar el negocio)
- **Finanzas** (`/admin/finance`): ingresos, ticket promedio, conversión, serie mensual.
- **Contabilidad** (`accounting`): egresos + IVA, cuentas por cobrar, partida doble (plan de cuentas, asientos, libro mayor), estado de resultados, reporte IVA.
- **CRM ARIZAR**: pipeline, WhatsApp/SMS/email, broadcast, workflows, sync de contactos/membresías.
- **Inventario**: stock, alertas de mínimo, proveedores, movimientos.
- **Reportes** (`reports`): miembros, citas, reseñas, finanzas.

---

## 2. Roles

| Rol | Hace |
|-----|------|
| **CLIENT** | Solicita/compra membresía, recarga billetera, reserva turnos, muestra QR, ve historial, refiere. |
| **EMPLOYEE** | Escanea QR / inicia-completa servicios, ve su agenda y sus stats. |
| **ADMIN** | Gestiona miembros, planes, servicios, promos, leads, inventario, finanzas, CRM. |
| **SUPER_ADMIN** | Todo lo de admin + crear admins, borrar planes/servicios, contabilidad sensible. |

---

## 3. Análisis crítico — ¿qué cierra y qué no?

### ✅ Lo que CIERRA bien (no tocar)
- El **embudo está completo y conectado** (lead → ARIZAR → membresía → reserva → servicio → renovación).
- El **cobro híbrido** (cubierto/pagar/diferir) es flexible y correcto.
- La **seguridad de pagos** quedó a nivel serio (locks, idempotencia, predicado de aprobación, reconciliación).
- El **QR firmado** evita que un empleado fabrique el carnet de otro cliente.
- La **contabilidad** tiene buena base (egresos, IVA, cuentas por cobrar, partida doble).

### 🔴 GAPS BLOQUEANTES (para operar legal/correcto)
1. **Facturación legal paraguaya (SET/DNIT, timbrado electrónico) — NO existe.** Hoy el comprobante se crea **manual en ARIZAR**. Para cobrar de verdad falta el comprobante fiscal automático tras cada pago Bancard (factura electrónica con timbrado). *Es el gap más importante del negocio.*
2. **Cierre de servicio con dos caminos no integrados (QR-scan vs panel start/complete).** Riesgos reales:
   - Inventario descontado **dos veces** (escaneo + complete) o **nunca** (start sin complete / complete sin start).
   - El QR solo redime turnos **CONFIRMED**: si el empleado ya "inició" por el panel (IN_PROGRESS), el escaneo falla.
   - **Recomendación:** un único camino de cierre idempotente (que `/complete` y el scan compartan el mismo guard "ya cerrado/ya consumido").

### 🟠 GAPS IMPORTANTES (cerrar antes de escalar)
3. **Conversión lead → cliente es manual.** No hay flujo que convierta un `MembershipRequest` en `User` + `Membership` con un click; el admin lo hace a mano.
4. **Receta de inventario opcional y silenciosa.** Si un servicio no tiene receta cargada, el stock nunca se descuenta y no avisa.
5. **Membresía en "limbo".** `upgrade` valida pero no crea la membresía hasta el pago; si el cliente abandona el pago, cree que tiene plan pero no lo tiene. Conviene reflejar el estado "pago pendiente".
6. **Overage (cargar al próximo mes).** Crea un `Payment` PENDING, pero el mecanismo de cobro en la renovación (y qué pasa si cancela con deuda) hay que **definirlo explícitamente**.
7. **Ledger contable no automático.** Los asientos (partida doble) se cargan a mano → riesgo de desbalance contra los pagos reales. Idealmente generar el asiento al confirmar un Payment/Expense.

### 🟡 MEJORAS (calidad/robustez)
8. **Sync ARIZAR best-effort**: si ARIZAR cae, el contacto puede quedar desincronizado sin alerta. Falta reintento + alerta.
9. **Dos modelos de lead conviven** (`MembershipRequest` nuevo + `Referral`). Conviene una vista unificada del embudo.
10. **Métrica de duración del servicio se pierde en el QR** (marca inicio=fin). Menor.

---

## 4. Recomendación de orden de trabajo

1. **Facturación legal SET/DNIT** (bloqueante de negocio) — evaluar facturador electrónico paraguayo o módulo ARIZAR.
2. **Unificar el cierre de servicio** (idempotente, un solo camino) — evita descuadres de inventario.
3. **Automatizar conversión lead → cliente** desde `/admin/solicitudes`.
4. **Alertar receta de inventario faltante** + definir el cobro de overage.
5. **Asiento contable automático** por cada Payment/Expense.
6. Robustez ARIZAR + vista única de embudo.

---

*Generado a partir del análisis del código real. Mantener actualizado cuando cambie un flujo.*
