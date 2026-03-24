import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScrollText, Search, User, Zap,
  Settings, CreditCard, LogIn, Plus,
  Edit, Trash2, Shield, Loader2,
  Calendar, FileText, ChevronLeft, ChevronRight,
  Database, Activity, MoreHorizontal, Terminal
} from 'lucide-react';
import api from '../../services/api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => { loadLogs(); }, [page, filterAction]);

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filterAction) params.set('action', filterAction);
      const res = await api.get(`/audit?${params}`);
      setLogs(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const actionConfig = {
    UPDATE_SETTINGS: { icon: <Settings size={14} />, color: 'bg-indigo-500', label: 'Ajustes' },
    SHOP_CHARGE: { icon: <CreditCard size={14} />, color: 'bg-emerald-500', label: 'Cobro' },
    LOGIN: { icon: <LogIn size={14} />, color: 'bg-blue-500', label: 'Acceso' },
    CREATE: { icon: <Plus size={14} />, color: 'bg-primary', label: 'Creación' },
    UPDATE: { icon: <Edit size={14} />, color: 'bg-amber-500', label: 'Edición' },
    DELETE: { icon: <Trash2 size={14} />, color: 'bg-rose-500', label: 'Borrado' },
  };

  if (loading && page === 1) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escaneando Registros Maestro...</p>
    </div>
  );

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
              <ScrollText size={24} />
            </div>
            Bitácora de Auditoría
          </h1>
          <p>Trazabilidad forense de operaciones administrativas</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="admin-search-wrapper w-full md:w-72">
            <Search className="admin-search-icon" size={16} />
            <input
              className="admin-search-input"
              placeholder="Buscar acción específica..."
              value={filterAction}
              onChange={e => { setFilterAction(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <LogStat icon={<Activity size={18} />} label="Total Eventos" value={pagination.totalItems || '0'} color="primary" />
        <LogStat icon={<Shield size={18} />} label="Nivel Seguridad" value="Óptimo" color="emerald" />
        <LogStat icon={<Database size={18} />} label="Retención" value="90 Días" color="indigo" />
      </div>

      {/* Table Section */}
      <div className="admin-card !p-0 overflow-hidden border-b-4 border-b-slate-900/5 dark:border-b-white/5">
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
              <AnimatePresence mode='popLayout'>
                {logs.map((log, i) => {
                  const config = actionConfig[log.action] || { icon: <FileText size={14} />, color: 'bg-slate-400', label: log.action };
                  return (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.01 }}
                      className="group"
                    >
                      <td>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black italic text-slate-900 dark:text-white uppercase tracking-tight">
                            {new Date(log.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 font-mono mt-0.5">
                            {new Date(log.createdAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all transform group-hover:rotate-6">
                            <User size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none mb-1 group-hover:translate-x-1 transition-transform">
                              {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System Kernel'}
                            </p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                              {log.user?.role || 'INFRASTRUCTURE'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg ${config.color} text-white flex items-center justify-center shrink-0 shadow-sm shadow-${config.color.split('-')[1]}-500/20`}>
                            {config.icon}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                            {config.label.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500">
                          {log.entity || 'CORE'}
                        </span>
                      </td>
                      <td>
                        <div className="max-w-[320px] truncate font-mono text-[9px] uppercase tracking-widest bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-white/5 text-slate-400 group-hover:text-primary transition-colors cursor-default flex items-center gap-2">
                          <Terminal size={10} className="shrink-0 opacity-40" />
                          {log.details ? JSON.stringify(log.details).substring(0, 80) : 'NO_PAYLOAD'}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Improved Pagination Footer */}
        <footer className="p-6 bg-slate-50/50 dark:bg-white/5 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Servidor Maestro <span className="text-primary italic">ASUNCION_CORE</span> // Página {page} de {pagination.totalPages || 1}
          </p>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[9px] font-black uppercase text-slate-400 hover:text-primary disabled:opacity-30 transition-all hover:border-primary/50"
            >
              <ChevronLeft size={16} /> ANTERIOR
            </button>
            <button
              disabled={page >= (pagination.totalPages || 1)}
              onClick={() => setPage(page + 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[9px] font-black uppercase text-slate-400 hover:text-primary disabled:opacity-30 transition-all hover:border-primary/50"
            >
              SIGUIENTE <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function LogStat({ icon, label, value, color }) {
  const colors = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    indigo: 'text-indigo-600 bg-indigo-600/10 border-indigo-600/20'
  };

  return (
    <div className="admin-card !p-5 flex items-center gap-5 border-b-2 group transition-all">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${colors[color]}`}>
        {icon}
      </div>
      <div className="flex-1">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">{label}</h4>
        <p className="text-xl font-black italic text-slate-900 dark:text-white uppercase leading-tight tracking-tight">{value}</p>
      </div>
      <MoreHorizontal className="text-slate-200" size={18} />
    </div>
  );
}
