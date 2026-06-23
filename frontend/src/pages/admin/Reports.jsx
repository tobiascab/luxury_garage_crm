import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, Users, Wrench, Star,
  DollarSign, RefreshCw, CreditCard,
  Receipt, ClipboardList, Layers,
  Download, FileText, FileSpreadsheet, Loader2,
  Banknote, BarChart3, UserCheck, MessageSquare, Scale,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import api from '../../services/api';
import { formatGs } from '../../constants/pricing';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import Skeleton, { SkeletonStats } from '../../components/Skeleton';
import AnimatedNumber from '../../components/AnimatedNumber';
import { DateRangePicker } from '../../components/DatePicker';

// Paleta sobria para el pie de planes (primario de marca al frente).
const PIE_COLORS = ['#0040e0', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

// Paleta SOBRIA para los reportes exportados: carbón/negro + filete dorado de
// marca (acorde al logo dorado sobre negro). Sin azul brillante en el documento.
const INK = [15, 23, 42];      // carbón — banda de encabezado y títulos
const HEAD = [30, 41, 59];     // pizarra oscuro — encabezados de tabla
const GOLD = [201, 145, 47];   // dorado de marca — filete/acento
const INK_HEX = 'FF0F172A';    // ARGB ExcelJS (carbón)
const HEAD_HEX = 'FF1E293B';   // ARGB ExcelJS (pizarra)
const GOLD_HEX = 'FFC9912F';   // ARGB ExcelJS (dorado)
const SLATE_900 = [15, 23, 42];
const SLATE_500 = [100, 116, 139];
const GS_NUMFMT = '#,##0 "₲"';
const nf = (n) => Number(n || 0).toLocaleString('es-PY');

// Etiquetas legibles para los métodos de pago (Bancard es el proveedor actual).
const METHOD_LABELS = {
  bancard_card: 'Tarjeta',
  bancard_test: 'Tarjeta (prueba)',
  stripe: 'Tarjeta (legado)',
  stripe_card: 'Tarjeta (legado)',
  card: 'Tarjeta',
  cash: 'Efectivo',
  transfer: 'Transferencia',
};
const methodLabel = (m) => METHOD_LABELS[m] || (m ? m.replace(/_/g, ' ') : 'Otro');

// ── Tipos de reporte ────────────────────────────────────────────────────────
const REPORT_TYPES = [
  { key: 'general', label: 'General', icon: BarChart3 },
  { key: 'financiero', label: 'Financiero', icon: Banknote },
  { key: 'membresias', label: 'Membresías', icon: UserCheck },
  { key: 'servicios', label: 'Servicios', icon: Wrench },
  { key: 'resenas', label: 'Reseñas', icon: MessageSquare },
];
const TYPE_TITLE = {
  general: 'Reporte General',
  financiero: 'Reporte Financiero',
  membresias: 'Reporte de Membresías y Clientes',
  servicios: 'Reporte de Servicios y Citas',
  resenas: 'Reporte de Reseñas',
};

// Qué secciones aplican a cada tipo de reporte.
const shows = (type, section) => {
  if (type === 'general') return true;
  const map = {
    financiero: ['finance', 'revenueSeries', 'methods', 'expenses', 'net'],
    membresias: ['members'],
    servicios: ['appointments'],
    resenas: ['reviews'],
  };
  return (map[type] || []).includes(section);
};

// Carga el logo del negocio como dataURL para incrustarlo en PDF/Excel.
async function loadLogoDataUrl() {
  try {
    const res = await fetch('/logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

const MONTH_FMT = (m) => (m ? m.charAt(0).toUpperCase() + m.slice(1) : '');

// Rango por defecto: primer día del mes actual → hoy ('YYYY-MM-DD').
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const DEFAULT_FROM = () => { const n = new Date(); return ymd(new Date(n.getFullYear(), n.getMonth(), 1)); };
const DEFAULT_TO = () => ymd(new Date());
// dd/mm/aaaa a partir de 'YYYY-MM-DD'
const fmtDMY = (s) => {
  if (!s) return '';
  const [y, m, d] = String(s).split('-');
  return `${d}/${m}/${y}`;
};

export default function Reports() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);
  const [type, setType] = useState('general');

  const load = useCallback(async (f, t, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.get('/reports', { params: { from: f, to: t } });
      setData(res.data.data || null);
      if (isRefresh) toast.success('Datos actualizados');
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudieron cargar los reportes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(from, to); }, [load, from, to]);

  const onRangeChange = useCallback(({ from: f, to: t }) => {
    if (f) setFrom(f);
    if (t) setTo(t);
  }, []);

  // ── Datos derivados (siempre defensivos) ──────────────────────────────────
  const finance = data?.finance;
  const expenses = data?.expenses;
  const net = data?.net ?? 0;
  const members = data?.members;
  const appointments = data?.appointments;
  const reviews = data?.reviews;

  const revenueSeries = useMemo(
    () => (data?.revenueSeries || []).map((p) => ({ ...p, name: MONTH_FMT(p.label || p.name) })),
    [data],
  );
  const byMethod = useMemo(
    () => (finance?.byMethod || []).slice().sort((a, b) => b.total - a.total),
    [finance],
  );
  const byCategory = useMemo(
    () => (expenses?.byCategory || []).slice().sort((a, b) => b.total - a.total),
    [expenses],
  );
  const byPlan = useMemo(
    () => (members?.byPlan || []).filter((p) => p.count > 0).map((p) => ({ name: p.planName || 'Sin plan', value: p.count })),
    [members],
  );
  const byService = useMemo(
    () => (appointments?.byService || []).slice().sort((a, b) => b.count - a.count),
    [appointments],
  );
  const hasExpenses = (expenses?.count || 0) > 0;

  // ── Exportación ───────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const rangeLabel = `Del ${fmtDMY(from)} al ${fmtDMY(to)}`;
  const fileBase = `reporte-${type}-${from}_a_${to}`;

  // ── PDF SÚPER PREMIUM ──────────────────────────────────────────────────────
  const exportPDF = async () => {
    setMenuOpen(false);
    setExporting(true);
    try {
      // La fuente estándar de jsPDF (helvetica) no incluye el glifo ₲ (lo dibuja
      // como "²"). Dentro del PDF formateamos en guaraníes con el sufijo "Gs".
      // Este `formatGs` local sombrea al importado solo en este alcance.
      const formatGs = (n) => Number(n || 0).toLocaleString('es-PY') + ' Gs';
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const now = new Date();

      // Banda sobria (carbón) + filete dorado + logo
      doc.setFillColor(...INK);
      doc.rect(0, 0, W, 96, 'F');
      doc.setFillColor(...GOLD);
      doc.rect(0, 96, W, 2.5, 'F');
      const logo = await loadLogoDataUrl();
      if (logo) doc.addImage(logo, 'PNG', 40, 24, 48, 48);
      const tx = logo ? 102 : 40;
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(21);
      doc.text('LUXURY GARAGE', tx, 46);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      doc.text(TYPE_TITLE[type] || 'Reporte', tx, 66);
      doc.setFontSize(9);
      doc.text(rangeLabel, W - 40, 44, { align: 'right' });
      doc.text(`Generado: ${now.toLocaleString('es-PY')}`, W - 40, 58, { align: 'right' });

      const headStyles = { fillColor: HEAD, textColor: 255, fontStyle: 'bold' };
      const footStyles = { fillColor: [241, 245, 249], textColor: SLATE_900, fontStyle: 'bold' };
      const baseStyles = { fontSize: 10, cellPadding: 6 };
      let y = 126;

      const section = (title) => {
        if (y > H - 130) { doc.addPage(); y = 56; }
        doc.setTextColor(...SLATE_900); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
        doc.text(title, 40, y);
        y += 8;
      };
      const tableAfter = (opts) => {
        autoTable(doc, { startY: y, theme: 'grid', headStyles, styles: baseStyles, ...opts });
        y = doc.lastAutoTable.finalY + 22;
      };

      // ── Finanzas / KPIs ──────────────────────────────────────────────────
      if (shows(type, 'finance') && finance) {
        section('Indicadores financieros');
        tableAfter({
          head: [['Indicador', 'Valor']],
          body: [
            ['Ingresos cobrados', formatGs(finance.revenue)],
            ['Transacciones', nf(finance.transactions)],
            ['Ticket promedio', formatGs(finance.averageTicket)],
            ['Ingresos por suscripciones', formatGs(finance.subscriptionRevenue)],
            ['Ingresos por servicios', formatGs(finance.servicesRevenue)],
            ['Cobros pendientes', `${formatGs(finance.pendingTotal)} (${nf(finance.pendingCount)})`],
          ],
          columnStyles: { 1: { halign: 'right' } },
        });
      }

      // ── Ingresos vs egresos (serie mensual) ──────────────────────────────
      if (shows(type, 'revenueSeries') && revenueSeries.length) {
        section('Ingresos y egresos por mes');
        const totRev = revenueSeries.reduce((s, m) => s + (m.revenue || 0), 0);
        const totExp = revenueSeries.reduce((s, m) => s + (m.expenses || 0), 0);
        tableAfter({
          head: [['Mes', 'Ingresos', 'Egresos', 'Neto']],
          body: revenueSeries.map((m) => [
            m.name, formatGs(m.revenue), formatGs(m.expenses), formatGs((m.revenue || 0) - (m.expenses || 0)),
          ]),
          foot: [['Total', formatGs(totRev), formatGs(totExp), formatGs(totRev - totExp)]],
          footStyles,
          theme: 'striped',
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        });
      }

      // ── Métodos de pago ──────────────────────────────────────────────────
      if (shows(type, 'methods') && byMethod.length) {
        section('Métodos de pago');
        const total = byMethod.reduce((s, m) => s + (m.total || 0), 0);
        tableAfter({
          head: [['Método', 'Cantidad', 'Total']],
          body: byMethod.map((m) => [methodLabel(m.method), nf(m.count), formatGs(m.total)]),
          foot: [['Total', nf(byMethod.reduce((s, m) => s + (m.count || 0), 0)), formatGs(total)]],
          footStyles,
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        });
      }

      // ── Egresos por categoría ────────────────────────────────────────────
      if (shows(type, 'expenses') && byCategory.length) {
        section('Egresos por categoría');
        tableAfter({
          head: [['Categoría', 'Cantidad', 'Total']],
          body: byCategory.map((c) => [c.category, nf(c.count), formatGs(c.total)]),
          foot: [['Total', nf(expenses.count), formatGs(expenses.total)]],
          footStyles,
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        });
      }

      // ── Resultado neto ───────────────────────────────────────────────────
      if (shows(type, 'net') && finance) {
        section('Resultado del período');
        tableAfter({
          head: [['Concepto', 'Monto']],
          body: [
            ['Ingresos', formatGs(finance.revenue)],
            ['Egresos', formatGs(expenses?.total || 0)],
          ],
          foot: [['Resultado neto', formatGs(net)]],
          footStyles,
          columnStyles: { 1: { halign: 'right' } },
        });
      }

      // ── Membresías y clientes ────────────────────────────────────────────
      if (shows(type, 'members') && members) {
        section('Membresías y clientes');
        tableAfter({
          head: [['Indicador', 'Valor']],
          body: [
            ['Miembros activos', nf(members.active)],
            ['Nuevos clientes (rango)', nf(members.newInRange)],
            ['Por vencer (30 días)', nf(members.expiringSoon)],
          ],
          columnStyles: { 1: { halign: 'right' } },
        });
        if (byPlan.length) {
          section('Distribución por plan');
          tableAfter({
            head: [['Plan', 'Miembros']],
            body: byPlan.map((p) => [p.name, nf(p.value)]),
            foot: [['Total', nf(byPlan.reduce((s, p) => s + p.value, 0))]],
            footStyles,
            columnStyles: { 1: { halign: 'right' } },
          });
        }
      }

      // ── Servicios y citas ────────────────────────────────────────────────
      if (shows(type, 'appointments') && appointments) {
        section('Servicios y citas');
        tableAfter({
          head: [['Indicador', 'Valor']],
          body: [
            ['Citas totales', nf(appointments.total)],
            ['Completadas', nf(appointments.completed)],
            ['Canceladas', nf(appointments.cancelled)],
            ['Pendientes', nf(appointments.pending)],
          ],
          columnStyles: { 1: { halign: 'right' } },
        });
        if (byService.length) {
          section('Volumen por servicio');
          tableAfter({
            head: [['Servicio', 'Citas', 'Completadas', 'Ingresos']],
            body: byService.map((s) => [s.name, nf(s.count), nf(s.completed), formatGs(s.revenue)]),
            foot: [[
              'Total',
              nf(byService.reduce((a, s) => a + s.count, 0)),
              nf(byService.reduce((a, s) => a + s.completed, 0)),
              formatGs(byService.reduce((a, s) => a + (s.revenue || 0), 0)),
            ]],
            footStyles,
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
          });
        }
      }

      // ── Reseñas ──────────────────────────────────────────────────────────
      if (shows(type, 'reviews') && reviews) {
        section('Reseñas');
        tableAfter({
          head: [['Indicador', 'Valor']],
          body: [
            ['Total de reseñas', nf(reviews.total)],
            ['Calificación promedio', reviews.total ? `${reviews.average} / 5` : 'Sin datos'],
            ['Sin responder', nf(reviews.pending)],
          ],
          columnStyles: { 1: { halign: 'right' } },
        });
        if (reviews.total) {
          section('Distribución de estrellas');
          tableAfter({
            head: [['Estrellas', 'Cantidad', '% del total']],
            body: [5, 4, 3, 2, 1].map((star) => {
              const c = reviews.distribution?.[star] || 0;
              const pct = reviews.total ? Math.round((c / reviews.total) * 100) : 0;
              return [`${star} ★`, nf(c), `${pct}%`];
            }),
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
          });
        }
      }

      // ── Pie de página en todas las páginas ───────────────────────────────
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(40, H - 34, W - 40, H - 34);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.setTextColor(...SLATE_500);
        doc.text('Luxury Garage · Reporte confidencial', 40, H - 20);
        doc.text(`Página ${i} de ${pages}`, W - 40, H - 20, { align: 'right' });
      }

      doc.save(`${fileBase}.pdf`);
      toast.success('PDF generado');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo generar el PDF');
    } finally {
      setExporting(false);
    }
  };

  // ── Excel SÚPER PREMIUM ────────────────────────────────────────────────────
  const exportExcel = async () => {
    setMenuOpen(false);
    setExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Luxury Garage';
      wb.created = new Date();

      // Estilos reutilizables
      const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_HEX } };
      const headerFont = { bold: true, color: { argb: 'FFFFFFFF' } };
      const totalFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      const styleHeaderRow = (row) => {
        row.eachCell((cell) => {
          cell.fill = headerFill;
          cell.font = headerFont;
          cell.alignment = { vertical: 'middle' };
        });
        row.height = 20;
      };
      const styleTotalRow = (row) => {
        row.eachCell((cell) => { cell.fill = totalFill; cell.font = { bold: true }; });
      };
      const applyMoneyFmt = (sheet, colIdxs) => {
        colIdxs.forEach((idx) => { sheet.getColumn(idx).numFmt = GS_NUMFMT; });
      };

      // ── Hoja Resumen (con logo) ──────────────────────────────────────────
      const ws = wb.addWorksheet('Resumen');
      ws.columns = [{ width: 34 }, { width: 26 }, { width: 22 }, { width: 22 }];
      const dataUrl = await loadLogoDataUrl();
      let headRow = 1;
      if (dataUrl) {
        const id = wb.addImage({ base64: dataUrl.split(',')[1], extension: 'png' });
        ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: 96, height: 96 } });
        ws.getRow(1).height = 26;
        ws.getRow(2).height = 26;
        ws.getRow(3).height = 26;
        headRow = 6; // dejar espacio para el logo
      }
      const titleCell = ws.getCell(headRow, 2);
      titleCell.value = 'LUXURY GARAGE';
      titleCell.font = { bold: true, size: 16, color: { argb: INK_HEX } };
      titleCell.border = { bottom: { style: 'thin', color: { argb: GOLD_HEX } } };
      const subCell = ws.getCell(headRow + 1, 2);
      subCell.value = TYPE_TITLE[type] || 'Reporte';
      subCell.font = { bold: true, size: 11, color: { argb: 'FF334155' } };
      ws.getCell(headRow + 2, 2).value = rangeLabel;
      ws.getCell(headRow + 3, 2).value = `Generado: ${new Date().toLocaleString('es-PY')}`;
      ws.getCell(headRow + 2, 2).font = { color: { argb: 'FF64748B' } };
      ws.getCell(headRow + 3, 2).font = { color: { argb: 'FF64748B' } };

      // Tabla de KPIs según tipo
      const kpiRows = [];
      if (shows(type, 'finance') && finance) {
        kpiRows.push(['Ingresos cobrados (₲)', finance.revenue || 0]);
        kpiRows.push(['Transacciones', finance.transactions || 0]);
        kpiRows.push(['Ticket promedio (₲)', finance.averageTicket || 0]);
        kpiRows.push(['Suscripciones (₲)', finance.subscriptionRevenue || 0]);
        kpiRows.push(['Servicios (₲)', finance.servicesRevenue || 0]);
        kpiRows.push(['Cobros pendientes (₲)', finance.pendingTotal || 0]);
        kpiRows.push(['Cobros pendientes (cantidad)', finance.pendingCount || 0]);
      }
      if (shows(type, 'expenses') && expenses) {
        kpiRows.push(['Egresos totales (₲)', expenses.total || 0]);
      }
      if (shows(type, 'net') && finance) {
        kpiRows.push(['Resultado neto (₲)', net || 0]);
      }
      if (shows(type, 'members') && members) {
        kpiRows.push(['Miembros activos', members.active || 0]);
        kpiRows.push(['Nuevos clientes (rango)', members.newInRange || 0]);
        kpiRows.push(['Por vencer (30 días)', members.expiringSoon || 0]);
      }
      if (shows(type, 'appointments') && appointments) {
        kpiRows.push(['Citas totales', appointments.total || 0]);
        kpiRows.push(['Citas completadas', appointments.completed || 0]);
        kpiRows.push(['Citas canceladas', appointments.cancelled || 0]);
        kpiRows.push(['Citas pendientes', appointments.pending || 0]);
      }
      if (shows(type, 'reviews') && reviews) {
        kpiRows.push(['Reseñas totales', reviews.total || 0]);
        kpiRows.push(['Calificación promedio', reviews.total ? reviews.average : 0]);
        kpiRows.push(['Reseñas sin responder', reviews.pending || 0]);
      }

      ws.addRow([]);
      const kpiHeaderRowNum = headRow + 5;
      while (ws.rowCount < kpiHeaderRowNum - 1) ws.addRow([]);
      const kHead = ws.addRow(['Indicador', 'Valor']);
      styleHeaderRow(kHead);
      kpiRows.forEach((r) => ws.addRow(r));

      // ── Hoja: Ingresos mensuales ─────────────────────────────────────────
      if (shows(type, 'revenueSeries') && revenueSeries.length) {
        const s = wb.addWorksheet('Ingresos mensuales');
        s.columns = [{ width: 16 }, { width: 20 }, { width: 20 }, { width: 20 }];
        styleHeaderRow(s.addRow(['Mes', 'Ingresos (₲)', 'Egresos (₲)', 'Neto (₲)']));
        revenueSeries.forEach((m) => s.addRow([m.name, m.revenue || 0, m.expenses || 0, (m.revenue || 0) - (m.expenses || 0)]));
        const totRev = revenueSeries.reduce((a, m) => a + (m.revenue || 0), 0);
        const totExp = revenueSeries.reduce((a, m) => a + (m.expenses || 0), 0);
        styleTotalRow(s.addRow(['Total', totRev, totExp, totRev - totExp]));
        applyMoneyFmt(s, [2, 3, 4]);
      }

      // ── Hoja: Métodos de pago ────────────────────────────────────────────
      if (shows(type, 'methods') && byMethod.length) {
        const s = wb.addWorksheet('Métodos de pago');
        s.columns = [{ width: 24 }, { width: 14 }, { width: 20 }];
        styleHeaderRow(s.addRow(['Método', 'Cantidad', 'Total (₲)']));
        byMethod.forEach((m) => s.addRow([methodLabel(m.method), m.count || 0, m.total || 0]));
        styleTotalRow(s.addRow([
          'Total',
          byMethod.reduce((a, m) => a + (m.count || 0), 0),
          byMethod.reduce((a, m) => a + (m.total || 0), 0),
        ]));
        applyMoneyFmt(s, [3]);
      }

      // ── Hoja: Egresos por categoría ──────────────────────────────────────
      if (shows(type, 'expenses') && byCategory.length) {
        const s = wb.addWorksheet('Egresos por categoría');
        s.columns = [{ width: 28 }, { width: 14 }, { width: 20 }];
        styleHeaderRow(s.addRow(['Categoría', 'Cantidad', 'Total (₲)']));
        byCategory.forEach((c) => s.addRow([c.category, c.count || 0, c.total || 0]));
        styleTotalRow(s.addRow(['Total', expenses.count || 0, expenses.total || 0]));
        applyMoneyFmt(s, [3]);
      }

      // ── Hoja: Servicios ──────────────────────────────────────────────────
      if (shows(type, 'appointments') && byService.length) {
        const s = wb.addWorksheet('Servicios');
        s.columns = [{ width: 28 }, { width: 12 }, { width: 14 }, { width: 20 }];
        styleHeaderRow(s.addRow(['Servicio', 'Citas', 'Completadas', 'Ingresos (₲)']));
        byService.forEach((sv) => s.addRow([sv.name, sv.count || 0, sv.completed || 0, sv.revenue || 0]));
        styleTotalRow(s.addRow([
          'Total',
          byService.reduce((a, sv) => a + sv.count, 0),
          byService.reduce((a, sv) => a + sv.completed, 0),
          byService.reduce((a, sv) => a + (sv.revenue || 0), 0),
        ]));
        applyMoneyFmt(s, [4]);
      }

      // ── Hoja: Planes ─────────────────────────────────────────────────────
      if (shows(type, 'members') && byPlan.length) {
        const s = wb.addWorksheet('Planes');
        s.columns = [{ width: 28 }, { width: 16 }];
        styleHeaderRow(s.addRow(['Plan', 'Miembros']));
        byPlan.forEach((p) => s.addRow([p.name, p.value]));
        styleTotalRow(s.addRow(['Total', byPlan.reduce((a, p) => a + p.value, 0)]));
      }

      // ── Hoja: Reseñas ────────────────────────────────────────────────────
      if (shows(type, 'reviews') && reviews?.total) {
        const s = wb.addWorksheet('Reseñas');
        s.columns = [{ width: 14 }, { width: 14 }, { width: 14 }];
        styleHeaderRow(s.addRow(['Estrellas', 'Cantidad', '% del total']));
        [5, 4, 3, 2, 1].forEach((star) => {
          const c = reviews.distribution?.[star] || 0;
          const pct = reviews.total ? Math.round((c / reviews.total) * 100) : 0;
          s.addRow([`${star} ★`, c, `${pct}%`]);
        });
      }

      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), `${fileBase}.xlsx`);
      toast.success('Excel generado');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo generar el Excel');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content pb-10">
        <div className="admin-page-header mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Análisis y Reportes</h1>
            <p className="text-sm text-slate-500">Métricas reales del negocio</p>
          </div>
        </div>
        <SkeletonStats count={4} className="mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-[360px] w-full rounded-2xl" />
            <Skeleton className="h-[320px] w-full rounded-2xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-[320px] w-full rounded-2xl" />
            <Skeleton className="h-[260px] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const showFinanceCards = shows(type, 'finance');

  return (
    <div className="page-content pb-10">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="admin-page-header mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0040e0]/10 text-[#0040e0] flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">Análisis y Reportes</h1>
            <p className="text-sm text-slate-500">{TYPE_TITLE[type]} · {rangeLabel}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker from={from} to={to} onChange={onRangeChange} align="right" />
          <motion.button
            whileTap={refreshing ? undefined : tap}
            onClick={() => load(from, to, true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors disabled:opacity-60"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </motion.button>

          <div className="relative" ref={menuRef}>
            <motion.button
              whileTap={exporting ? undefined : tap}
              onClick={() => setMenuOpen((o) => !o)}
              disabled={exporting}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold text-white bg-[#0040e0] hover:bg-[#0030b0] transition-colors disabled:opacity-60 shadow-sm"
            >
              {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Descargar
            </motion.button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden z-50">
                <motion.button whileTap={tap} onClick={exportPDF} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <FileText size={16} className="text-rose-500" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">PDF premium</span>
                </motion.button>
                <motion.button whileTap={tap} onClick={exportExcel} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-t border-slate-100 dark:border-white/5">
                  <FileSpreadsheet size={16} className="text-emerald-500" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Excel (.xlsx)</span>
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Selector de tipo de reporte ─────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap gap-2">
        {REPORT_TYPES.map((t) => {
          const Icon = t.icon;
          const active = type === t.key;
          return (
            <motion.button
              key={t.key}
              whileTap={tap}
              onClick={() => setType(t.key)}
              className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold transition-colors border ${
                active
                  ? 'bg-[#0040e0] text-white border-[#0040e0] shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </motion.button>
          );
        })}
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      {showFinanceCards && finance && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<DollarSign size={18} />}
              title="Ingresos cobrados"
              value={<AnimatedNumber value={finance.revenue} format="gs" />}
              color="#10b981"
            />
            <StatCard
              icon={<Receipt size={18} />}
              title="Transacciones"
              value={<AnimatedNumber value={finance.transactions} format="int" />}
              color="#0040e0"
            />
            <StatCard
              icon={<CreditCard size={18} />}
              title="Ticket promedio"
              value={<AnimatedNumber value={finance.averageTicket} format="gs" />}
              color="#0ea5e9"
            />
            <StatCard
              icon={<Scale size={18} />}
              title="Resultado neto"
              value={<AnimatedNumber value={net} format="gs" />}
              color={net >= 0 ? '#10b981' : '#f43f5e'}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MiniStat
              label="Suscripciones"
              value={<AnimatedNumber value={finance.subscriptionRevenue} format="gs" />}
              icon={<Layers size={14} />}
            />
            <MiniStat
              label="Servicios"
              value={<AnimatedNumber value={finance.servicesRevenue} format="gs" />}
              icon={<Wrench size={14} />}
            />
            <MiniStat
              label="Egresos"
              value={<AnimatedNumber value={expenses?.total} format="gs" />}
              hint={`${expenses?.count || 0} registro(s)`}
              icon={<Banknote size={14} />}
            />
            <MiniStat
              label="Cobros pendientes"
              value={<AnimatedNumber value={finance.pendingTotal} format="gs" />}
              hint={`${finance.pendingCount || 0} transacc.`}
              icon={<ClipboardList size={14} />}
            />
          </div>
        </>
      )}

      {/* ── Membresías: KPI fila ─────────────────────────────────────────── */}
      {shows(type, 'members') && members && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<Users size={18} />} title="Miembros activos" value={<AnimatedNumber value={members.active} format="int" />} color="#0040e0" />
          <StatCard icon={<UserCheck size={18} />} title="Nuevos clientes (rango)" value={<AnimatedNumber value={members.newInRange} format="int" />} color="#10b981" />
          <StatCard icon={<ClipboardList size={18} />} title="Por vencer (30 días)" value={<AnimatedNumber value={members.expiringSoon} format="int" />} color="#f59e0b" />
        </div>
      )}

      {/* ── Servicios: KPI fila ──────────────────────────────────────────── */}
      {shows(type, 'appointments') && appointments && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<ClipboardList size={18} />} title="Citas totales" value={<AnimatedNumber value={appointments.total} format="int" />} color="#0040e0" />
          <StatCard icon={<Wrench size={18} />} title="Completadas" value={<AnimatedNumber value={appointments.completed} format="int" />} color="#10b981" />
          <StatCard icon={<Receipt size={18} />} title="Pendientes" value={<AnimatedNumber value={appointments.pending} format="int" />} color="#0ea5e9" />
          <StatCard icon={<ClipboardList size={18} />} title="Canceladas" value={<AnimatedNumber value={appointments.cancelled} format="int" />} color="#f43f5e" />
        </div>
      )}

      {/* ── Reseñas: KPI fila ────────────────────────────────────────────── */}
      {shows(type, 'reviews') && reviews && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<Star size={18} />} title="Calificación promedio" value={reviews.total ? `${reviews.average} / 5` : '—'} color="#f59e0b" />
          <StatCard icon={<MessageSquare size={18} />} title="Total de reseñas" value={<AnimatedNumber value={reviews.total} format="int" />} color="#0040e0" />
          <StatCard icon={<ClipboardList size={18} />} title="Sin responder" value={<AnimatedNumber value={reviews.pending} format="int" />} color="#0ea5e9" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Columna principal: charts ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ingresos vs egresos */}
          {shows(type, 'revenueSeries') && (
            <Card title="Ingresos y egresos por mes" subtitle="Pagos completados vs egresos del rango" icon={<TrendingUp size={16} />}>
              {revenueSeries.length === 0 || revenueSeries.every((d) => !d.revenue && !d.expenses) ? (
                <EmptyState icon="📈" title="Sin movimientos" message="Cuando haya ingresos o egresos en el rango aparecerán acá." />
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueSeries} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0040e0" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#0040e0" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={6} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={56} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 12, color: '#e2e8f0', fontSize: 13, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.4)' }}
                        cursor={{ stroke: 'rgba(148,163,184,0.3)' }}
                        formatter={(v, key) => [formatGs(v), key === 'expenses' ? 'Egresos' : 'Ingresos']}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#0040e0" strokeWidth={2.5} fill="url(#revGrad)" />
                      <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#expGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          )}

          {/* Volumen de servicios */}
          {shows(type, 'appointments') && (
            <Card
              title="Volumen de servicios"
              subtitle={appointments ? `${appointments.total} citas · ${appointments.completed} completadas` : ''}
              icon={<Wrench size={16} />}
            >
              {byService.length === 0 ? (
                <EmptyState icon="🧼" title="Sin citas registradas" message="Los servicios agendados aparecerán acá con su volumen real." />
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byService} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.15)" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={140} />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 12, color: '#e2e8f0', fontSize: 13 }}
                        cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                        formatter={(v, key) => [v, key === 'completed' ? 'Completadas' : 'Citas totales']}
                      />
                      <Bar dataKey="count" fill="#7da0ff" radius={[0, 6, 6, 0]} barSize={16} name="count" />
                      <Bar dataKey="completed" fill="#0040e0" radius={[0, 6, 6, 0]} barSize={16} name="completed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          )}

          {/* Egresos por categoría (financiero) */}
          {shows(type, 'expenses') && (
            <Card title="Egresos por categoría" subtitle={hasExpenses ? `${expenses.count} registro(s) · ${formatGs(expenses.total)}` : 'Sin egresos en el rango'} icon={<Banknote size={16} />}>
              {!byCategory.length ? (
                <EmptyState icon="🧾" title="Sin egresos" message="Los egresos cargados en el rango aparecerán acá por categoría." />
              ) : (
                <ul className="space-y-2.5">
                  {byCategory.map((c) => (
                    <li key={c.category} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300">
                        {c.category}
                        <span className="ml-2 text-xs text-slate-400">({c.count})</span>
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{formatGs(c.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        {/* ── Columna lateral ───────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Métodos de pago */}
          {shows(type, 'methods') && (
            <Card title="Métodos de pago" subtitle="Sobre pagos completados" icon={<CreditCard size={16} />}>
              {!byMethod.length ? (
                <EmptyState icon="💳" title="Sin pagos" message="El desglose por método de pago aparecerá acá." />
              ) : (
                <ul className="space-y-2.5">
                  {byMethod.map((m) => (
                    <li key={m.method} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300 capitalize">
                        {methodLabel(m.method)}
                        <span className="ml-2 text-xs text-slate-400">({m.count})</span>
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{formatGs(m.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* Miembros por plan */}
          {shows(type, 'members') && (
            <Card title="Miembros por plan" subtitle="Membresías activas" icon={<Users size={16} />}>
              {byPlan.length === 0 ? (
                <EmptyState icon="👥" title="Sin membresías activas" message="Las membresías activas se mostrarán acá." />
              ) : (
                <>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={byPlan} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
                          {byPlan.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 12, color: '#e2e8f0', fontSize: 13 }}
                          formatter={(v, n) => [`${v} miembro(s)`, n]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {byPlan.map((p, i) => (
                      <li key={p.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {p.name}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{p.value}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}

          {/* Calificaciones */}
          {shows(type, 'reviews') && (
            <Card title="Calificaciones" subtitle={reviews?.total ? `${reviews.total} reseñas · ${reviews.pending} sin responder` : 'Sin reseñas aún'} icon={<Star size={16} />}>
              {!reviews?.total ? (
                <EmptyState icon="⭐" title="Sin reseñas" message="Las reseñas de clientes aparecerán acá." />
              ) : (
                <div className="space-y-2.5">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews.distribution?.[star] || 0;
                    const pct = reviews.total ? Math.round((count / reviews.total) * 100) : 0;
                    return (
                      <div key={star} className="flex items-center gap-3 text-sm">
                        <span className="w-10 flex items-center gap-1 text-slate-500 tabular-nums">
                          {star} <Star size={12} className="fill-amber-400 text-amber-400" />
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-right tabular-nums text-slate-500">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta reutilizable ────────────────────────────────────────────────────
function Card({ title, subtitle, icon, children }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg bg-[#0040e0]/10 text-[#0040e0] flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Mini stat ───────────────────────────────────────────────────────────────
function MiniStat({ label, value, hint, icon }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <div className="text-base font-semibold text-slate-900 dark:text-white tabular-nums">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}
