import { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Search, Calendar, User, ScanLine, Car, Clock, RefreshCcw,
  Activity, CalendarCheck, Eye, X,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import EmptyState from '../../components/EmptyState';
import AnimatedNumber from '../../components/AnimatedNumber';
import StatusBadge from '../../components/StatusBadge';
import { SkeletonTable, SkeletonStats } from '../../components/Skeleton';
import useScrollLock from '../../hooks/useScrollLock';
import { DatePicker } from '../../components/DatePicker';

const dateFmt = (d) => new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' });
const timeFmt = (d) => new Date(d).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

export default function WashScans() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapIcon = reduceMotion ? undefined : { scale: 0.9 };

  const [scans, setScans] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [debounced, setDebounced] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState(null);

  // Bloquea el scroll del body mientras el modal de detalle esté abierto
  useScrollLock(!!detail);

  // Debounce de la búsqueda
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadStats = useCallback(() => {
    api.get('/scans/stats', { _noCache: true })
      .then((r) => setStats(r.data.data))
      .catch(() => {});
  }, []);

  const loadScans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/scans', {
        _noCache: true,
        params: {
          page,
          limit: 15,
          search: debounced.length > 1 ? debounced : undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });
      setScans(res.data.data || []);
      setTotalPages(res.data.pagination?.pages || 1);
      setTotal(res.data.pagination?.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cargar el historial de lavados');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, from, to]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadScans(); }, [loadScans]);

  const clearFilters = () => { setSearch(''); setFrom(''); setTo(''); setPage(1); };
  const hasFilters = !!(debounced || from || to);

  const statCards = [
    { label: 'Hoy', value: stats?.todayScans ?? 0, icon: CalendarCheck, tone: 'indigo' },
    { label: 'Este mes', value: stats?.monthScans ?? 0, icon: Calendar, tone: 'sky' },
    { label: 'En proceso', value: stats?.inProgress ?? 0, icon: Activity, tone: 'amber' },
    { label: 'Total registrados', value: stats?.totalScans ?? 0, icon: ScanLine, tone: 'emerald' },
  ];

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Historial de lavados</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Registro de los servicios atendidos por el equipo (lavados iniciados y completados).
        </p>
      </div>

      {/* Stats */}
      {!stats ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`relative overflow-hidden admin-tint-${s.tone} bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm`}>
                <span className={`admin-itile admin-itile-${s.tone} w-9 h-9`}>
                  <Icon size={18} className="text-white" />
                </span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-3 tabular-nums"><AnimatedNumber value={s.value} format="int" /></p>
                <p className="text-xs font-medium text-slate-400 mt-0.5">{s.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
        <div className="relative flex-1 lg:max-w-sm">
          <Search
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`}
            size={16}
          />
          <input
            type="text"
            placeholder="Buscar por cliente, placa, servicio o empleado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={`w-full h-10 pl-10 pr-4 rounded-xl bg-white dark:bg-slate-900 border text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 shadow-sm ${
              searchFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <DatePicker
            value={from} max={to || undefined}
            onChange={(v) => { setFrom(v); setPage(1); }}
            placeholder="Desde"
          />
          <span className="text-xs text-slate-400">a</span>
          <DatePicker
            value={to} min={from || undefined}
            onChange={(v) => { setTo(v); setPage(1); }}
            placeholder="Hasta"
          />
        </div>

        {hasFilters && (
          <motion.button whileTap={tap} onClick={clearFilters} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            Limpiar
          </motion.button>
        )}

        <motion.button
          whileTap={tapIcon}
          onClick={() => { loadScans(); loadStats(); }}
          className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors shadow-sm lg:ml-auto"
          aria-label="Recargar"
        >
          <RefreshCcw size={16} />
        </motion.button>
      </div>

      {/* Tabla */}
      {loading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : scans.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl py-4">
          <EmptyState
            icon="🚿"
            title={hasFilters ? 'Sin resultados' : 'Sin lavados registrados'}
            message={hasFilters ? 'Probá con otros filtros o limpiá la búsqueda.' : 'Acá aparecerán los servicios a medida que el equipo los atienda.'}
            action={hasFilters ? 'Limpiar filtros' : undefined}
            onAction={hasFilters ? clearFilters : undefined}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
          {/* Header tabla */}
          <div className="hidden md:grid grid-cols-[150px_1.4fr_1.2fr_1.2fr_120px_70px] gap-4 px-5 py-3.5 bg-slate-50/60 dark:bg-white/[0.02] text-xs font-medium text-slate-400 uppercase tracking-wide">
            <span>Fecha / Hora</span>
            <span>Cliente</span>
            <span>Vehículo</span>
            <span>Empleado</span>
            <span>Estado</span>
            <span className="text-right">Detalle</span>
          </div>

          {scans.map((scan) => {
            const emp = scan.serviceRecord?.employee;
            return (
              <div
                key={scan.id}
                className="grid grid-cols-1 md:grid-cols-[150px_1.4fr_1.2fr_1.2fr_120px_70px] gap-2 md:gap-4 px-5 py-4 border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors items-center"
              >
                {/* Fecha / hora */}
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{dateFmt(scan.date || scan.createdAt)}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <Clock size={11} /> {timeFmt(scan.startTime || scan.createdAt)}
                  </span>
                </div>

                {/* Cliente */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                    {(scan.user?.firstName?.[0] || '?')}{(scan.user?.lastName?.[0] || '')}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{scan.user?.firstName} {scan.user?.lastName}</p>
                    <p className="text-xs text-slate-400 truncate">{scan.service?.name || scan.user?.email || '—'}</p>
                  </div>
                </div>

                {/* Vehículo */}
                <div className="min-w-0">
                  {scan.vehicle ? (
                    <div className="flex items-center gap-2">
                      <Car size={14} className="text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{scan.vehicle.brand} {scan.vehicle.model}</p>
                        {scan.vehicle.licensePlate && <p className="text-xs text-slate-400">{scan.vehicle.licensePlate}</p>}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>

                {/* Empleado */}
                <div className="min-w-0">
                  {emp ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                      <User size={13} className="text-slate-400 shrink-0" /> <span className="truncate">{emp.firstName} {emp.lastName}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Sin registrar</span>
                  )}
                </div>

                {/* Estado */}
                <div><StatusBadge status={scan.status} /></div>

                {/* Detalle */}
                <div className="flex md:justify-end">
                  <motion.button whileTap={tapIcon} onClick={() => setDetail(scan)} title="Ver detalle"
                    className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-colors">
                    <Eye size={15} />
                  </motion.button>
                </div>
              </div>
            );
          })}

          {/* Paginación */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02]">
            <p className="text-xs text-slate-400">{total} registro{total === 1 ? '' : 's'}</p>
            <div className="flex items-center gap-3">
              <motion.button
                whileTap={page <= 1 ? undefined : tap}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </motion.button>
              <span className="text-xs text-slate-400 tabular-nums">Página {page} de {totalPages}</span>
              <motion.button
                whileTap={page >= totalPages ? undefined : tap}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {/* Detalle del lavado */}
      <ScanDetailModal scan={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

// ── Modal de detalle (solo lectura) ──────────────────────────────────────────
function ScanDetailModal({ scan, onClose }) {
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (scan) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [scan, onClose]);

  if (!scan) return null;
  const rec = scan.serviceRecord;
  const emp = rec?.employee;

  const Row = ({ label, value }) => (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-50 dark:border-white/5 last:border-0">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="text-sm text-slate-700 dark:text-slate-200 text-right">{value || '—'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <span className="admin-itile admin-itile-sky w-9 h-9">
              <ScanLine size={18} className="text-white" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Detalle del lavado</h3>
              <p className="text-xs text-slate-400">{dateFmt(scan.date || scan.createdAt)} · {timeFmt(scan.startTime || scan.createdAt)}</p>
            </div>
          </div>
          <motion.button whileTap={reduceMotion ? undefined : { scale: 0.9 }} onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors">
            <X size={18} />
          </motion.button>
        </div>

        <div className="px-6 py-5 overflow-y-auto overscroll-contain">
          <div className="mb-4"><StatusBadge status={scan.status} /></div>
          <Row label="Cliente" value={`${scan.user?.firstName || ''} ${scan.user?.lastName || ''}`.trim()} />
          <Row label="Teléfono" value={scan.user?.phone} />
          <Row label="Servicio" value={scan.service?.name} />
          <Row label="Vehículo" value={scan.vehicle ? `${scan.vehicle.brand} ${scan.vehicle.model}` : null} />
          <Row label="Placa" value={scan.vehicle?.licensePlate} />
          <Row label="Empleado" value={emp ? `${emp.firstName} ${emp.lastName}` : null} />
          <Row label="Inició" value={rec?.startedAt ? `${dateFmt(rec.startedAt)} ${timeFmt(rec.startedAt)}` : null} />
          <Row label="Completó" value={rec?.completedAt ? `${dateFmt(rec.completedAt)} ${timeFmt(rec.completedAt)}` : null} />
          <Row label="Duración" value={rec?.durationMinutes ? `${rec.durationMinutes} min` : null} />
          {rec?.vehicleObservations && (
            <div className="mt-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-4 py-3">
              <p className="text-xs font-medium text-slate-400 mb-1">Observaciones del vehículo</p>
              <p className="text-sm text-slate-700 dark:text-slate-200">{rec.vehicleObservations}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
