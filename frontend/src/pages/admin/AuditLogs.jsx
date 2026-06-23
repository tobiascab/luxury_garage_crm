import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ScrollText, Search, User, Settings, CreditCard, LogIn,
  Plus, Edit, Trash2, Loader2, Calendar, FileText,
  ChevronLeft, ChevronRight, Database, Activity, Terminal,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import EmptyState from '../../components/EmptyState';
import AnimatedNumber from '../../components/AnimatedNumber';

export default function AuditLogs() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [filterAction, setFilterAction] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => { loadLogs(); }, [page, filterAction]);
  useEffect(() => { loadStats(); }, []);

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filterAction) params.set('action', filterAction);
      const res = await api.get(`/audit?${params}`);
      setLogs(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudieron cargar los registros');
    }
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      const res = await api.get('/audit/stats');
      setStats(res.data.data || null);
    } catch {
      // las tarjetas muestran 0 si no hay datos
    }
  };

  const actionConfig = {
    UPDATE_SETTINGS: { icon: <Settings size={14} />, color: 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400', label: 'Ajustes' },
    SHOP_CHARGE: { icon: <CreditCard size={14} />, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Cobro' },
    LOGIN: { icon: <LogIn size={14} />, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', label: 'Acceso' },
    CREATE: { icon: <Plus size={14} />, color: 'bg-[#0040e0]/10 text-[#0040e0]', label: 'Creación' },
    UPDATE: { icon: <Edit size={14} />, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Edición' },
    DELETE: { icon: <Trash2 size={14} />, color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', label: 'Borrado' },
  };

  if (loading && page === 1) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={36} className="text-[#0040e0] animate-spin" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cargando registros…</p>
    </div>
  );

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-[#0040e0]/10 text-[#0040e0] flex items-center justify-center">
              <ScrollText size={20} />
            </span>
            Bitácora de Auditoría
          </h1>
          <p>Trazabilidad de operaciones administrativas</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="admin-search-wrapper w-full md:w-72">
            <Search className={`admin-search-icon transition-colors duration-200 ${searchFocused ? '!text-[#0040e0]' : ''}`} size={16} />
            <input
              className="admin-search-input"
              placeholder="Buscar por acción…"
              value={filterAction}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onChange={e => { setFilterAction(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </header>

      {/* Stats Summary — datos reales de /audit/stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        <LogStat icon={<Activity size={20} />} label="Total Eventos" value={<AnimatedNumber value={stats?.total ?? pagination.total} format="int" />} color="primary" />
        <LogStat icon={<Calendar size={20} />} label="Hoy" value={<AnimatedNumber value={stats?.today} format="int" />} color="emerald" />
        <LogStat icon={<Database size={20} />} label="Este Mes" value={<AnimatedNumber value={stats?.thisMonth} format="int" />} color="indigo" />
        <LogStat icon={<User size={20} />} label="Responsables" value={<AnimatedNumber value={stats?.actors} format="int" />} color="primary" />
      </div>

      {/* Table Section */}
      {logs.length === 0 ? (
        <EmptyState
          icon="📋"
          title={filterAction ? 'Sin resultados' : 'No hay registros'}
          message={filterAction ? 'Probá con otra acción.' : 'Aún no se registraron operaciones en la bitácora.'}
        />
      ) : (
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="w-40">Marca Temporal</th>
                <th>Responsable</th>
                <th className="w-48">Operación</th>
                <th className="w-32">Entidad</th>
                <th>Evidencia Técnica</th>
              </tr>
            </thead>
            <tbody>
                {logs.map((log) => {
                  const config = actionConfig[log.action] || { icon: <FileText size={14} />, color: 'bg-slate-500/10 text-slate-500', label: log.action };
                  return (
                    <tr
                      key={log.id}
                      className="group"
                    >
                      <td>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {new Date(log.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })}
                          </span>
                          <span className="text-xs text-slate-400 font-mono mt-0.5">
                            {new Date(log.createdAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                            <User size={14} />
                          </span>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">
                              {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Sistema'}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {log.user?.role || 'Sistema'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${config.color}`}>
                          {config.icon}
                          {config.label.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                          {log.entity || '—'}
                        </span>
                      </td>
                      <td>
                        <div className="max-w-[320px] truncate font-mono text-xs bg-slate-50 dark:bg-slate-900/40 px-2.5 py-1.5 rounded-md border border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <Terminal size={12} className="shrink-0 opacity-50" />
                          {log.detailsJson ? JSON.stringify(log.detailsJson).substring(0, 80) : '—'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {/* Pagination Footer */}
          <footer className="p-4 bg-slate-50 dark:bg-white/5 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Página {page} de {pagination.totalPages || 1}
            </p>

            <div className="flex items-center gap-2">
              <motion.button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                whileTap={page <= 1 ? undefined : tap}
                className="admin-btn-outline admin-btn-sm"
              >
                <ChevronLeft size={16} /> Anterior
              </motion.button>
              <motion.button
                disabled={page >= (pagination.totalPages || 1)}
                onClick={() => setPage(page + 1)}
                whileTap={page >= (pagination.totalPages || 1) ? undefined : tap}
                className="admin-btn-outline admin-btn-sm"
              >
                Siguiente <ChevronRight size={16} />
              </motion.button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}

function LogStat({ icon, label, value, color }) {
  const colors = {
    primary: 'text-[#0040e0] bg-[#0040e0]/10',
    emerald: 'text-emerald-500 bg-emerald-500/10',
    indigo: 'text-indigo-500 bg-indigo-500/10',
  };

  return (
    <div className="kpi-card flex items-center gap-4">
      <div className={`kpi-icon !mb-0 ${colors[color]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{label}</h4>
        <p className="text-2xl font-semibold text-slate-900 dark:text-white leading-none">{value}</p>
      </div>
    </div>
  );
}
