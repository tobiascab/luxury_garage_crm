# Verificación del sistema

Pruebas end-to-end contra la base y la API **reales**. Sirven para confirmar, después de
cualquier cambio en cobros, cupos o cuentas, que la plata y los beneficios siguen funcionando
como corresponde.

Son seguras de correr en producción: cada una **limpia todo lo que crea** y verifica al final
que la base quedó igual que antes de empezar. `test-flujo` además corre entera dentro de una
transacción con rollback.

```bash
cd backend
node scripts/verificacion/test-flujo.js      # cupos de lavados del plan
node scripts/verificacion/test-cobros.js     # integridad de los cobros
node scripts/verificacion/test-http.js       # alta obligatoria, por HTTP
node scripts/verificacion/test-qr.js         # carnet QR y cierre del servicio
node scripts/verificacion/test-password.js   # recuperación de contraseña
```

Requieren el backend corriendo (`pm2 status luxury-api`) y leen la conexión del `.env`.

## Qué cubre cada una

| Archivo | Verifica |
|---|---|
| `test-flujo.js` | El cupo se descuenta uno a uno y se agota; cancelar un turno devuelve el lavado y no presentarse lo consume; los planes ilimitados; y que el cupo siga el **ciclo de la membresía** y no el mes calendario. |
| `test-cobros.js` | Que no se pueda cobrar dos veces lo mismo (incluso con 5 materializaciones simultáneas); que un rechazo del banco no entregue nada; que un monto que no coincide se anule; que un timeout deje el cobro pendiente en vez de darlo por perdido; y que la auto-renovación no recobre. |
| `test-http.js` | Que un cliente sin pagar no tenga membresía ni cupo, que se le exija el alta, y que al activarla entre con sus lavados. |
| `test-qr.js` | Que el escaneo cierre la reserva, descuente insumos del inventario y muestre el mismo cupo que ve el cliente; que un QR falsificado se rechace y que no se pueda escanear dos veces. |
| `test-password.js` | Enlace de un solo uso que vence en 1 hora; que no se pueda averiguar qué correos están registrados; y que el enlace de confirmar correo **no** sirva para cambiar la contraseña. |

## Ojo

`test-password.js` usa `scinnovationspy@gmail.com` (el correo dueño de la cuenta de Resend)
para crear su usuario de prueba. Si esa dirección alguna vez llega a ser un cliente real, la
prueba se aborta sola sin tocar nada.
