import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Filter, Plus, UserPlus,
  MoreVertical, Shield, ShieldAlert, Mail,
  Phone, Calendar, ArrowRight, X, Trash2,
  CheckCircle2, AlertCircle, Loader2,
  Zap, RefreshCcw, LayoutDashboard,
  ShieldCheck, Crown, Star, Sparkles,
  ExternalLink, ChevronRight, UserCheck,
  Smartphone, Award, Database, Key
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function MembersManager() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selectedMember, setSelectedMember] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' });

  useEffect(() => { loadMembers(); }, [page, search, filterStatus]);

  const loadMembers = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      const res = await api.get(`/members?${params}`);
      setMembers(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (err) {
      console.error(err);
      toast.error('Error al sincronizar directorio de socios');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (member) => {
    const newStatus = !member.isActive;
    try {
      await api.put(`/members/${member.id}/status`, { isActive: newStatus });
      toast.success(newStatus ? 'Protocolo de acceso habilitado' : 'Suspensión táctica aplicada');
      loadMembers();
    } catch (err) {
      toast.error('Error en la actualización de estatus');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/members', { ...createForm, role: 'CLIENT' });
      toast.success('Nuevo perfil indexado con éxito');
      setShowCreate(false);
      setCreateForm({ email: '', password: '', firstName: '', lastName: '', phone: '' });
      loadMembers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Fallo en la creación del registro');
    }
  };

  if (loading && page === 1) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <Loader2 size={40} className="text-primary animate-spin" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escaneando Directorio de Socios...</p>
        <p className="text-[8px] font-bold text-slate-500 italic mt-1 uppercase tracking-tighter">Accediendo a la base de datos de membresías VIP</p>
      </div>
    </div>
  );

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/20">
              <Users size={28} />
            </div>
            Directorio de Socios
          </h1>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Control maestro de {pagination.total || 0} identidades indexadas en el ecosistema
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); loadMembers(); }}
            className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-primary transition-all shadow-sm"
            title="Sincronizar Datos"
          >
            <RefreshCcw size={18} />
          </button>
          <button className="admin-btn-primary" onClick={() => setShowCreate(true)}>
            <UserPlus size={18} /> Indexar Nuevo Socio
          </button>
        </div>
      </header>

      {/* Advanced Toolbar */}
      <div className="flex flex-col lg:flex-row gap-6 mb-12">
        <div className="flex-1">
          <div className="admin-search-wrapper">
            <Search className="admin-search-icon" size={18} />
            <input
              className="admin-search-input"
              placeholder="IDENTIFICAR SOCIO POR NOMBRE, EMAIL O TERMINAL MÓVIL..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select
            className="h-14 px-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary transition-all shadow-sm"
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          >
            <option value="">Omni: Todos los estados</option>
            <option value="active">Protocolo: Activo</option>
            <option value="suspended">Protocolo: Suspendido</option>
          </select>

          <button className="h-14 px-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-all shadow-sm flex items-center gap-2">
            <Filter size={16} /> Ingeniería de Filtros
          </button>
        </div>
      </div>

      {/* Main Members Database View */}
      <div className="admin-card !p-0 overflow-hidden border-b-4 border-b-primary/20 shadow-2xl shadow-slate-200/5">
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="pl-10">Identidad del Socio</th>
                <th>Canales de Contacto</th>
                <th>Estatus de Suscripción</th>
                <th>Estatus Operativo</th>
                <th>Sincronización</th>
                <th className="pr-10 text-right">Optimización</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode='popLayout'>
                {members.map((m, i) => (
                  <motion.tr
                    key={m.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.01 }}
                    className="group"
                  >
                    <td className="pl-10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-[1.25rem] bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 font-black text-xs shadow-xl transition-transform group-hover:scale-110 group-hover:rotate-3">
                          {m.firstName?.[0]}{m.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white group-hover:text-primary transition-colors">{m.firstName} {m.lastName}</p>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">UUID: {m.id.slice(-12).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1.5 flex flex-col">
                        <div className="text-[10px] font-bold text-slate-500 flex items-center gap-2 group-hover:text-indigo-500 transition-colors">
                          <Mail size={12} className="text-slate-300" /> {m.email}
                        </div>
                        {m.phone && (
                          <div className="text-[10px] font-bold text-slate-500 flex items-center gap-2 group-hover:text-emerald-500 transition-colors">
                            <Smartphone size={12} className="text-slate-300" /> {m.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {m.memberships?.[0]?.plan ? (
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 shadow-sm transition-all group-hover:bg-indigo-600 group-hover:text-white">
                          <Crown size={12} className="animate-pulse" />
                          <span className="text-[9px] font-black uppercase tracking-widest">{m.memberships[0].plan.name}</span>
                        </div>
                      ) : (
                        <span className="text-[9px] font-black uppercase text-slate-300 tracking-[0.2em]">Tier: No Asignado</span>
                      )}
                    </td>
                    <td>
                      <div className={`admin-badge px-4 py-1.5 border-none shadow-sm transition-all duration-500
                         ${m.isActive ? 'bg-emerald-500/10 text-emerald-600 font-black' : 'bg-rose-500/10 text-rose-600 font-black'}
                      `}>
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${m.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                          {m.isActive ? 'OPERATIVO' : 'SUSPENDIDO'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <p className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2 tabular-nums">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </p>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Fecha de Indexación</span>
                      </div>
                    </td>
                    <td className="pr-10">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                        <button
                          onClick={() => setSelectedMember(m)}
                          className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-primary hover:bg-white dark:hover:bg-primary/10 transition-all flex items-center justify-center border border-transparent hover:border-primary/20 shadow-sm"
                        >
                          <MoreVertical size={16} />
                        </button>
                        <button
                          onClick={() => toggleStatus(m)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border border-transparent shadow-sm ${m.isActive ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}
                        >
                          {m.isActive ? <ShieldAlert size={16} /> : <Shield size={16} />}
                        </button>
                      </div>
                      <div className="group-hover:hidden text-slate-300 dark:text-slate-700 text-right pr-2">
                        <ChevronRight size={20} />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Improved Pagination Design */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-8 py-10 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/5">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-all disabled:opacity-30 flex items-center gap-2"
            >
              <ArrowRight size={14} className="rotate-180" /> Pagina Anterior
            </button>
            <div className="flex items-center gap-2">
              {[...Array(pagination.totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all ${page === i + 1 ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'bg-white dark:bg-slate-800 text-slate-400 hover:border-primary border border-transparent'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              disabled={page === pagination.totalPages}
              onClick={() => setPage(page + 1)}
              className="px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-all disabled:opacity-30 flex items-center gap-2"
            >
              Proxima Pagina <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Member Detail Master View Modal */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/95 backdrop-blur-md"
              onClick={() => setSelectedMember(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-10 border-b border-slate-100 dark:border-white/5 flex items-center justify-between relative overflow-hidden">
                {/* Visual Background Accent */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />

                <div className="flex items-center gap-6 relative z-10">
                  <div className="w-20 h-20 rounded-[2.25rem] bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-2xl shadow-primary/30">
                    {selectedMember.firstName?.[0]}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white leading-none mb-2">
                      {selectedMember.firstName} {selectedMember.lastName}
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Socio Nivel {selectedMember.role}</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">ID: {selectedMember.id.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedMember(null)} className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-inner relative z-10">
                  <X size={24} />
                </button>
              </div>

              <div className="p-10 space-y-10 group/modal">
                <div className="grid grid-cols-2 gap-8">
                  <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-all hover:border-slate-200">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Terminal de Acceso</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white underline decoration-primary/20">{selectedMember.email}</p>
                  </div>
                  <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-all hover:border-slate-200">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Canal Telefónico</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white italic">{selectedMember.phone || 'DATOS NO SUMINISTRADOS'}</p>
                  </div>
                  <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-all hover:border-slate-200">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Fecha de Originación</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">
                      {new Date(selectedMember.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-all hover:border-slate-200">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Último Log de Actividad</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">
                      {selectedMember.lastLoginAt ? new Date(selectedMember.lastLoginAt).toLocaleDateString() : 'SIN ACTIVIDAD REGISTRADA'}
                    </p>
                  </div>
                </div>

                {selectedMember.memberships?.[0] ? (
                  <div className="p-8 rounded-[2.5rem] bg-indigo-600 text-white relative overflow-hidden shadow-2xl shadow-indigo-600/20 group/membership transition-transform hover:scale-[1.01]">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 rotate-12 transition-transform group-hover/membership:scale-125" />
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                            <Crown size={20} className="text-amber-300" />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Membresía Activa</p>
                        </div>
                        <h4 className="text-4xl font-black italic tracking-tighter uppercase leading-none">{selectedMember.memberships[0].plan?.name}</h4>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60">
                          <Calendar size={12} />
                          Expira: {new Date(selectedMember.memberships[0].endDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <div className="text-4xl font-black italic uppercase tracking-tighter">₲{(selectedMember.memberships[0].plan?.priceGs / 1000).toFixed(0)}K</div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 mt-1">Facturación de Nivel</p>
                        <div className="mt-8">
                          <button className="px-5 py-2.5 rounded-xl bg-white text-indigo-600 text-[10px] font-black uppercase tracking-widest shadow-lg transition-all hover:bg-slate-50 hover:scale-105 active:scale-95">Gestionar Plan</button>
                        </div>
                      </div>
                    </div>
                    <Database size={120} className="absolute -bottom-8 -right-8 opacity-5 rotate-12 transition-transform group-hover/membership:-rotate-12" />
                  </div>
                ) : (
                  <div className="p-12 rounded-[2.5rem] bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center text-center group/empty">
                    <AlertCircle size={40} className="text-slate-300 mb-6 group-hover/empty:scale-110 transition-transform" />
                    <h4 className="text-base font-black uppercase tracking-[0.2em] text-slate-400 italic">No se detecta Membresía activa</h4>
                    <p className="text-[10px] font-bold text-slate-400/60 uppercase tracking-widest mt-2 max-w-xs leading-relaxed">Este usuario no cuenta con un protocolo de suscripción vigente. Se recomienda indexar un plan de inmediato para habilitar privilegios.</p>
                    <button className="mt-8 h-14 px-10 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95">Vincular Plan de Socios</button>
                  </div>
                )}
              </div>

              <div className="p-10 bg-slate-50 dark:bg-slate-900/50 flex gap-4 border-t border-slate-100 dark:border-white/5">
                <button className="flex-1 h-16 rounded-[2rem] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2 group/del shadow-sm">
                  <Trash2 size={16} className="group-hover/del:scale-110 transition-transform" /> Purgar Registro de Socio
                </button>
                <button className="flex-[1.5] h-16 rounded-[2rem] bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:-translate-y-1 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-slate-900/20 active:scale-95">
                  Administrar Agenda y Servicios <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Member Creation Modal Redesign */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/95 backdrop-blur-md"
              onClick={() => setShowCreate(false)}
            />
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-10 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase italic text-slate-900 dark:text-white leading-none">Indexación de Perfil</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Creación de modelo de identidad de socio</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-inner"><X size={24} /></button>
              </div>
              <form onSubmit={handleCreate} className="p-10 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Nombre Oficial</label>
                    <div className="relative">
                      <UserCheck className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-16 pr-6 py-5 text-sm font-black italic uppercase text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all shadow-inner" required value={createForm.firstName} onChange={e => setCreateForm({ ...createForm, firstName: e.target.value })} placeholder="EX: LEONARDO..." />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Apellido</label>
                    <input className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-5 text-sm font-black italic uppercase text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all shadow-inner" required value={createForm.lastName} onChange={e => setCreateForm({ ...createForm, lastName: e.target.value })} placeholder="EX: DICAPRIO..." />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Terminal de Acceso (Email)</label>
                  <div className="relative">
                    <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all shadow-inner" type="email" required value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} placeholder="socio@luxurygarage.ar..." />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Clave Maestra Temporal</label>
                  <div className="relative">
                    <Key className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all shadow-inner" type="password" required value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} placeholder="••••••••••••" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Canal Telefónico (WhatsApp)</label>
                  <div className="relative">
                    <Smartphone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-all shadow-inner" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+595 9XX XXX XXX" />
                  </div>
                </div>
                <div className="pt-6 flex gap-4">
                  <button type="button" className="flex-1 h-16 rounded-[2rem] bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-200" onClick={() => setShowCreate(false)}>Anular Indexación</button>
                  <button type="submit" className="flex-1 h-16 rounded-[2rem] bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-indigo-600/20 transition-all hover:-translate-y-1 active:scale-95">Registrar Socio VIP</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
