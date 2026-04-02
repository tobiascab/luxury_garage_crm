import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Plus, Edit, Trash2,
  Crown, Gem, Star, CheckCircle2,
  XCircle, Filter, Search, Loader2,
  Info, ChevronRight, AlertCircle,
  Zap, CreditCard, Percent, ArrowUpRight,
  Shield, Award, Sparkles, RefreshCcw,
  LayoutDashboard, Heart, ZapOff, MoreVertical
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function PlansManager() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', priceGs: 0,
    billingPeriod: 'MONTHLY', discountPercent: 0, isActive: true
  });

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    try {
      const r = await api.get('/plans');
      setPlans(r.data.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/plans/${editing.id}`, form);
        toast.success('Membresía optimizada con éxito');
      } else {
        await api.post('/plans', form);
        toast.success('Nueva propuesta de valor activada');
      }
      setShowModal(false);
      setEditing(null);
      loadPlans();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error en la configuración del plan');
    }
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || '',
      priceGs: p.priceGs, billingPeriod: p.billingPeriod || 'MONTHLY',
      discountPercent: p.discountPercent || 0, isActive: p.isActive
    });
    setShowModal(true);
  };

  const planConfigs = {
    'Básico': { icon: <Star size={32} />, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', gradient: 'from-blue-500 to-indigo-600', badge: 'Entry Level' },
    'Premium': { icon: <Gem size={32} />, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', gradient: 'from-amber-400 to-orange-600', badge: 'Most Popular' },
    'VIP': { icon: <Crown size={32} />, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', gradient: 'from-purple-500 to-pink-600', badge: 'Flagship' }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <Loader2 size={40} className="text-primary animate-spin" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Diseñando Estructura de Membresías...</p>
        <p className="text-[8px] font-bold text-slate-500 italic mt-1 uppercase tracking-tighter">Sincronizando modelos de suscripción</p>
      </div>
    </div>
  );

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <ClipboardList size={24} />
            </div>
            Ingeniería de Membresías
          </h1>
          <p>Define la propuesta de exclusividad y valor para tus miembros VIP</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); loadPlans(); }}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-primary transition-all"
            title="Refrescar Planes"
          >
            <RefreshCcw size={16} />
          </button>
          <button
            className="admin-btn-primary"
            onClick={() => {
              setEditing(null);
              setForm({ name: '', description: '', priceGs: 0, billingPeriod: 'MONTHLY', discountPercent: 0, isActive: true });
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Nueva Membresía
          </button>
        </div>
      </header>

      {/* Grid of Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        <AnimatePresence>
          {plans.map((p, i) => {
            const config = planConfigs[p.name] || { icon: <CreditCard size={32} />, color: 'text-slate-500 bg-slate-500/10 border-slate-500/20', gradient: 'from-slate-500 to-slate-700', badge: 'Custom' };
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`admin-card !p-0 relative overflow-visible flex flex-col group transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 ${!p.isActive ? 'opacity-40 grayscale' : ''}`}
              >
                {/* Visual Header Accent */}
                <div className={`h-2 bg-gradient-to-r ${config.gradient} rounded-t-[rem] w-full`} />

                {/* Floating Badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 px-4 py-1.5 rounded-md shadow-md z-10">
                  <p className="text-xs font-semibold text-primary">{config.badge}</p>
                </div>

                <div className="pt-12 pb-10 flex flex-col items-center text-center px-8 relative">
                  <div className={`w-24 h-24 rounded-lg ${config.color} border shadow-sm flex items-center justify-center mb-8`}>
                    <div className="drop-shadow-lg">{config.icon}</div>
                  </div>

                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white leading-none mb-2">
                    {p.name}
                  </h2>
                  <p className="text-sm font-normal text-slate-500 dark:text-slate-400 opacity-80">Plan de membresía</p>

                  <div className="my-10 relative w-full">
                    <div className="flex items-baseline justify-center">
                      <span className="text-sm font-semibold text-primary mr-1">₲</span>
                      <span className="text-6xl font-bold text-slate-900 dark:text-white leading-none">
                        {(p.priceGs / 1000).toFixed(0)}K
                      </span>
                      <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400 leading-none">/ mes</span>
                    </div>
                  </div>

                  <div className="w-full space-y-4 mb-10">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 italic leading-relaxed min-h-[3rem]">
                      {p.description || 'Sin descripción detallada del alcance de la membresía.'}
                    </p>
                  </div>

                  {p.discountPercent > 0 && (
                    <div className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl mb-10 group-hover:bg-emerald-500/10 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <Percent size={18} />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Privilegios</p>
                        <p className="text-[11px] font-black text-emerald-500 uppercase tracking-tighter italic">
                          {p.discountPercent}% OFF en Servicios Extra
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="w-full grid grid-cols-2 gap-4 mt-auto">
                    <button
                      onClick={() => openEdit(p)}
                      className="h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:scale-[1.02] shadow-xl active:scale-95"
                    >
                      <Edit size={14} /> Optimizar
                    </button>
                    <button
                      className="h-14 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-primary transition-all flex items-center justify-center hover:border-primary/20 active:scale-95"
                    >
                      <ArrowUpRight size={20} />
                    </button>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="absolute top-4 right-8 pointer-events-none">
                  <div className={`w-3 h-3 rounded-full ${p.isActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`} />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Plan Editor Modal Redesign */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/95 backdrop-blur-md"
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
                      {editing ? 'Configurar Privilegios' : 'Lanzamiento de Membresía'}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Arquitectura de suscripción y fidelidad</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-inner">
                    <XCircle size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Denominación del Nivel</label>
                      <div className="relative">
                        <Award className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-16 pr-6 py-5 text-sm font-black italic uppercase tracking-tighter text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all shadow-inner"
                          required
                          value={form.name}
                          onChange={e => setForm({ ...form, name: e.target.value })}
                          placeholder="EX: MEMBRESÍA ULTIMATE..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Manifiesto de Beneficios</label>
                      <textarea
                        className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl px-6 py-5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:border-primary transition-all shadow-inner h-28 resize-none"
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder="Describa la exclusividad y alcances de este nivel de acceso..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Arancel Mensual (₲)</label>
                        <div className="relative">
                          <CreditCard className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input
                            type="number"
                            className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-black italic text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all shadow-inner"
                            required min={0}
                            value={form.priceGs}
                            onChange={e => setForm({ ...form, priceGs: parseInt(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Privilegios (%)</label>
                        <div className="relative">
                          <Percent className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input
                            type="number"
                            className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-black italic text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
                            min={0} max={100}
                            value={form.discountPercent}
                            onChange={e => setForm({ ...form, discountPercent: parseInt(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-6 bg-slate-50/50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/10">
                    <label className="flex items-center gap-4 cursor-pointer group">
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${form.isActive ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'border-slate-300 dark:border-slate-600'}`}>
                        {form.isActive && <CheckCircle2 size={14} />}
                      </div>
                      <input type="checkbox" className="hidden" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 block leading-none mb-1">Estatus Operativo</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Disponible para contratación inmediata</span>
                      </div>
                    </label>

                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Recurrencia</span>
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest italic">Facturación Mensual</span>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-8 py-5 rounded-[2rem] bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 transition-all hover:bg-slate-200"
                    >
                      Anular Operación
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-8 py-5 rounded-[2rem] bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest transition-all hover:-translate-y-1 shadow-2xl shadow-indigo-600/20 active:scale-95"
                    >
                      {editing ? 'Confirmar Optimización' : 'Lanzar Membresía'}
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
