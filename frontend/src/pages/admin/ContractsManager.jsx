import { useState, useEffect, useCallback } from 'react';
import {
  FileSignature, Search, Download, Printer, Eye, X, ShieldCheck, AlertTriangle,
  Loader2, Settings2, RotateCcw, Save, FileText, Calendar, CreditCard, User,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { descargarContratoPdf, imprimirContratoPdf } from '../../lib/contratoPdf';

/**
 * Contratos — las autorizaciones de débito que firmaron los clientes.
 *
 * Dos solapas:
 *   • Firmados: el listado, con buscador. De cada uno se ve el documento exacto que la
 *     persona aceptó y se puede descargar o imprimir para hacerlo firmar a mano.
 *   • Condiciones: el texto que van a aceptar los próximos clientes, con previsualización.
 *     Editarlo NO altera los contratos ya firmados.
 */

const fmtGs = (n) => `₲ ${Number(n || 0).toLocaleString('es-PY')}`;
const fmtFecha = (d) => {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('es-PY', {
      timeZone: 'America/Asuncion', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(d));
  } catch { return '—'; }
};

export default function ContractsManager() {
  const [tab, setTab] = useState('firmados');

  return (
    // page-content = el contenedor estándar del panel (ancho máximo y respiración laterales).
    <div className="page-content space-y-8 pb-16">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <FileSignature size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Contratos</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Autorizaciones de débito automático firmadas por los clientes
            </p>
          </div>
        </div>
        <div className="flex rounded-xl bg-slate-100 dark:bg-white/5 p-1 shrink-0 self-start md:self-auto">
          {[['firmados', 'Firmados'], ['condiciones', 'Condiciones']].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === k
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'firmados' ? <Firmados /> : <Condiciones />}
    </div>
  );
}

/* ══════════════════════════════ FIRMADOS ══════════════════════════════ */

function Firmados() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (estado) qs.set('estado', estado);
      const [lista, st] = await Promise.all([
        api.get(`/contracts?${qs}`, { _noCache: true }),
        api.get('/contracts/stats', { _noCache: true }).catch(() => null),
      ]);
      setRows(lista.data?.data || []);
      if (st) setStats(st.data?.data || null);
    } catch {
      toast.error('No se pudieron cargar los contratos');
    } finally {
      setLoading(false);
    }
  }, [search, estado]);

  useEffect(() => {
    const t = setTimeout(cargar, search ? 350 : 0); // debounce del buscador
    return () => clearTimeout(t);
  }, [cargar, search]);

  const abrir = async (id) => {
    setCargandoDetalle(true);
    try {
      const r = await api.get(`/contracts/${id}`, { _noCache: true });
      setDetalle(r.data?.data || null);
    } catch {
      toast.error('No se pudo abrir el contrato');
    } finally {
      setCargandoDetalle(false);
    }
  };

  return (
    <div className="space-y-6">
      {stats?.faltanDatosComercio?.length > 0 && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-5 flex items-start gap-3.5">
          <AlertTriangle size={19} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            {/* Se nombra EXACTAMENTE lo que falta: un aviso genérico da a entender que no hay
                ningún dato cargado, cuando la razón social y el RUC ya están. */}
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {stats.faltanDatosComercio.length === 1
                ? `Falta cargar: ${stats.faltanDatosComercio[0].toLowerCase()}`
                : `Faltan cargar: ${stats.faltanDatosComercio.join(', ').toLowerCase()}`}
            </p>
            <p className="text-[13px] text-amber-800/90 dark:text-amber-300/80 mt-1.5 leading-relaxed">
              {!stats.faltanDatosComercio.some((d) => /raz[oó]n|ruc/i.test(d))
                ? <>La razón social y el RUC ya están cargados; con esto el contrato queda completo. </>
                : <>Sin estos datos el documento sale incompleto y pierde respaldo. </>}
              Se completa en <strong>Ajustes › Datos del negocio</strong>.
            </p>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Tarjeta label="Firmados" valor={stats.total} icono={<FileSignature size={13} />} />
          <Tarjeta label="Vigentes" valor={stats.vigentes} tono="ok" icono={<ShieldCheck size={13} />} />
          <Tarjeta label="Cancelados" valor={stats.cancelados} tono="off" icono={<X size={13} />} />
          <Tarjeta label="Comprometido por mes" valor={fmtGs(stats.comprometido_mensual)} icono={<CreditCard size={13} />} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, documento, correo o N° de contrato"
            className="w-full h-12 pl-11 pr-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 outline-none transition-all"
          />
        </div>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="h-12 px-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white outline-none cursor-pointer sm:min-w-[150px]"
        >
          <option value="">Todos</option>
          <option value="VIGENTE">Vigentes</option>
          <option value="CANCELADO">Cancelados</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 py-16 text-center">
          <FileSignature size={30} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {search || estado ? 'Sin resultados' : 'Todavía no hay contratos'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {search || estado ? 'Probá con otra búsqueda' : 'Se generan solos cuando un cliente activa su membresía'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <div
              key={c.id}
              className="group rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded">
                      {c.numero}
                    </span>
                    <Estado valor={c.estado} />
                  </div>
                  <p className="font-semibold text-slate-900 dark:text-white mt-1.5 truncate">
                    {c.cliente_snapshot?.nombre || c.user_email}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {c.plan_nombre} · {fmtGs(c.monto_gs)}/{c.periodicidad === 'mensual' ? 'mes' : c.periodicidad}
                    {c.tarjeta_ultimos4 ? ` · ${c.tarjeta_marca || 'Tarjeta'} ••••${c.tarjeta_ultimos4}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Aceptado {fmtFecha(c.aceptado_en)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Accion icono={<Eye size={16} />} titulo="Ver documento" onClick={() => abrir(c.id)} />
                  <Accion icono={<Download size={16} />} titulo="Descargar PDF" onClick={async () => {
                    const r = await api.get(`/contracts/${c.id}`, { _noCache: true });
                    descargarContratoPdf(r.data.data);
                  }} />
                  <Accion icono={<Printer size={16} />} titulo="Imprimir para firmar" onClick={async () => {
                    const r = await api.get(`/contracts/${c.id}`, { _noCache: true });
                    if (!imprimirContratoPdf(r.data.data)) toast.error('El navegador bloqueó la ventana de impresión');
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(detalle || cargandoDetalle) && (
        <ModalDocumento
          contrato={detalle}
          cargando={cargandoDetalle}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  );
}

function Tarjeta({ label, valor, tono, icono }) {
  const color = tono === 'ok' ? 'text-emerald-600 dark:text-emerald-400'
    : tono === 'off' ? 'text-slate-400 dark:text-slate-500'
      : 'text-slate-900 dark:text-white';
  return (
    <div className="rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 flex flex-col justify-between min-h-[112px]">
      <div className="flex items-center gap-2 text-slate-400">
        {icono}
        <p className="text-[11px] font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-[26px] leading-none font-bold tabular-nums mt-3 ${color}`}>{valor}</p>
    </div>
  );
}

function Estado({ valor }) {
  const vigente = valor === 'VIGENTE';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${vigente
      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>
      {vigente ? <ShieldCheck size={10} /> : <X size={10} />} {vigente ? 'Vigente' : 'Cancelado'}
    </span>
  );
}

function Accion({ icono, titulo, onClick }) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
    >
      {icono}
    </button>
  );
}

function ModalDocumento({ contrato, cargando, onClose }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-2xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {cargando || !contrato ? (
          <div className="py-20 flex justify-center"><Loader2 size={26} className="animate-spin text-indigo-500" /></div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">{contrato.numero}</p>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate">
                  {contrato.cliente_snapshot?.nombre || contrato.user_email}
                </h3>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <Dato icono={<User size={12} />} label="Documento" valor={contrato.cliente_snapshot?.documento || '—'} />
              <Dato icono={<FileText size={12} />} label="Plan" valor={contrato.plan_nombre} />
              <Dato icono={<CreditCard size={12} />} label="Importe" valor={`${fmtGs(contrato.monto_gs)}/mes`} />
              <Dato icono={<Calendar size={12} />} label="Aceptado" valor={fmtFecha(contrato.aceptado_en)} />
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-5">
              <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                {contrato.texto_completo}
              </pre>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p>Constancia de aceptación · versión {contrato.texto_version}</p>
                {contrato.aceptado_ip && <p>Origen: {contrato.aceptado_ip}</p>}
                {contrato.aceptado_user_agent && <p className="truncate">Dispositivo: {contrato.aceptado_user_agent}</p>}
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => descargarContratoPdf(contrato)}
                className="flex-1 h-11 rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
              >
                <Download size={16} /> Descargar PDF
              </button>
              <button
                onClick={() => { if (!imprimirContratoPdf(contrato)) toast.error('El navegador bloqueó la ventana'); }}
                className="flex-1 h-11 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                <Printer size={16} /> Imprimir para firmar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Dato({ icono, label, valor }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">{icono} {label}</p>
      <p className="text-xs font-semibold text-slate-900 dark:text-white mt-1 truncate">{valor}</p>
    </div>
  );
}

/* ══════════════════════════════ CONDICIONES ══════════════════════════════ */

function Condiciones() {
  const [cfg, setCfg] = useState(null);
  const [plantilla, setPlantilla] = useState('');
  const [titulo, setTitulo] = useState('');
  const [resumen, setResumen] = useState('');
  const [version, setVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [preview, setPreview] = useState('');
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [verPreview, setVerPreview] = useState(false);

  useEffect(() => {
    api.get('/contracts/config/mandate', { _noCache: true })
      .then((r) => {
        const d = r.data.data;
        setCfg(d); setPlantilla(d.plantilla); setTitulo(d.titulo);
        setResumen(d.resumen); setVersion(d.version);
      })
      .catch(() => toast.error('No se pudieron cargar las condiciones'))
      .finally(() => setLoading(false));
  }, []);

  const previsualizar = async () => {
    setCargandoPreview(true);
    setVerPreview(true);
    try {
      const r = await api.post('/contracts/config/preview', { plantilla });
      setPreview(r.data.data.texto);
    } catch {
      toast.error('No se pudo generar la vista previa');
      setVerPreview(false);
    } finally {
      setCargandoPreview(false);
    }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await api.put('/contracts/config/mandate', { plantilla, titulo, resumen, version });
      toast.success(r.data?.message || 'Condiciones actualizadas');
      api.invalidate('/contracts');
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const restaurar = () => {
    if (!cfg?.plantillaPorDefecto) return;
    setPlantilla(cfg.plantillaPorDefecto);
    toast('Texto original restaurado. Revisalo y guardá si estás de acuerdo.', { icon: '↩️' });
  };

  if (loading) return <div className="h-96 rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse" />;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5">
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Este es el texto que el cliente lee y acepta antes del primer cobro. Los contratos
          <strong> ya firmados no cambian</strong>: cada uno guarda su propia copia de lo que esa persona aceptó.
        </p>
      </div>

      {cfg?.faltanDatosComercio?.length > 0 && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
            Falta cargar <strong>{cfg.faltanDatosComercio.join(', ').toLowerCase()}</strong> en
            Ajustes › Datos del negocio. Sin eso el documento sale incompleto.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Campo label="Título" value={titulo} onChange={setTitulo} placeholder="Autorización de débito automático" />
        <Campo label="Resumen (lo que ve el cliente antes de abrir)" value={resumen} onChange={setResumen} />
        <Campo label="Versión" value={version} onChange={setVersion} placeholder="1.0"
          hint="Subila cuando cambies el texto: queda registrada en cada contrato" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Texto del documento</label>
          <span className="text-xs text-slate-400">{plantilla.length} caracteres</span>
        </div>
        <textarea
          value={plantilla}
          onChange={(e) => setPlantilla(e.target.value)}
          spellCheck={false}
          className="w-full h-[420px] rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 font-mono text-[12.5px] leading-relaxed text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 resize-y"
        />
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Datos que se completan solos</p>
        <div className="flex flex-wrap gap-1.5">
          {(cfg?.variables || []).map((v) => (
            <button
              key={v.clave}
              onClick={() => { navigator.clipboard?.writeText(`{{${v.clave}}}`); toast.success(`{{${v.clave}}} copiado`); }}
              title={`${v.descripcion} — clic para copiar`}
              className="font-mono text-[11px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {`{{${v.clave}}}`}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Tocá una para copiarla. Se reemplazan por los datos reales de cada cliente al firmar.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={previsualizar}
          className="flex-1 h-12 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
        >
          <Eye size={16} /> Previsualizar documento
        </button>
        <button
          onClick={restaurar}
          className="h-12 px-4 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          title="Volver al texto original del sistema"
        >
          <RotateCcw size={16} /> Restaurar original
        </button>
        <button
          onClick={guardar}
          disabled={guardando || plantilla.trim().length < 100}
          className="flex-1 h-12 rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar condiciones
        </button>
      </div>

      {verPreview && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setVerPreview(false)} />
          <div className="relative z-10 w-full sm:max-w-2xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Vista previa</h3>
                <p className="text-xs text-slate-400">Con datos de ejemplo. Así lo va a ver el cliente.</p>
              </div>
              <button onClick={() => setVerPreview(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-5">
              {cargandoPreview ? (
                <div className="py-16 flex justify-center"><Loader2 size={24} className="animate-spin text-indigo-500" /></div>
              ) : (
                <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                  {preview}
                </pre>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => descargarContratoPdf({
                  numero: `LG-${new Date().getFullYear()}-0001`,
                  plan_nombre: 'Plan de ejemplo', monto_gs: 0, periodicidad: 'mensual',
                  texto_completo: preview, texto_version: version,
                  cliente_snapshot: { nombre: 'Nombre del Cliente', documento: '1.234.567' },
                  comercio_snapshot: cfg?.comercio || {}, aceptado_en: new Date().toISOString(),
                })}
                className="w-full h-11 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                <Download size={16} /> Ver cómo queda el PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, hint }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 px-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all"
      />
      {hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
    </div>
  );
}
