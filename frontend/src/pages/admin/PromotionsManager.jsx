import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag, Plus, Edit, Trash2,
  Search, Filter, Ticket,
  Percent, Banknote, Calendar,
  Users, CheckCircle2, XCircle,
  Clock, AlertCircle, Loader2,
  ChevronRight, ArrowRight, Zap,
  ExternalLink, MousePointer2, RefreshCcw
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function PromotionsManager() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    code: '', type: 'PERCENTAGE', value: 10,
    maxUses: 100, validFrom: '', validUntil: '', isActive: true
  });

  useEffect(() => { loadPromos(); }, []);

  const loadPromos = async () => {
    try {
      const r = await api.get('/promotions');
      setPromos(r.data.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/promotions/${editing.id}`, form);
        toast.success('Promoción actualizada con éxito');
      } else {
        await api.post('/promotions', form);
        toast.success('Nueva promoción activada');
      }
      setShowModal(false);
      setEditing(null);
      loadPromos();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al procesar el cupón');
    }
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      code: p.code, type: p.type || 'PERCENTAGE',
      value: p.value, maxUses: p.maxUses || 100,
      validFrom: p.validFrom?.split('T')[0] || '',
      validUntil: p.validUntil?.split('T')[0] || '',
      isActive: p.isActive
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar esta promoción?')) return;
    try {
      await api.delete(`/promotions/${id}`);
      toast.success('Promoción eliminada');
      loadPromos();
    } catch (e) {
      toast.error('Error al eliminar');
    }
  };

  const filteredPromos = promos.filter(p =>
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analizando Campañas Activas...</p>
    </div>
  );

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Ticket size={24} />
            </div>
            Marketing & Incentivos
          </h1>
          <p>Potencia tus ventas con campañas estratégicas de fidelización</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); loadPromos(); }}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-primary transition-all"
          >
            <RefreshCcw size={16} />
          </button>
          <button
            className="admin-btn-primary"
            onClick={() => {
              setEditing(null);
              setForm({ code: '', type: 'PERCENTAGE', value: 10, maxUses: 100, validFrom: '', validUntil: '', isActive: true });
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Lanzar Campaña
          </button>
        </div>
      </header>

      {/* Grid of Promos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence mode='popLayout'>
          {filteredPromos.map((p, i) => {
            const usagePercent = Math.min(100, ((p.usesCount || 0) / (p.maxUses || 1)) * 100);
            const isAgotado = usagePercent >= 100;
            const isExpirado = p.validUntil && new Date(p.validUntil) < new Date();

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`admin-card !p-0 relative overflow-visible flex flex-col group transition-all duration-500 hover:translate-y-[-8px] ${(!p.isActive || isExpirado) ? 'opacity-60 grayscale' : ''}`}
              >
                {/* Visual Ticket Notch Effect */}
                <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-10 rounded-r-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 z-10 border-l-0" />
                <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-10 rounded-l-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 z-10 border-r-0" />

                <div className="p-8 pb-4">
                  <div className="flex justify-between items-start mb-6">
                    <div className="bg-primary/5 text-primary border border-primary/20 px-5 py-2.5 rounded-2xl shadow-inner group-hover:bg-primary group-hover:text-white transition-all duration-300">
                      <span className="text-xl font-black italic uppercase tracking-widest leading-none block">
                        {p.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!p.isActive && <span className="admin-badge admin-badge-danger !border-none">Inactivo</span>}
                      {isExpirado && <span className="admin-badge !bg-slate-800 !text-white !border-none">Expirado</span>}
                      {isAgotado && p.isActive && !isExpirado && <span className="admin-badge !bg-rose-500 !text-white !border-none">Agotado</span>}
                      {p.isActive && !isAgotado && !isExpirado && (
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20" />
                      )}
                    </div>
                  </div>

                  <div className="mb-8">
                    <div className="flex items-center gap-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-black italic text-slate-900 dark:text-white uppercase leading-none tracking-tighter">
                          {p.type === 'PERCENTAGE' ? `${p.value}%` : `₲${(p.value / 1000)}K`}
                        </span>
                        <span className="text-xs font-black text-primary uppercase tracking-widest italic">Beneficio</span>
                      </div>
                      <div className="flex-1 h-[1px] bg-slate-100 dark:bg-white/5" />
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2 flex items-center gap-1.5">
                      <Zap size={10} className="text-amber-500" /> Aplicable a servicios Premium
                    </p>
                  </div>
                </div>

                <div className="px-8 pb-8 space-y-6 flex-1">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <div className="flex items-center gap-2 text-slate-400">
                        <MousePointer2 size={12} />
                        <span>Redenciones</span>
                      </div>
                      <span className="text-slate-900 dark:text-white tabular-nums">{p.usesCount || 0} / {p.maxUses}</span>
                    </div>

                    <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden p-[1px]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${usagePercent}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className={`h-full rounded-full ${usagePercent > 90 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 py-3 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5 group-hover:border-primary/20 transition-colors">
                      <Calendar size={14} className="text-slate-400 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Finaliza</span>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate italic">
                          {p.validUntil ? new Date(p.validUntil).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' }) : '∞'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 py-3 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5 group-hover:border-primary/20 transition-colors">
                      <Users size={14} className="text-slate-400 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Target</span>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate italic">REGISTRADOS</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/50 dark:bg-white/5 flex gap-2 border-t border-slate-100 dark:border-white/5 mt-auto">
                  <button
                    onClick={() => openEdit(p)}
                    className="flex-1 h-12 rounded-xl bg-white dark:bg-slate-800 shadow-sm hover:shadow-md hover:bg-primary hover:text-white text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group/btn"
                  >
                    <Edit size={14} className="group-hover/btn:scale-110 transition-transform" /> Modificar
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/10 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Coupon Modal */}
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
                <div className="flex justify-between items-center mb-10 border-b border-slate-100 dark:border-white/10 pb-6">
                  <div>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
                      {editing ? 'Optimizar Campaña' : 'Nueva Inyección de Marketing'}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Configuración técnica de conversión</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"><XCircle size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Identificador de Cupón</label>
                      <div className="relative">
                        <Tag className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                        <input
                          className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-black italic uppercase tracking-[0.2em] text-primary focus:outline-none focus:border-primary transition-all shadow-inner"
                          required
                          value={form.code}
                          onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                          placeholder="EX: ROYAL_2024"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Estructura de Retorno</label>
                      <div className="relative">
                        {form.type === 'PERCENTAGE' ? <Percent className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} /> : <Banknote className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />}
                        <select
                          className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-black uppercase tracking-tighter text-slate-900 dark:text-white focus:outline-none focus:border-primary appearance-none transition-all shadow-inner"
                          value={form.type}
                          onChange={e => setForm({ ...form, type: e.target.value })}
                        >
                          <option value="PERCENTAGE">Descuento Basado en %</option>
                          <option value="FIXED">Monto Fijo de Cortesía (₲)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Valor de Beneficio</label>
                      <input
                        type="number"
                        className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all"
                        required min={1}
                        value={form.value}
                        onChange={e => setForm({ ...form, value: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Escalas de Uso Máx.</label>
                      <input
                        type="number"
                        className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all"
                        required min={1}
                        value={form.maxUses}
                        onChange={e => setForm({ ...form, maxUses: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Fecha de Lanzamiento</label>
                      <input
                        type="date"
                        className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all"
                        value={form.validFrom}
                        onChange={e => setForm({ ...form, validFrom: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Cierre de Campaña</label>
                      <input
                        type="date"
                        className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all"
                        value={form.validUntil}
                        onChange={e => setForm({ ...form, validUntil: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-6 py-4 px-6 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-slate-100 dark:border-white/10">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${form.isActive ? 'bg-primary border-primary text-white scale-110 shadow-lg shadow-primary/20' : 'border-slate-300 dark:border-slate-600'}`}>
                        {form.isActive && <CheckCircle2 size={18} />}
                      </div>
                      <input type="checkbox" className="hidden" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                      <span className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Emitir Inmediatamente</span>
                    </label>

                    <p className="flex-1 text-right text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Campaña Auditada
                    </p>
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-8 py-5 rounded-[2rem] bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 transition-all hover:bg-slate-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-8 py-5 rounded-[2rem] bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest transition-all hover:-translate-y-1 shadow-2xl hover:shadow-primary/20"
                    >
                      {editing ? 'Aplicar Optimización' : 'Lanzar al Mercado'}
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
