const crypto = require('crypto');

/**
 * Mandato de débito automático: el documento donde el cliente autoriza expresamente que se
 * le debite la mensualidad de su tarjeta.
 *
 * Dos ideas sostienen todo esto:
 *
 *  1. **El texto se guarda entero en cada contrato**, no por referencia. Si mañana se editan
 *     las condiciones desde el panel, cada contrato viejo sigue mostrando exactamente lo que
 *     esa persona aceptó. Un contrato que cambia solo no sirve como respaldo.
 *
 *  2. **Las variables se resuelven al aceptar**, y los valores quedan congelados adentro del
 *     texto. El monto, el plan y la tarjeta que figuran son los de ese momento.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Plantilla por defecto. Se edita desde Admin › Contratos › Condiciones.
//  Las variables van entre llaves dobles y se listan en VARIABLES para que el
//  editor del panel las muestre y valide.
// ─────────────────────────────────────────────────────────────────────────────
const VERSION_INICIAL = '1.0';

const PLANTILLA_POR_DEFECTO = `AUTORIZACIÓN DE DÉBITO AUTOMÁTICO RECURRENTE

Documento N° {{numero_contrato}}
Fecha y hora de aceptación: {{fecha_aceptacion}}

1. PARTES

Por una parte, {{comercio_razon_social}}, con RUC N° {{comercio_ruc}}, con domicilio en {{comercio_direccion}}, en adelante «EL COMERCIO».

Por otra parte, {{cliente_nombre}}, con documento N° {{cliente_documento}}, con correo electrónico {{cliente_email}}, en adelante «EL CLIENTE».

2. OBJETO

EL CLIENTE contrata el plan de membresía «{{plan_nombre}}» y AUTORIZA de forma expresa, libre e informada a EL COMERCIO a debitar de su tarjeta de pago el importe correspondiente, con la periodicidad y en las condiciones que se detallan en este documento.

3. IMPORTE Y PERIODICIDAD

Importe autorizado: {{monto}} ({{monto_letras}}) por período.
Periodicidad: {{periodicidad}}.
Medio de pago: tarjeta {{tarjeta_marca}} terminada en {{tarjeta_ultimos4}}.
Primer débito: al momento de aceptar este documento.
Débitos siguientes: en la fecha de vencimiento de cada período, de forma automática.

EL CLIENTE reconoce que el primer débito se realiza de manera inmediata y que el período contratado comienza a correr desde la fecha efectiva del pago.

4. RENOVACIÓN AUTOMÁTICA

La membresía se renueva automáticamente por períodos iguales, debitándose el importe vigente a la misma tarjeta, salvo que EL CLIENTE cancele la renovación conforme al punto 6.

Si EL COMERCIO modificara el precio del plan, notificará a EL CLIENTE con una antelación no menor a treinta (30) días corridos al correo electrónico registrado. EL CLIENTE podrá cancelar la renovación antes de la fecha del siguiente débito si no aceptara el nuevo importe. La continuidad del servicio sin cancelación se entenderá como aceptación del nuevo importe.

5. ALCANCE DE LA AUTORIZACIÓN

Esta autorización comprende exclusivamente:
a) el importe de la membresía contratada y sus renovaciones;
b) los servicios adicionales que EL CLIENTE solicite expresamente y elija diferir al siguiente período, los que se debitarán junto con la renovación correspondiente;
c) las diferencias proporcionales que se generen si EL CLIENTE decide cambiar a un plan de mayor valor durante un período en curso.

EL COMERCIO no podrá debitar ningún otro concepto sin una nueva autorización de EL CLIENTE.

6. CANCELACIÓN

EL CLIENTE puede cancelar esta autorización en cualquier momento, sin expresión de causa ni penalidad, desde la sección «Mis Membresías» de la aplicación, o comunicándolo a EL COMERCIO por los canales de contacto informados.

La cancelación surte efecto para los débitos futuros. La membresía permanecerá activa hasta la finalización del período ya abonado, conservando EL CLIENTE todos sus beneficios hasta esa fecha. Los importes correspondientes a períodos ya debitados no se reintegran, salvo lo previsto en el punto 8.

7. RECHAZO DEL DÉBITO

Si un débito no pudiera concretarse por falta de fondos, límite excedido, vencimiento o cualquier otra causa imputable al medio de pago, EL COMERCIO notificará a EL CLIENTE al correo registrado. La membresía no se renovará y quedará inactiva hasta que se regularice el pago. EL COMERCIO podrá reintentar el débito.

8. DEVOLUCIONES

Si se produjera un débito por un importe distinto al autorizado o por un concepto no comprendido en el punto 5, EL CLIENTE podrá reclamarlo dentro de los treinta (30) días corridos y EL COMERCIO procederá a su devolución dentro de los diez (10) días hábiles de verificado el error.

9. TRATAMIENTO DE LOS DATOS DE LA TARJETA

Los datos de la tarjeta de EL CLIENTE son ingresados y almacenados directamente por Bancard S.A., procesador de pagos autorizado, a través de su formulario seguro. EL COMERCIO no accede, no almacena ni tiene visibilidad sobre el número completo de la tarjeta, su código de seguridad ni su fecha de vencimiento. EL COMERCIO conserva únicamente una referencia cifrada provista por el procesador, que le permite ejecutar los débitos autorizados, junto con la marca y los últimos cuatro dígitos a los solos efectos de identificación.

10. DATOS PERSONALES

Los datos personales de EL CLIENTE se tratan con la finalidad de prestar el servicio contratado, gestionar los cobros y enviar comunicaciones relativas a la membresía y a los turnos. No se ceden a terceros ajenos a la prestación del servicio. EL CLIENTE puede solicitar el acceso, la rectificación o la supresión de sus datos por los canales de contacto informados.

11. CONSTANCIA DE LA ACEPTACIÓN

EL CLIENTE manifiesta haber leído íntegramente este documento y prestar su conformidad de manera expresa mediante la aceptación electrónica registrada por el sistema, dejándose constancia de los siguientes datos:

Fecha y hora: {{fecha_aceptacion}}
Dirección IP de origen: {{ip}}
Dispositivo: {{user_agent}}

Esta constancia electrónica tiene plena validez como manifestación de voluntad de EL CLIENTE.

12. JURISDICCIÓN

Para cualquier controversia derivada de este documento, las partes se someten a la jurisdicción de los tribunales ordinarios de la ciudad de Asunción, República del Paraguay, renunciando a cualquier otro fuero que pudiera corresponderles.


EL CLIENTE declara haber leído y aceptado la presente autorización de débito automático recurrente.`;

/** Variables disponibles, para el editor del panel. */
const VARIABLES = [
  { clave: 'numero_contrato', descripcion: 'Número correlativo del documento' },
  { clave: 'fecha_aceptacion', descripcion: 'Fecha y hora en que el cliente aceptó' },
  { clave: 'cliente_nombre', descripcion: 'Nombre y apellido del cliente' },
  { clave: 'cliente_documento', descripcion: 'Documento del cliente (CI/RUC)' },
  { clave: 'cliente_email', descripcion: 'Correo del cliente' },
  { clave: 'plan_nombre', descripcion: 'Plan contratado' },
  { clave: 'monto', descripcion: 'Importe en guaraníes (ej. ₲ 250.000)' },
  { clave: 'monto_letras', descripcion: 'Importe escrito en letras' },
  { clave: 'periodicidad', descripcion: 'Cada cuánto se debita (ej. mensual)' },
  { clave: 'tarjeta_marca', descripcion: 'Marca de la tarjeta (ej. Visa)' },
  { clave: 'tarjeta_ultimos4', descripcion: 'Últimos 4 dígitos' },
  { clave: 'comercio_razon_social', descripcion: 'Razón social del negocio' },
  { clave: 'comercio_ruc', descripcion: 'RUC del negocio' },
  { clave: 'comercio_direccion', descripcion: 'Domicilio del negocio' },
  { clave: 'ip', descripcion: 'IP desde la que aceptó' },
  { clave: 'user_agent', descripcion: 'Navegador y dispositivo' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Importe en letras (guaraníes, sin centavos)
// ─────────────────────────────────────────────────────────────────────────────
const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function tresCifras(n) {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  let out = '';
  const c = Math.floor(n / 100), resto = n % 100;
  if (c) out += CENTENAS[c];
  if (resto) {
    if (out) out += ' ';
    if (resto < 20) out += UNIDADES[resto];
    else {
      const d = Math.floor(resto / 10), u = resto % 10;
      if (d === 2 && u) out += 'veinti' + UNIDADES[u];
      else out += DECENAS[d] + (u ? ' y ' + UNIDADES[u] : '');
    }
  }
  return out;
}

/** Convierte un entero de guaraníes a letras. Ej: 250000 → "doscientos cincuenta mil guaraníes". */
function montoEnLetras(gs) {
  const n = Math.round(Number(gs) || 0);
  if (n === 0) return 'cero guaraníes';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes = [];
  if (millones) partes.push(millones === 1 ? 'un millón' : `${tresCifras(millones)} millones`);
  if (miles) partes.push(miles === 1 ? 'mil' : `${tresCifras(miles)} mil`);
  if (resto) partes.push(tresCifras(resto));
  // Concordancia: "un millón DE guaraníes", pero "un millón doscientos mil guaraníes".
  const nexo = millones && !miles && !resto ? ' de ' : ' ';
  return `${partes.join(' ')}${nexo}guaraníes`.replace(/\s+/g, ' ').trim();
}

// En el documento se escribe "Gs." y no "₲" a propósito: el símbolo guaraní (U+20B2) queda
// fuera de la codificación que usan las fuentes base de PDF, así que al generarlo salía
// convertido en basura y descolocaba el renglón entero. "Gs." es además la forma habitual
// en documentos formales paraguayos. Vale para el texto guardado, la pantalla y el PDF.
const formatGs = (gs) => `Gs. ${Number(gs || 0).toLocaleString('es-PY')}`;

/** Fecha y hora en formato legible de Paraguay. */
function fechaLarga(d = new Date()) {
  const fecha = new Intl.DateTimeFormat('es-PY', {
    timeZone: 'America/Asuncion', day: '2-digit', month: 'long', year: 'numeric',
  }).format(d);
  const hora = new Intl.DateTimeFormat('es-PY', {
    timeZone: 'America/Asuncion', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
  return `${fecha}, ${hora} hs`;
}

/** Reemplaza {{variables}} por sus valores. Las que no tengan valor quedan marcadas. */
function resolverPlantilla(plantilla, valores) {
  return String(plantilla || '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, clave) => {
    const v = valores[clave];
    return (v === undefined || v === null || v === '') ? `«${clave} no definido»` : String(v);
  });
}

/** Lee la configuración del mandato (plantilla + versión). Devuelve la de fábrica si no hay. */
async function obtenerConfig(prisma) {
  const row = await prisma.setting.findUnique({ where: { key: 'debit_mandate' } }).catch(() => null);
  const guardado = row?.value && typeof row.value === 'object' ? row.value : {};
  return {
    plantilla: guardado.plantilla || PLANTILLA_POR_DEFECTO,
    version: guardado.version || VERSION_INICIAL,
    titulo: guardado.titulo || 'Autorización de débito automático',
    resumen: guardado.resumen
      || 'Autorizás que se debite la mensualidad de tu tarjeta de forma automática. Podés cancelar cuando quieras.',
  };
}

/** Datos del comercio desde Ajustes. Los que falten quedan marcados en el documento. */
async function datosComercio(prisma) {
  const claves = ['business_legal_name', 'business_name', 'tax_id', 'business_address', 'business_phone', 'business_email'];
  const rows = await prisma.setting.findMany({ where: { key: { in: claves } } }).catch(() => []);
  const v = Object.fromEntries(rows.map((r) => [r.key, typeof r.value === 'string' ? r.value : r.value ?? '']));
  return {
    razonSocial: v.business_legal_name || v.business_name || '',
    nombreComercial: v.business_name || '',
    ruc: v.tax_id || '',
    direccion: v.business_address || '',
    telefono: v.business_phone || '',
    email: v.business_email || '',
  };
}

/** Qué datos del comercio faltan cargar (para avisar en el panel). */
function faltantesComercio(comercio) {
  const req = { razonSocial: 'Razón social', ruc: 'RUC', direccion: 'Domicilio fiscal' };
  return Object.entries(req).filter(([k]) => !comercio[k]).map(([, label]) => label);
}

/** Número correlativo: LG-2026-0001 */
async function siguienteNumero(prisma) {
  const anio = new Date().getFullYear();
  const [{ n }] = await prisma.$queryRaw`
    SELECT count(*)::int AS n FROM contracts WHERE numero LIKE ${`LG-${anio}-%`}`;
  return `LG-${anio}-${String(n + 1).padStart(4, '0')}`;
}

/**
 * Arma el texto final del mandato con todos los valores resueltos.
 * Se usa tanto para MOSTRARLO antes de aceptar como para GUARDARLO al aceptar,
 * así el cliente firma exactamente lo que leyó.
 */
function componerTexto({ plantilla, numero, cliente, comercio, plan, montoGs, tarjeta, fecha, ip, userAgent, periodicidad = 'mensual' }) {
  return resolverPlantilla(plantilla, {
    numero_contrato: numero,
    fecha_aceptacion: fechaLarga(fecha),
    cliente_nombre: cliente?.nombre,
    cliente_documento: cliente?.documento,
    cliente_email: cliente?.email,
    plan_nombre: plan,
    monto: formatGs(montoGs),
    monto_letras: montoEnLetras(montoGs),
    periodicidad,
    tarjeta_marca: tarjeta?.marca,
    tarjeta_ultimos4: tarjeta?.ultimos4,
    comercio_razon_social: comercio?.razonSocial,
    comercio_ruc: comercio?.ruc,
    comercio_direccion: comercio?.direccion,
    ip,
    user_agent: userAgent,
  });
}

module.exports = {
  PLANTILLA_POR_DEFECTO,
  VERSION_INICIAL,
  VARIABLES,
  obtenerConfig,
  datosComercio,
  faltantesComercio,
  siguienteNumero,
  componerTexto,
  montoEnLetras,
  formatGs,
  fechaLarga,
  resolverPlantilla,
};
