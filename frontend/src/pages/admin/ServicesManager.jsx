import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, Plus, Edit, Trash2,
  Clock, Banknote, Tag, CheckCircle2,
  XCircle, Search, Filter, Layers,
  Zap, Droplets, Shield, Sparkles,
  ChevronRight, ArrowRight, RefreshCcw,
  Loader2, MoreVertical, LayoutGrid, List as ListIcon,
  Info, LayoutDashboard, Database, Star
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function ServicesManager() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [form, setForm] = useState({
    name: '', description: '', category: 'STANDARD',
    durationMinutes: 30, basePriceGs: 0, isAddon: false, isActive: true
  });

  useEffect(() => { loadServices(); }, []);

  const loadServices = async () => {
    try {
      const res = await api.get('/services');
      setServices(res.data.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/services/${editing.id}`, form);
        toast.success('Ingeniería de servicio optimizada');
      } else {
        await api.post('/services', form);
        toast.success('Nuevo protocolo indexado');
      }
      setShowModal(false);
      setEditing(null);
      loadServices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error en la sincronización técnica');
    }
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name, description: s.description || '',
      category: s.category || 'STANDARD', durationMinutes: s.durationMinutes,
      basePriceGs: s.basePriceGs || 0, isAddon: s.isAddon, isActive: s.isActive
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Retirar este protocolo del despliegue operativo?')) return;
    try {
      await api.delete(`/services/${id}`);
      toast.success('Protocolo desestimado');
      loadServices();
    } catch (e) {
      toast.error('Error al desestimar');
    }
  };

  const filteredServices = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category?.toLowerCase().includes(search.toLowerCase())
  );

  const categories = {
    STANDARD: { label: 'Estándar', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', icon: <Droplets size={16} /> },
    PREMIUM: { label: 'Premium', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', icon: <Sparkles size={16} /> },
    VIP: { label: 'VIP', color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', icon: <Star size={16} /> },
    ADDON: { label: 'Adicional', color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20', icon: <Zap size={16} /> }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escaneando Estructura de Servicios...</p>
        <p className="text-[8px] font-bold text-slate-500 italic mt-1 uppercase tracking-tighter">Sincronizando catálogo con base de datos maestra</p>
      </div>
    </div>
  );

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <LayoutDashboard size={24} />
            </div>
            Arquitectura de Servicios
          </h1>
          <p>Coordina y optimiza el despliegue técnico de Luxury Garage</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-white/10">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-white/10 text-primary' : 'text-slate-400'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100 dark:bg-white/10 text-primary' : 'text-slate-400'}`}
            >
              <ListIcon size={16} />
            </button>
          </div>
          <button
            onClick={() => { setLoading(true); loadServices(); }}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-primary transition-all"
            title="Sincronizar Catálogo"
          >
            <RefreshCcw size={16} />
          </button>
          <button
            className="admin-btn-primary"
            onClick={() => {
              setEditing(null);
              setForm({ name: '', description: '', category: 'STANDARD', durationMinutes: 30, basePriceGs: 0, isAddon: false, isActive: true });
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Indexar Servicio
          </button>
        </div>
      </header>

      {/* Filter & Search Bar */}
      <div className="mb-10 flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="admin-search-wrapper">
            <Search className="admin-search-icon" size={18} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="BUSCAR PROTOCOLO POR NOMBRE O IDENTIFICADOR..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 scrollbar-hide overflow-x-auto">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap hidden sm:inline">Filtrar Segmento:</span>
          {['TODOS', 'STANDARD', 'PREMIUM', 'VIP', 'ADDON'].map(c => (
            <button
              key={c}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${search.toUpperCase() === c ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-500'}`}
              onClick={() => setSearch(c === 'TODOS' ? '' : c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid View Implementation */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode='popLayout'>
            {filteredServices.map((s, i) => {
              const cat = categories[s.category] || categories.STANDARD;
              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={`admin-card !p-0 group relative overflow-hidden flex flex-col border-b-8 transition-all duration-500 hover:translate-y-[-8px] ${!s.isActive ? 'border-b-rose-500 brightness-75 opacity-60' : 'border-b-indigo-500/20 hover:border-b-indigo-500'}`}
                >
                  {/* Category Banner */}
                  <div className={`h-24 relative p-8 flex items-start justify-between ${cat.color} border-none`}>
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:10px:10px]" />
                    <div className="relative z-10 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center">
                        {cat.icon}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">{cat.label}</span>
                    </div>
                    {!s.isActive && <div className="bg-rose-500 text-white text-[8px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-widest z-10">Desactivado</div>}
                  </div>

                  <div className="px-8 pb-10 flex-1 flex flex-col -mt-4 relative z-10">
                    <div className="bg-[var(--admin-card-bg)] rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-white/5 mb-6 group-hover:border-indigo-500/20 transition-all">
                      <h3 className="text-xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-tight mb-2 truncate group-hover:text-primary transition-colors">
                        {s.name}
                      </h3>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed min-h-[2.5rem]">
                        {s.description || 'Prototipo técnico en fase de despliegue operacional sin documentación manual.'}
                      </p>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Inversión Base</span>
                          <span className="text-3xl font-black italic text-slate-900 dark:text-white uppercase leading-none tracking-tighter tabular-nums">
                            {s.basePriceGs > 0 ? `₲${(s.basePriceGs / 1000).toFixed(0)}K` : 'INCL'}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Timeline Operativo</span>
                          <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-200 italic uppercase">
                            <Clock size={12} className="text-indigo-500" />
                            {s.durationMinutes} min
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${s.isAddon ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'}`} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.isAddon ? 'Add-on' : 'Core Service'}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(s)} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-all hover:scale-110 active:scale-90 border border-transparent hover:border-indigo-500/20">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDelete(s.id)} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all hover:scale-110 active:scale-90 border border-transparent hover:border-rose-500/20">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Identification Label */}
                  <div className="absolute bottom-4 left-8 pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity duration-700">
                    <span className="text-[40px] font-black italic text-slate-900 dark:text-white tracking-tighter">IDX:{s.id.toString().slice(-4)}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        /* List View Implementation */
        <div className="admin-card !p-0 overflow-hidden border-b-4 border-b-indigo-500/20">
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Identificador / Categoría</th>
                  <th>Especificación Técnica</th>
                  <th>Timeline</th>
                  <th>Inversión Base</th>
                  <th>Segmento</th>
                  <th>Config</th>
                  <th className="text-right">Operaciones</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode='popLayout'>
                  {filteredServices.map((s, idx) => {
                    const cat = categories[s.category] || categories.STANDARD;
                    return (
                      <motion.tr
                        key={s.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ delay: idx * 0.02 }}
                        className={!s.isActive ? 'opacity-50 grayscale' : ''}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl ${cat.color} flex items-center justify-center border-none`}>
                              {cat.icon}
                            </div>
                            <div>
                              <p className="text-sm font-black italic uppercase text-slate-900 dark:text-white tracking-tight leading-none mb-1">{s.name}</p>
                              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-60 leading-none">{cat.label}</p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-xs">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                            {s.description || 'Protocolo sin definir'}
                          </p>
                        </td>
                        <td>
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 italic">
                            <Clock size={12} className="text-indigo-500" /> {s.durationMinutes} MIN
                          </div>
                        </td>
                        <td>
                          <span className="text-lg font-black italic text-slate-900 dark:text-white tabular-nums tracking-tighter">
                            {s.basePriceGs > 0 ? `₲${s.basePriceGs.toLocaleString('es-PY')}` : 'INCLUIDO'}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-badge px-3 py-1 ${s.isAddon ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'}`}>
                            {s.isAddon ? 'ADD-ON' : 'CORE'}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-badge px-3 py-1 ${s.isActive ? 'admin-badge-success' : 'admin-badge-danger'}`}>
                            {s.isActive ? 'LIVE' : 'DOWN'}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2 pr-2">
                            <button onClick={() => openEdit(s)} className="p-2 hover:text-indigo-500 transition-colors hover:scale-125 active:scale-90"><Edit size={16} /></button>
                            <button onClick={() => handleDelete(s.id)} className="p-2 hover:text-rose-500 transition-colors hover:scale-125 active:scale-90"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Service Modal Redesign */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10"
            >
              <div className="p-10">
                <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-100 dark:border-white/10">
                  <div>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
                      {editing ? 'Optimización Técnica' : 'Indexación de Protocolo'}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Configuración operacional de servicios</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-inner">
                    <XCircle size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Denominación Técnica</label>
                      <input
                        className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-5 text-sm font-black italic uppercase tracking-tighter text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                        required
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value.toUpperCase() })}
                        placeholder="EX: TRATAMIENTO CERÁMICO 9H..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Asignación Económica (₲)</label>
                      <div className="relative">
                        <Banknote className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="number"
                          className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-black italic text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                          required min={0}
                          value={form.basePriceGs}
                          onChange={e => setForm({ ...form, basePriceGs: parseInt(e.target.value) })}
                          placeholder="0 = Integrado"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Cronograma (Minutos)</label>
                      <div className="relative">
                        <Clock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="number"
                          className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-black italic text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                          required min={5}
                          value={form.durationMinutes}
                          onChange={e => setForm({ ...form, durationMinutes: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Memoria Descriptiva</label>
                    <textarea
                      className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl px-6 py-5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:border-indigo-500 transition-all shadow-inner h-24 resize-none"
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder="Indique los componentes y procesos técnicos del servicio..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Segmentación de Mercado</label>
                      <div className="relative">
                        <Layers className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select
                          className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 appearance-none transition-all shadow-inner cursor-pointer"
                          value={form.category}
                          onChange={e => setForm({ ...form, category: e.target.value })}
                        >
                          <option value="STANDARD">Estándar</option>
                          <option value="PREMIUM">Premium Experience</option>
                          <option value="VIP">VIP Exclusive</option>
                          <option value="ADDON">Upgrade / Adicional</option>
                        </select>
                        <ChevronRight size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                      </div>
                    </div>
                    <div className="flex gap-4 items-end">
                      <label className="flex-1 flex items-center gap-3 py-5 px-6 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 cursor-pointer group hover:border-indigo-500/30 transition-all">
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${form.isAddon ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' : 'border-slate-300 dark:border-slate-600'}`}>
                          {form.isAddon && <CheckCircle2 size={12} />}
                        </div>
                        <input type="checkbox" className="hidden" checked={form.isAddon} onChange={e => setForm({ ...form, isAddon: e.target.checked })} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-200 group-hover:text-amber-500 transition-colors">Add-on</span>
                      </label>
                      <label className="flex-1 flex items-center gap-3 py-5 px-6 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 cursor-pointer group hover:border-emerald-500/30 transition-all">
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${form.isActive ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'border-slate-300 dark:border-slate-600'}`}>
                          {form.isActive && <CheckCircle2 size={12} />}
                        </div>
                        <input type="checkbox" className="hidden" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-200 group-hover:text-emerald-500 transition-colors">Activo</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-8 py-5 rounded-[2rem] bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 transition-all hover:bg-slate-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-8 py-5 rounded-[2rem] bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest transition-all hover:-translate-y-1 shadow-2xl shadow-indigo-600/20 active:scale-95"
                    >
                      {editing ? 'Confirmar Optimización' : 'Ejecutar Indexación'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
