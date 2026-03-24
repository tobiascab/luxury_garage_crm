import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box, Plus, Edit, Trash2,
  Search, Filter, AlertTriangle,
  Package, Truck, Droplets,
  Wrench, Settings, MoreHorizontal,
  CheckCircle2, XCircle, ArrowRight,
  TrendingUp, TrendingDown, Loader2,
  Layers, Info, ChevronRight, AlertCircle,
  BarChart3, RefreshCcw, MoreVertical
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function InventoryManager() {
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    name: '', category: 'LIMPIEZA', unit: 'unidad',
    currentStock: 0, minStockAlert: 5, costPerUnit: 0,
    supplier: ''
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [itemsRes, alertsRes] = await Promise.all([
        api.get('/inventory'),
        api.get('/inventory/alerts').catch(() => ({ data: { data: [] } }))
      ]);
      setItems(itemsRes.data.data || []);
      setAlerts(alertsRes.data.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/inventory/${editing.id}`, form);
        toast.success('Inventario actualizado');
      } else {
        await api.post('/inventory', form);
        toast.success('Insumo registrado correctamente');
      }
      setShowModal(false);
      setEditing(null);
      loadData();
    } catch (err) {
      toast.error('Error al procesar el registro');
    }
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name, category: item.category,
      unit: item.unit, currentStock: item.currentStock,
      minStockAlert: item.minStockAlert,
      costPerUnit: item.costPerUnit || 0,
      supplier: item.supplier || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de eliminar este insumo?')) return;
    try {
      await api.delete(`/inventory/${id}`);
      toast.success('Insumo eliminado');
      loadData();
    } catch (e) {
      toast.error('Error al eliminar');
    }
  };

  const categoryIcons = {
    'LIMPIEZA': <Droplets size={14} className="text-blue-500" />,
    'QUIMICOS': <AlertCircle size={14} className="text-purple-500" />,
    'ACCESORIOS': <Layers size={14} className="text-amber-500" />,
    'HERRAMIENTAS': <Wrench size={14} className="text-slate-500" />,
    'GENERAL': <Package size={14} className="text-emerald-500" />
  };

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.supplier?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escaneando Almacén Central...</p>
    </div>
  );

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
              <Box size={24} />
            </div>
            Control de Insumos
          </h1>
          <p>Gestión estratégica de suministros y activos operativos</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); loadData(); }}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-primary transition-all"
          >
            <RefreshCcw size={16} />
          </button>
          <button
            className="admin-btn-primary"
            onClick={() => {
              setEditing(null);
              setForm({ name: '', category: 'LIMPIEZA', unit: 'unidad', currentStock: 0, minStockAlert: 5, costPerUnit: 0, supplier: '' });
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Registrar Insumo
          </button>
        </div>
      </header>

      {/* Alerts Section */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-10 p-5 rounded-[2.5rem] bg-rose-500/5 border border-rose-500/20 flex flex-col md:flex-row items-center gap-6 group hover:bg-rose-500/10 transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-rose-500/10 transition-colors" />

            <div className="w-14 h-14 rounded-2xl bg-rose-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-rose-500/30">
              <AlertTriangle size={28} />
            </div>

            <div className="flex-1 text-center md:text-left z-10">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 mb-1">Estado Crítico Detectado</h4>
              <p className="text-base font-bold text-slate-700 dark:text-slate-200">
                Detectamos <span className="text-rose-600 font-black">{alerts.length} insumos</span> por debajo del stock de seguridad.
              </p>
            </div>

            <div className="flex items-center -space-x-3 z-10">
              {alerts.slice(0, 4).map((a, i) => (
                <div key={i} className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 border-2 border-rose-100 dark:border-rose-500/20 flex items-center justify-center text-xs font-black text-rose-500 shadow-md group-hover:translate-y-[-4px] transition-transform duration-300" style={{ transitionDelay: `${i * 50}ms` }}>
                  {a.name?.[0]}
                </div>
              ))}
              {alerts.length > 4 && (
                <div className="w-10 h-10 rounded-2xl bg-rose-500 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                  +{alerts.length - 4}
                </div>
              )}
            </div>

            <button className="h-12 px-8 rounded-2xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest transition-all hover:-translate-y-1 shadow-xl shadow-rose-500/30 flex items-center gap-2 group/btn z-10">
              Gestionar Compras <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Inventory Layout */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-lg font-black italic uppercase tracking-tighter text-slate-900 dark:text-white flex items-center gap-3">
            <BarChart3 size={18} className="text-primary" />
            Bitácora de Existencias
          </h2>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="admin-search-wrapper flex-1 md:w-80">
              <Search className="admin-search-icon" size={16} />
              <input
                className="admin-search-input"
                placeholder="Buscar por nombre o proveedor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-400 flex items-center justify-center transition-all hover:text-primary shadow-sm hover:border-primary/20">
              <Filter size={18} />
            </button>
          </div>
        </div>

        <div className="admin-card !p-0 overflow-hidden border-b-4 border-b-slate-900/5 dark:border-b-white/5">
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="w-64">Especificación del Insumo</th>
                  <th>Categoría</th>
                  <th className="w-48 text-center">Estado de Stock</th>
                  <th>Costo Unitario</th>
                  <th>Proveedor Maestría</th>
                  <th className="w-24 text-right">Mantenimiento</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode='popLayout'>
                  {filteredItems.map((item, i) => {
                    const isLow = item.currentStock <= item.minStockAlert;
                    const isOut = item.currentStock <= 0;
                    return (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.01 }}
                        className="group"
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300 border border-slate-100 dark:border-white/10">
                              {categoryIcons[item.category] || <Box size={16} />}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight mb-0.5 group-hover:translate-x-1 transition-transform">
                                {item.name}
                              </p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                Unidad: {item.unit}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500">
                            {item.category}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-2xl font-black italic tracking-tighter ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {item.currentStock.toString().padStart(2, '0')}
                              </span>
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">Actual</span>
                                <span className="text-[8px] font-bold text-slate-400 leading-none">/ {item.minStockAlert} min</span>
                              </div>
                            </div>
                            <div className="w-24 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-1000 ${isOut ? 'bg-rose-500 w-full' : isLow ? 'bg-amber-500 w-[40%]' : 'bg-emerald-500 w-[85%]'}`}
                                style={{ width: `${Math.min(100, (item.currentStock / (item.minStockAlert * 2)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                              ₲{(item.costPerUnit || 0).toLocaleString()}
                            </span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Inversión Unit.</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                              <Truck size={12} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 max-w-[140px] truncate italic">
                              {item.supplier || 'NEXUS_SUPPLY'}
                            </span>
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(item)}
                              className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary hover:bg-primary/10 transition-all flex items-center justify-center border border-transparent hover:border-primary/20"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex items-center justify-center border border-transparent hover:border-red-500/20"
                            >
                              <Trash2 size={16} />
                            </button>
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
      </div>

      {/* Inventory Modal */}
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
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8 border-b border-slate-100 dark:border-white/5 pb-6">
                  <div>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
                      {editing ? 'Editor de Registro' : 'Nuevo Activo'}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Especificaciones de Almacén</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-rose-500 hover:text-white flex items-center justify-center text-slate-400 transition-all"><XCircle size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Identificador del Insumo</label>
                    <input
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all placeholder:text-slate-300"
                      required
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="Ej: SHAMPOO_PH_NEUTRAL_V2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Categorización</label>
                      <select
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary appearance-none transition-all"
                        value={form.category}
                        onChange={e => setForm({ ...form, category: e.target.value })}
                      >
                        <option value="LIMPIEZA">Lavado y Limpieza</option>
                        <option value="QUIMICOS">Productos Químicos</option>
                        <option value="ACCESORIOS">Accesorios de Detailing</option>
                        <option value="HERRAMIENTAS">Herramientas Mecánicas</option>
                        <option value="GENERAL">Suministros Generales</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Unidad Base</label>
                      <input
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all"
                        value={form.unit}
                        onChange={e => setForm({ ...form, unit: e.target.value })}
                        placeholder="Litro, Paquete..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Existencia</label>
                      <input
                        type="number"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all"
                        min={0}
                        value={form.currentStock}
                        onChange={e => setForm({ ...form, currentStock: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Seguridad</label>
                      <input
                        type="number"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all"
                        min={0}
                        value={form.minStockAlert}
                        onChange={e => setForm({ ...form, minStockAlert: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Costo P/U</label>
                      <input
                        type="number"
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all"
                        min={0}
                        value={form.costPerUnit}
                        onChange={e => setForm({ ...form, costPerUnit: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Entidad Proveedora</label>
                    <input
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all"
                      value={form.supplier}
                      onChange={e => setForm({ ...form, supplier: e.target.value })}
                      placeholder="Nombre corporativo del proveedor"
                    />
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-8 py-5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 transition-all hover:bg-slate-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-8 py-5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest transition-all hover:-translate-y-1 shadow-2xl hover:shadow-primary/20"
                    >
                      {editing ? 'Actualizar Master' : 'Inyectar Registro'}
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
