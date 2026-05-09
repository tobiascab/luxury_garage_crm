import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Mail, Phone, Users,
  TrendingUp, UserPlus, CheckCircle2,
  ArrowRight, Search, Filter, Loader2,
  Share2, MessageSquare, ExternalLink,
  Zap, ArrowUpRight, ChevronRight,
  MoreVertical, RefreshCcw, LayoutDashboard,
  Database, UserCheck, Star, Sparkles
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function LeadsManager() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => { loadLeads(); }, []);

  const loadLeads = async () => {
    try {
      const r = await api.get('/referrals/all');
      setLeads(r.data.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Error al sincronizar prospectos');
    }
    setLoading(false);
  };

  const stats = {
    invited: leads.filter(l => l.status === 'INVITED'),
    registered: leads.filter(l => l.status === 'REGISTERED'),
    purchased: leads.filter(l => l.status === 'PURCHASED'),
    get conversion() {
      return leads.length > 0 ? ((this.purchased.length / leads.length) * 100).toFixed(0) : 0;
    }
  };

  const filtered = leads.filter(l => {
    const matchesTab = tab === 'all' || l.status === tab;
    const searchLower = search.toLowerCase();
    const matchesSearch =
      (l.referredEmail?.toLowerCase().includes(searchLower)) ||
      (l.referredPhone?.includes(searchLower)) ||
      (l.referrer?.firstName?.toLowerCase().includes(searchLower)) ||
      (l.referrer?.lastName?.toLowerCase().includes(searchLower));
    return matchesTab && matchesSearch;
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <Loader2 size={40} className="text-primary animate-spin" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escaneando Embudo de Conversión...</p>
        <p className="text-[8px] font-bold text-slate-500 italic mt-1 uppercase tracking-tighter">Sincronizando base de datos de captación</p>
      </div>
    </div>
  );

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Target size={24} />
            </div>
            Inteligencia de Captación
          </h1>
          <p>Supervisión estratégica del embudo de referidos y crecimiento orgánico</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); loadLeads(); }}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-primary transition-all"
            title="Sincronizar Leads"
          >
            <RefreshCcw size={16} />
          </button>
          <button className="admin-btn-primary" onClick={() => toast.success('Link de afiliado copiado al portapapeles')}>
            <Share2 size={16} /> Protocolo de Afiliación
          </button>
        </div>
      </header>

      {/* KPI Section - Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
          className="admin-card !p-8 border-b-4 border-b-slate-400/20 relative overflow-hidden group hover:border-b-slate-400 transition-all duration-500"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-slate-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700" />
          <div className="p-4 rounded-2xl bg-slate-500/10 text-slate-500 w-fit mb-6 shadow-inner relative z-10">
            <Mail size={24} />
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 leading-none relative z-10">Total Invitados</p>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black italic text-slate-900 dark:text-white uppercase tracking-tighter tabular-nums leading-none">
              {stats.invited.length}
            </span>
            <span className="text-[10px] font-bold text-slate-400 italic">UNIT</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
          className="admin-card !p-8 border-b-4 border-b-blue-500/20 relative overflow-hidden group hover:border-b-blue-500 transition-all duration-500"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700" />
          <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-500 w-fit mb-6 shadow-inner relative z-10">
            <UserPlus size={24} />
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500/60 mb-2 leading-none relative z-10">Tasa de Registro</p>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black italic text-blue-600 dark:text-blue-400 uppercase tracking-tighter tabular-nums leading-none">
              {stats.registered.length}
            </span>
            <span className="text-[10px] font-bold text-blue-400/60 italic">PENDING</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
          className="admin-card !p-8 border-b-4 border-b-emerald-500/20 relative overflow-hidden group hover:border-b-emerald-500 transition-all duration-500"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700" />
          <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 w-fit mb-6 shadow-inner relative z-10">
            <UserCheck size={24} />
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500/60 mb-2 leading-none relative z-10">Conversión Exitosa</p>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black italic text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter tabular-nums leading-none">
              {stats.purchased.length}
            </span>
            <span className="text-[10px] font-bold text-emerald-400/60 italic">ACTIVE</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
          className="admin-card !p-8 border-b-4 border-b-amber-500/20 relative overflow-hidden group hover:border-b-amber-500 transition-all duration-500"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700" />
          <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-500 w-fit mb-6 shadow-inner relative z-10">
            <TrendingUp size={24} />
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500/60 mb-2 leading-none relative z-10">Eficiencia de Embudo</p>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-4xl font-black italic text-amber-600 dark:text-amber-400 uppercase tracking-tighter tabular-nums leading-none">
              {stats.conversion}%
            </span>
            <span className="text-[10px] font-bold text-amber-400/60 italic">YIELD</span>
          </div>
        </motion.div>
      </div>

      {/* Filter & Advanced Search Implementation */}
      <div className="mb-10 flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="admin-search-wrapper">
            <Search className="admin-search-icon" size={18} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="BUSCAR PROSPECTO POR IDENTIFICADOR, EMAIL O REFERENTE..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 rounded-[1.25rem] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden whitespace-nowrap overflow-x-auto scrollbar-hide">
          {[
            { id: 'all', label: `Omni (${leads.length})` },
            { id: 'INVITED', label: `Stage: Invitado (${stats.invited.length})` },
            { id: 'REGISTERED', label: `Stage: Registro (${stats.registered.length})` },
            { id: 'PURCHASED', label: `Stage: Fidelizado (${stats.purchased.length})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${tab === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leads Table Redesign */}
      <div className="admin-card !p-0 overflow-hidden border-b-4 border-b-amber-500/20">
        {filtered.length === 0 ? (
          <div className="p-32 text-center flex flex-col items-center gap-6">
            <div className="w-24 h-24 rounded-[3rem] bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-slate-600 shadow-inner group-hover:scale-110 transition-transform duration-700">
              <Database size={48} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-[0.3em] text-slate-400 italic">Data Pipeline vacío</h3>
              <p className="text-[9px] font-bold text-slate-400/60 uppercase tracking-widest mt-2">Los registros de captación orgánica aparecerán aquí tras la indexación inicial de referidos.</p>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Identidad del Prospecto</th>
                  <th>Arquitectura de Referencia</th>
                  <th>Nivel de Embudo</th>
                  <th>Sincronización</th>
                  <th className="text-right pr-10">Optimización</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode='popLayout'>
                  {filtered.map((l, i) => (
                    <motion.tr
                      key={l.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="group"
                    >
                      <td>
                        <div className="flex flex-col">
                          <div className="font-black text-sm italic uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                            {l.referredEmail?.includes('@') ?
                              <div className="w-8 h-8 rounded-lg bg-indigo-50/50 dark:bg-white/5 flex items-center justify-center text-indigo-500"><Mail size={14} /></div> :
                              <div className="w-8 h-8 rounded-lg bg-emerald-50/50 dark:bg-white/5 flex items-center justify-center text-emerald-500"><Phone size={14} /></div>
                            }
                            {l.referredEmail || l.referredPhone || '— PROTOCOLO ANÓNIMO —'}
                          </div>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-11">Identificador Global: {l.id.toString().slice(-8).toUpperCase()}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                            <Users size={14} />
                          </div>
                          <div className="flex flex-col">
                            <p className="text-xs font-black uppercase italic tracking-tighter text-slate-700 dark:text-slate-300 leading-none mb-1">
                              {l.referrer ? `${l.referrer.firstName} ${l.referrer.lastName}` : 'AFILIACIÓN DIRECTA'}
                            </p>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Originador de Lead</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`admin-badge px-4 py-1.5 transition-all duration-500 group-hover:scale-105
                          ${l.status === 'PURCHASED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-black' :
                            l.status === 'REGISTERED' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 font-black' :
                              'bg-slate-500/10 text-slate-500 border-slate-500/20 font-black'
                          }`}
                        >
                          {l.status === 'PURCHASED' ? 'PROSPECTO FIDELIZADO' :
                            l.status === 'REGISTERED' ? 'USUARIO INDEXADO' :
                              'INVITACIÓN ENVIADA'}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <p className="text-xs font-black text-slate-700 dark:text-slate-200 tabular-nums">
                            {new Date(l.createdAt).toLocaleDateString()}
                          </p>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest italic">{new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} HRS</span>
                        </div>
                      </td>
                      <td className="text-right pr-8">
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-indigo-500/10 hover:border-indigo-500/20 border border-transparent flex items-center justify-center transition-all hover:scale-110 active:scale-90"
                            title="Comunicación directa"
                          >
                            <MessageSquare size={16} />
                          </button>
                          <button
                            className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-primary hover:bg-white dark:hover:bg-primary/10 hover:border-primary/20 border border-transparent flex items-center justify-center transition-all hover:scale-110 active:scale-90"
                            title="Despliegue de perfil"
                          >
                            <ExternalLink size={16} />
                          </button>
                        </div>
                        <div className="group-hover:hidden text-slate-400 dark:text-slate-600">
                          <MoreVertical size={18} className="ml-auto" />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Info Stats Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-8 py-4 bg-slate-900/90 dark:bg-white/90 backdrop-blur-xl rounded-full shadow-2xl border border-white/10 dark:border-black/5 flex items-center gap-10 whitespace-nowrap hidden lg:flex">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Pipeline en tiempo real</span>
        </div>
        <div className="h-4 w-[1px] bg-white/10 dark:bg-black/10" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-white dark:text-slate-900 uppercase">Conversion Focus:</span>
          <span className="text-xs font-black italic text-primary">{stats.conversion}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-white dark:text-slate-900 uppercase">Velocity:</span>
          <span className="text-xs font-black italic text-indigo-400">{(leads.length / 30).toFixed(1)} / day</span>
        </div>
      </div>
    </div>
  );
}
