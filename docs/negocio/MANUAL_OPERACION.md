# Cómo funciona Luxury Garage

**Manual de operación** — el recorrido completo, desde que el admin crea una cuenta hasta que la plata entra al comercio y el mes se renueva solo.

| | |
|---|---|
| **Ambiente** | Producción |
| **Cobros** | Bancard VPOS |
| **Avisos** | Correo (Resend) + WhatsApp cuando se active el CRM |
| **Moneda** | Guaraníes |
| **Ciclo** | Mensual adelantado |
| **App** | https://luxurygarage.arizar-ia.cloud |

---

## La regla que ordena todo

**Nadie usa el servicio sin haber pagado antes.** La membresía se cobra el día que el cliente se asocia y se vuelve a cobrar cada mes por adelantado, siempre contra una tarjeta que quedó registrada. No hay período de gracia ni cuentas activas sin cobro.

De ahí sale todo lo demás: el admin no puede «activarle» un plan a alguien que no pagó, el cliente no entra a la app hasta cargar su tarjeta, y el sistema no le descuenta lavados a quien no tiene una membresía paga.

### Los planes que se cobran

| Plan | Por mes | Qué incluye |
|---|---|---|
| **Básico** | ₲ 250.000 | 4 lavados de ducha, aspirado y cera carnauba |
| **Premium** | ₲ 450.000 | Ducha, aspirado y cera **ilimitados** + 1 sellador cerámico |
| **VIP** | ₲ 750.000 | Todo ilimitado, con los adicionales incluidos |

Los precios y los cupos se editan desde **Admin › Planes**. El sistema siempre cobra el precio que esté vigente en el momento del débito.

---

## 1. El admin da de alta al cliente

> **Quién:** Admin

En **Admin › Miembros › Nuevo cliente**: nombre, correo, WhatsApp, el plan que contrató y, si querés, su vehículo.

Al guardar, el sistema crea la cuenta con una contraseña temporal y deja el plan **preseleccionado, no activo**. Esa distinción es la clave: el cliente todavía no tiene membresía, no tiene lavados y no figura como socio en ningún reporte. Solo queda anotado qué plan eligió para no tener que buscarlo después.

**Las credenciales le llegan por correo siempre**, con su usuario, su contraseña temporal y los tres pasos que le esperan al entrar. Si además marcás *enviar por WhatsApp*, le llegan por los dos lados (eso requiere el CRM activo). Junto con la bienvenida se le manda un enlace para confirmar que el correo es suyo.

> **El correo es obligatorio y es la llave de la cuenta.** Es con lo que entra, por donde recibe los avisos de cobro y por donde recupera su contraseña. El teléfono, en cambio, es opcional. Por eso el sistema valida que el correo esté bien escrito antes de guardar: si tiene un error de tipeo, esa persona no recibe nada.

> **Excepción para cobros fuera de la app**
>
> Si alguien te paga en efectivo o por transferencia, podés activarle el plan a mano desde la ficha del cliente, en **Miembros › Membresía**. Eso sí activa la membresía sin cobrar, y queda registrado en la auditoría con tu usuario. Es la única forma de dar un plan sin débito.

---

## 2. El cliente entra y activa su cuenta

> **Quién:** Cliente · Bancard

Entra a la app con sus credenciales y no puede navegar a ningún lado: le aparece una pantalla de alta obligatoria que ocupa toda la app.

Son tres pasos, en orden, y el siguiente no se habilita hasta completar el anterior:

1. **Registra su tarjeta.** Se abre el formulario seguro de Bancard dentro de la app. Los datos de la tarjeta viajan directo al banco: nunca pasan por nuestros servidores ni quedan guardados acá. Lo que se guarda es una referencia que permite volver a cobrarle.
2. **Confirma su plan.** Le aparece marcado el que eligió el admin; puede cambiarlo si quiere otro.
3. **Paga.** Se le debita el primer mes en el acto.

Recién cuando el cobro sale aprobado se le activa la membresía y entra a la app con sus lavados disponibles. La única salida sin completar el alta es cerrar sesión.

> **Cuándo vuelve a ver esta pantalla**
>
> Cada vez que se quede sin membresía activa: si canceló la renovación y le venció el mes, o si su plan expiró porque no se pudo cobrar. El texto cambia a «Activá tu membresía» y, como ya tiene la tarjeta cargada, le alcanza con elegir plan y pagar.

---

## 3. Cómo entra la plata

> **Quién:** Bancard · Automático

Todo cobro sigue el mismo recorrido, sea la primera membresía, una renovación, un turno suelto o una recarga de billetera.

**1 · Se pide el cobro**
El sistema arma la operación y la manda a Bancard con la referencia de la tarjeta del cliente. Antes de mandarla, deja anotado el cobro como pendiente, con su monto y su motivo.

**2 · El banco responde**
Solo se considera aprobado si el banco devuelve las dos señales de éxito. Una respuesta «procesada» pero con código de rechazo se trata como rechazo: no entrega nada.

**3 · Se entrega lo pagado**
Con el cobro aprobado se activa la membresía, se acredita el saldo o se confirma el turno, y el pago queda registrado con su número de ticket y autorización.

**4 · La plata cae en el comercio**
El dinero entra por tu cuenta de comercio en Bancard y se liquida según el acuerdo que tengas con ellos. El sistema no toca ni retiene plata: solo ordena el cobro y registra el resultado.

**5 · Red de seguridad**
Cada 5 minutos el sistema revisa los cobros que quedaron a medias —se cortó internet, el cliente cerró el navegador, se perdió el aviso del banco— y le pregunta a Bancard qué pasó realmente con cada uno. Si estaba aprobado, entrega lo pagado; si fue rechazado, lo marca como fallido.

### Qué impide que se cobre de más o de menos

- **Nunca se cobra dos veces lo mismo.** Si el aviso del banco y la revisión automática llegan a la vez, solo uno de los dos entrega el servicio; el otro reconoce que ya está hecho y no hace nada.
- **Un rechazo no regala nada.** Si el banco deniega, no se activa la membresía ni se acredita saldo.
- **El monto se verifica contra el banco.** Si lo cobrado no coincide exactamente con lo pedido, la operación se anula en vez de entregarse.
- **Si el banco no responde, no se da por perdido.** El cobro queda pendiente y se reintenta, en lugar de marcarse como fallido a ciegas.
- **Doble clic no cobra doble.** Mientras hay un cobro en curso para un cliente, el sistema rechaza el segundo con un aviso.

> ⚠️ **Recordá**
>
> Desde el pase a producción, todos los cobros son con **dinero real**. Las tarjetas de prueba de Bancard ya no funcionan: si alguien las carga, la operación se rechaza.

---

## 4. El cliente usa el servicio

> **Quién:** Cliente · Empleado

### Reserva el turno

Elige servicio, vehículo, día y hora. Según su plan, pasa una de tres cosas:

| Situación | Qué paga |
|---|---|
| **Le queda cupo** del plan | ₲ 0 — se le descuenta un lavado |
| **Se le acabó el cupo** | Elige: paga ahora, o lo carga al próximo mes |
| **Servicio fuera de su plan** | Paga el precio completo |

Cuando paga, puede hacerlo con su tarjeta o con el saldo de su billetera. Si elige cargarlo al próximo mes, ese monto se suma a su próxima renovación en un solo débito. Y si después cancela ese turno, el cargo se anula: no se le cobra.

### Los lavados se descuentan solos

El contador va por **ciclo de membresía**, no por mes calendario. Alguien que se asocia el 25 tiene sus lavados hasta el 25 del mes siguiente, no hasta fin de mes. En su pantalla ve cuántos usó y cuántos le quedan; cuando se le acaban, le avisa que el próximo se cobra aparte.

- Si **cancela** un turno, recupera ese lavado.
- Si **no se presenta**, lo pierde.

### El día del servicio: el QR

El cliente muestra su carnet digital desde la app. El empleado lo escanea desde su panel y en un solo gesto queda todo cerrado:

- Se ve en pantalla quién es, qué plan tiene, qué vehículo trae y qué servicio reservó.
- El turno pasa a completado y queda registrado qué empleado lo atendió.
- Se descuentan del inventario los insumos que consume ese servicio.
- Se le descuenta el lavado y el empleado ve cuántos le quedan — el mismo número que ve el cliente en su app.

El QR se renueva cada 15 minutos y va firmado, así que no se puede fabricar ni reutilizar. Si el cliente no tiene una reserva pendiente, el escaneo se bloquea y le pide que reserve primero: así nadie se lleva un lavado sin turno.

---

## 5. El mes se renueva solo

> **Quién:** Automático

Todos los días a las 7 de la mañana el sistema busca las membresías que vencen y les cobra el mes siguiente a la misma tarjeta.

Si el cobro sale bien, arranca un ciclo nuevo con el cupo completo, y al cliente le llega un WhatsApp confirmando la renovación, el monto y los últimos dígitos de su tarjeta. Si tenía extras cargados al próximo mes, se cobran juntos en el mismo débito.

Si el cobro falla, la membresía no se renueva y le llega un WhatsApp para que regularice. Al vencerse, su plan queda inactivo y la próxima vez que entre le aparece la pantalla para volver a activarlo.

### Avisos automáticos

Todos salen **por correo**. Cuando se active el CRM, los mismos avisos van también por WhatsApp sin tocar nada.

| Cuándo | Qué recibe el cliente |
|---|---|
| 7 días antes | Su membresía vence pronto |
| 1 día antes | Recordatorio urgente |
| El día, 7:00 | Comprobante del cobro, con monto, tarjeta y nueva fecha de vencimiento |
| Si el cobro falla | Aviso de que no se pudo cobrar, con el motivo probable y el botón para regularizar |
| 3 días después de vencer | Si no renovó, oferta para volver |
| Día antes del turno | Recordatorio de su reserva |

---

## Los casos que van a pasar

### Quiere subir de plan a mitad de mes

Paga solo la diferencia proporcional a los días que le quedan, no el precio completo. Conserva su fecha de vencimiento y el mes siguiente ya se le cobra el precio del plan nuevo. El monto exacto se le muestra antes de confirmar.

### Quiere bajar de plan

No puede hacerlo solo: el sistema lo bloquea. Un admin tiene que habilitárselo desde el panel. Así se evita que alguien contrate el VIP, lo use y se pase al Básico antes del cobro.

### Quiere cancelar

Lo hace desde **Mis Membresías**. No se le cobra el mes siguiente, pero mantiene su plan hasta la fecha de vencimiento que ya pagó. Puede reactivarlo cuando quiera.

### Se le rechaza la tarjeta

El cobro no entrega nada y el pago queda registrado como fallido. Si fue en una renovación, recibe el WhatsApp para regularizar. Si fue al asociarse, la pantalla de alta le ofrece reintentar o usar otra tarjeta.

### La billetera

El cliente puede cargar saldo con su tarjeta y usarlo para pagar turnos sueltos. Es útil para quien no tiene plan o se le acabó el cupo. El saldo es solo para consumir servicios.

### Se olvidó la contraseña

**Lo resuelve solo, sin escribirte.** En el login toca «¿Olvidaste tu contraseña?», pone su correo y le llega un enlace para crear una nueva. El enlace vence en una hora y sirve una sola vez: apenas la cambia, deja de funcionar.

Si igual te escribe, podés resetearla vos desde **Miembros › Contraseña**: se le manda la nueva por correo automáticamente.

Un detalle pensado a propósito: cuando alguien pide recuperar su contraseña, el sistema responde siempre lo mismo exista o no esa cuenta. Así nadie puede usar esa pantalla para averiguar qué correos están registrados.

---

## Lo que mira el admin

| Dónde | Para qué |
|---|---|
| **Cobros** | Todos los pagos con su estado. Acá se ve si alguno quedó pendiente o fallido. |
| **Finanzas** | Lo que entró en el período, por concepto. |
| **Miembros** | Quién está activo, con qué plan y desde cuándo. |
| **Calendario** | Los turnos del día y de la semana. |
| **Inventario** | Stock real, que baja solo con cada servicio cerrado. |
| **Auditoría** | Quién hizo cada movimiento sensible y cuándo. |

Lo que conviene revisar seguido son los **cobros pendientes**: si alguno queda trabado más de unos minutos, es señal de que algo pasó con ese pago en particular.

---

## Los correos que se le mandan al cliente

Salen desde `no-reply@luxurygarage.arizar-ia.cloud`, con el logo y los colores del negocio.

| Correo | Cuándo sale |
|---|---|
| **Bienvenida** | Al crear su cuenta. Trae usuario, contraseña temporal y los 3 pasos del alta. |
| **Confirmá tu correo** | Junto con la bienvenida, para validar que la dirección existe. |
| **Restablecé tu contraseña** | Cuando la pide desde el login. Vence en 1 hora. |
| **Contraseña restablecida** | Cuando un admin se la cambia desde el panel. |
| **Tu membresía se renovó** | Con cada cobro mensual. Sirve de comprobante. |
| **No pudimos renovar** | Cuando el cobro no sale. |
| **Tu membresía vence** | A 7 días y a 1 día del vencimiento. |
| **Recordatorio de turno** | El día antes de su reserva. |

---

*Sistema en producción · Pagos por Bancard VPOS · Correo por Resend · Facturación gestionada por fuera del sistema.*
