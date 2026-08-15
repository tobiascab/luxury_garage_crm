import { jsPDF } from 'jspdf';

/**
 * Arma el PDF de la autorización de débito automático.
 *
 * Lo usan el cliente (desde su cuenta) y el panel del admin, con el MISMO contrato guardado
 * en la base, así los dos descargan exactamente el mismo documento.
 *
 * El texto no se compone acá: viene entero desde el servidor (`texto_completo`), que es el
 * que el cliente aceptó. Este módulo solo lo maqueta.
 *
 * La hoja lleva espacio de firma al pie para poder imprimirla y hacerla firmar en persona.
 */

const TINTA = [18, 16, 14];
const GRIS = [122, 114, 102];
const ORO = [201, 162, 39];
const LINEA = [222, 216, 204];

const MARGEN = 18;      // mm
const ANCHO = 210;      // A4
const ALTO = 297;
const UTIL = ANCHO - MARGEN * 2;

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;

/**
 * Las fuentes base de PDF (Helvetica y compañía) solo entienden latin-1. Un carácter fuera de
 * ese rango —el símbolo ₲ es el caso típico— no solo se imprime mal: descoloca el espaciado
 * de todo el renglón. Acá se traducen los que pueden aparecer y se descarta cualquier otro,
 * así el documento nunca sale roto por un carácter suelto.
 */
const REEMPLAZOS = [
  [/₲/g, 'Gs.'],
  [/[""]/g, '"'],
  [/['']/g, "'"],
  [/…/g, '...'],
  [/—/g, '-'],
  [/–/g, '-'],
  [/ /g, ' '],   // espacio duro
  [/[•·]/g, '-'],
];

function aLatin1(texto) {
  let t = String(texto ?? '');
  for (const [re, rep] of REEMPLAZOS) t = t.replace(re, rep);
  // Lo que siga fuera de latin-1 se quita antes de que rompa el renglón.
  // Se conservan saltos y tabulaciones, que sí hacen falta.
  return t.replace(/[^\x20-\xFF\n\r\t]/g, '');
}

/**
 * Carga el logo y lo devuelve como dataURL para incrustarlo en el PDF.
 * Si no cargara, devuelve null y el encabezado sale solo con el nombre: un documento sin
 * logo es aceptable, uno que no se genera no.
 */
function cargarLogo() {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const corte = setTimeout(() => resolve(null), 4000);
      img.onload = () => {
        clearTimeout(corte);
        try {
          const lado = 256;
          const canvas = document.createElement('canvas');
          canvas.width = lado; canvas.height = lado;
          canvas.getContext('2d').drawImage(img, 0, 0, lado, lado);
          resolve(canvas.toDataURL('image/png'));
        } catch { resolve(null); }
      };
      img.onerror = () => { clearTimeout(corte); resolve(null); };
      img.src = '/pwa-192x192.png';
    } catch { resolve(null); }
  });
}

const fmtFecha = (d) => {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('es-PY', {
      timeZone: 'America/Asuncion', day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(d)) + ' hs';
  } catch { return String(d); }
};

/**
 * @param {object} contrato  fila de `contracts` tal como la devuelve la API
 * @returns {jsPDF}
 */
export async function construirContratoPdf(contrato) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const logo = await cargarLogo();
  const comercio = contrato.comercio_snapshot || {};
  const cliente = contrato.cliente_snapshot || {};

  let y = MARGEN;

  // ── Encabezado ────────────────────────────────────────────────────────────
  doc.setFillColor(...TINTA);
  doc.rect(0, 0, ANCHO, 26, 'F');
  doc.setFillColor(...ORO);
  doc.rect(0, 26, ANCHO, 1.2, 'F');

  // El escudo, si se pudo cargar. El texto se corre para dejarle lugar.
  const xTexto = logo ? MARGEN + 18 : MARGEN;
  if (logo) {
    try { doc.addImage(logo, 'PNG', MARGEN, 5.5, 15, 15, undefined, 'FAST'); } catch { /* sin logo */ }
  }

  doc.setTextColor(...ORO);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LUXURY GARAGE', xTexto, 13.5);

  doc.setTextColor(235, 231, 222);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (comercio.razonSocial) doc.text(aLatin1(comercio.razonSocial), xTexto, 19.5);
  if (comercio.ruc) doc.text(aLatin1(`RUC ${comercio.ruc}`), ANCHO - MARGEN, 19.5, { align: 'right' });

  doc.setTextColor(235, 231, 222);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(aLatin1(`N° ${contrato.numero || '-'}`), ANCHO - MARGEN, 13.5, { align: 'right' });

  y = 38;

  // ── Ficha de datos ────────────────────────────────────────────────────────
  const filas = [
    ['Cliente', cliente.nombre || '—'],
    ['Documento', cliente.documento || '—'],
    ['Correo', cliente.email || '—'],
    ['Plan contratado', contrato.plan_nombre || '—'],
    ['Importe autorizado', `${fmtGs(contrato.monto_gs)} · ${contrato.periodicidad || 'mensual'}`],
    ['Medio de pago', contrato.tarjeta_ultimos4 ? `${contrato.tarjeta_marca || 'Tarjeta'} •••• ${contrato.tarjeta_ultimos4}` : '—'],
    ['Aceptado el', fmtFecha(contrato.aceptado_en)],
  ];

  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGEN, y, UTIL, filas.length * 6.2 + 5, 2, 2, 'S');
  y += 6;

  filas.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRIS);
    doc.text(aLatin1(k), MARGEN + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TINTA);
    doc.text(aLatin1(String(v)), MARGEN + 42, y);
    y += 6.2;
  });

  y += 8;

  // ── Cuerpo del documento ──────────────────────────────────────────────────
  // El texto viene con títulos numerados ("3. IMPORTE Y PERIODICIDAD") y párrafos separados
  // por líneas en blanco. Los títulos se detectan para resaltarlos.
  const esTitulo = (l) => /^\d+\.\s+[A-ZÁÉÍÓÚÑ]/.test(l.trim());
  const esTituloPrincipal = (l) => /^[A-ZÁÉÍÓÚÑ\s]{15,}$/.test(l.trim());

  const nuevaPaginaSiHaceFalta = (alto) => {
    if (y + alto <= ALTO - 28) return;
    pintarPie(doc);
    doc.addPage();
    y = MARGEN + 4;
  };

  const parrafos = String(contrato.texto_completo || '').split('\n');

  parrafos.forEach((linea) => {
    const txt = linea.trim();
    if (!txt) { y += 3; return; }

    if (esTituloPrincipal(txt)) {
      nuevaPaginaSiHaceFalta(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...TINTA);
      const lineas = doc.splitTextToSize(aLatin1(txt), UTIL);
      doc.text(lineas, MARGEN, y);
      y += lineas.length * 5.6 + 3;
      return;
    }

    if (esTitulo(txt)) {
      nuevaPaginaSiHaceFalta(11);
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...TINTA);
      doc.text(aLatin1(txt), MARGEN, y);
      y += 5.4;
      return;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(52, 47, 40);
    const lineas = doc.splitTextToSize(aLatin1(txt), UTIL);
    lineas.forEach((l) => {
      nuevaPaginaSiHaceFalta(6);
      doc.text(l, MARGEN, y);
      y += 4.6;
    });
  });

  // ── Firmas ────────────────────────────────────────────────────────────────
  nuevaPaginaSiHaceFalta(48);
  y += 14;

  doc.setDrawColor(...LINEA);
  const anchoFirma = (UTIL - 14) / 2;
  [0, 1].forEach((i) => {
    const x = MARGEN + i * (anchoFirma + 14);
    doc.line(x, y, x + anchoFirma, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...TINTA);
    doc.text(i === 0 ? 'Firma del cliente' : 'Por el comercio', x, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text(aLatin1(i === 0 ? (cliente.nombre || '') : (comercio.razonSocial || '')), x, y + 9);
    if (i === 0 && cliente.documento) doc.text(aLatin1(`Doc. ${cliente.documento}`), x, y + 13);
  });

  pintarPie(doc);
  return doc;
}

/** Pie con la constancia electrónica y la paginación, en todas las hojas. */
function pintarPie(doc) {
  const total = doc.getNumberOfPages();
  const actual = doc.getCurrentPageInfo().pageNumber;
  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.2);
  doc.line(MARGEN, ALTO - 18, ANCHO - MARGEN, ALTO - 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRIS);
  doc.text('Documento generado electrónicamente. La aceptación quedó registrada con fecha, hora y origen.', MARGEN, ALTO - 13);
  doc.text(`Página ${actual} de ${total}`, ANCHO - MARGEN, ALTO - 13, { align: 'right' });
}

/** Nombre de archivo estable y prolijo. */
export function nombreArchivoContrato(contrato) {
  const nombre = (contrato.cliente_snapshot?.nombre || 'cliente')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // saca las tildes
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `autorizacion-debito-${contrato.numero || 's-n'}-${nombre}.pdf`;
}

/** Descarga el PDF. */
export async function descargarContratoPdf(contrato) {
  const doc = await construirContratoPdf(contrato);
  doc.save(nombreArchivoContrato(contrato));
}

/** Abre el diálogo de impresión con el documento ya cargado. */
export async function imprimirContratoPdf(contrato) {
  const doc = await construirContratoPdf(contrato);
  const url = doc.output('bloburl');
  const win = window.open(url, '_blank');
  if (win) win.addEventListener('load', () => win.print(), { once: true });
  return !!win;
}
