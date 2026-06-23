import { useState, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Box, Plus, Pencil, Trash2, Search, AlertTriangle,
  Package, Droplets, Wrench, Layers, RefreshCcw,
  Minus, Boxes, CircleSlash, Wallet, ChevronDown,
} from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import StatCard from '../../../components/StatCard';
import AnimatedNumber from '../../../components/AnimatedNumber';
import EmptyState from '../../../components/EmptyState';
import FormModal from '../../../components/FormModal';
import FormField from '../../../components/FormField';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { SkeletonTable, SkeletonStats } from '../../../components/Skeleton';
import { DatePicker } from '../../../components/DatePicker';

const fmtGs = (n) => '₲ ' + Number(n || 0).toLocaleString('es-PY');

const CATEGORIES = [
  { value: 'LIMPIEZA', label: 'Lavado y limpieza' },
  { value: 'QUIMICOS', label: 'Productos químicos' },
  { value: 'ACCESORIOS', label: 'Accesorios de detailing' },
  { value: 'HERRAMIENTAS', label: 'Herramientas' },
  { value: 'GENERAL', label: 'Suministros generales' },
];

const UNITS = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'l', label: 'Litro (l)' },
  { value: 'g', label: 'Gramo (g)' },
  { value: 'kg', label: 'Kilogramo (kg)' },
];

const CATEGORY_META = {
  LIMPIEZA: { icon: Droplets, tone: 'sky' },
  QUIMICOS: { icon: AlertTriangle, tone: 'violet' },
  ACCESORIOS: { icon: Layers, tone: 'amber' },
  HERRAMIENTAS: { icon: Wrench, tone: 'cyan' },
  GENERAL: { icon: Package, tone: 'emerald' },
};

const EMPTY_FORM = {
  name: '', sku: '', brand: '', category: 'GENERAL', unit: 'unidad',
  currentStock: '', minStockAlert: '', maxStock: '', location: '',
  costPerUnit: '', supplierId: '', expiresAt: '', isActive: true,
};

function StockBadge({ item }) {
  const isOut = item.currentStock <= 0;
  const isLow = !isOut && item.currentStock <= item.minStockAlert;
  const cls = isOut
    ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
    : isLow
      ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400';
  const label = isOut ? 'Sin stock' : isLow ? 'Stock bajo' : 'OK';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function ItemsTab() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapSmall = reduceMotion ? undefined : { scale: 0.9 };

  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [catFocused, setCatFocused] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [adjustingId, setAdjustingId] = useState(null);

  const supplierName = (item) =>
    item.supplier ||
    suppliers.find((s) => s.id === item.supplierId)?.name ||
    '';

  const loadData = async () => {
    setError(false);
    try {
      const [itemsRes, statsRes, supRes] = await Promise.all([
        api.get('/inventory', { params: { limit: 200 }, _noCache: true }),
        api.get('/inventory/stats', { _noCache: true }).catch(() => ({ data: { data: null } })),
        api.get('/inventory/suppliers').catch(() => ({ data: { data: [] } })),
      ]);
      setItems(itemsRes.data.data || []);
      setStats(statsRes.data.data || null);
      setSuppliers(supRes.data.data || []);
    } catch (e) {
      setError(true);
      toast.error(e.response?.data?.message || 'No se pudo cargar el inventario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const refresh = () => { setLoading(true); loadData(); };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryFilter && i.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        (i.sku || '').toLowerCase().includes(q) ||
        supplierName(i).toLowerCase().includes(q)
      );
    });
  }, [items, search, categoryFilter, suppliers]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || '',
      sku: item.sku || '',
      brand: item.brand || '',
      category: item.category || 'GENERAL',
      unit: item.unit || 'unidad',
      currentStock: String(item.currentStock ?? ''),
      minStockAlert: String(item.minStockAlert ?? ''),
      maxStock: item.maxStock != null ? String(item.maxStock) : '',
      location: item.location || '',
      costPerUnit: String(item.costPerUnit ?? ''),
      supplierId: item.supplierId || '',
      expiresAt: item.expiresAt ? String(item.expiresAt).slice(0, 10) : '',
      isActive: item.isActive !== false,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Ingresá un nombre';
    if (!form.unit.trim()) errs.unit = 'Indicá la unidad';
    const stock = Number(form.currentStock);
    if (form.currentStock === '' || Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock))
      errs.currentStock = 'Stock inválido';
    const min = Number(form.minStockAlert);
    if (form.minStockAlert === '' || Number.isNaN(min) || min < 0 || !Number.isInteger(min))
      errs.minStockAlert = 'Alerta inválida';
    if (form.maxStock !== '') {
      const max = Number(form.maxStock);
      if (Number.isNaN(max) || max < 0 || !Number.isInteger(max)) errs.maxStock = 'Máximo inválido';
    }
    const cost = Number(form.costPerUnit || 0);
    if (Number.isNaN(cost) || cost < 0 || !Number.isInteger(cost))
      errs.costPerUnit = 'Costo inválido';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || undefined,
      brand: form.brand.trim() || undefined,
      category: form.category,
      unit: form.unit.trim(),
      currentStock: parseInt(form.currentStock, 10),
      minStockAlert: parseInt(form.minStockAlert, 10),
      maxStock: form.maxStock !== '' ? parseInt(form.maxStock, 10) : undefined,
      location: form.location.trim() || undefined,
      costPerUnit: parseInt(form.costPerUnit || 0, 10),
      supplierId: form.supplierId || undefined,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : '',
      isActive: !!form.isActive,
    };
    try {
      if (editing) {
        await api.put(`/inventory/${editing.id}`, payload);
        toast.success('Insumo actualizado');
      } else {
        await api.post('/inventory', payload);
        toast.success('Insumo registrado');
      }
      api.invalidate('/inventory');
      setModalOpen(false);
      setEditing(null);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar el insumo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/inventory/${toDelete.id}`);
      api.invalidate('/inventory');
      toast.success('Insumo eliminado');
      setToDelete(null);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const adjustStock = async (item, delta) => {
    if (item.currentStock + delta < 0) return;
    const reason = window.prompt(
      delta > 0 ? 'Motivo de la entrada (opcional):' : 'Motivo del ajuste / salida (opcional):',
      ''
    );
    // Cancelado por el usuario
    if (reason === null) return;
    setAdjustingId(item.id);
    // Optimista
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, currentStock: i.currentStock + delta } : i)));
    try {
      const res = await api.patch(`/inventory/${item.id}/adjust`, { delta, reason: reason.trim() || undefined });
      const updated = res.data.data;
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      api.invalidate('/inventory');
    } catch (err) {
      // Revertir
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, currentStock: i.currentStock - delta } : i)));
      toast.error(err.response?.data?.message || 'No se pudo ajustar el stock');
    } finally {
      setAdjustingId(null);
    }
  };

  return (
    <div>
      {/* Stats */}
      {loading ? (
        <SkeletonStats count={4} className="mb-6" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Boxes size={18} />} title="Insumos" value={<AnimatedNumber value={stats?.totalItems ?? items.length} format="int" />} color="#6366f1" />
          <StatCard icon={<AlertTriangle size={18} />} title="Stock bajo" value={<AnimatedNumber value={stats?.lowStock ?? 0} format="int" />} color="#f59e0b" />
          <StatCard icon={<CircleSlash size={18} />} title="Sin stock" value={<AnimatedNumber value={stats?.outOfStock ?? 0} format="int" />} color="#f43f5e" />
          <StatCard icon={<Wallet size={18} />} title="Valor estimado" value={<AnimatedNumber value={stats?.inventoryValueGs ?? 0} format="gs" />} color="#10b981" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`} size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar por nombre, SKU o proveedor…"
            className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
              searchFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          />
        </div>
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            onFocus={() => setCatFocused(true)}
            onBlur={() => setCatFocused(false)}
            className={`appearance-none bg-white dark:bg-slate-900 border rounded-xl pl-3 pr-9 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none transition-all duration-200 cursor-pointer ${
              catFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          >
            <option value="">Todas las categorías</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <motion.span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            animate={{ rotate: catFocused ? 180 : 0, color: catFocused ? 'var(--color-primary)' : '#94a3b8' }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 24 }}
          >
            <ChevronDown size={16} />
          </motion.span>
        </div>
        <motion.button
          onClick={refresh}
          whileTap={tapSmall}
          title="Actualizar"
          className="w-11 h-11 sm:w-auto sm:px-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors shrink-0"
        >
          <RefreshCcw size={16} />
        </motion.button>
        <motion.button
          onClick={openCreate}
          whileTap={tap}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-colors shrink-0"
        >
          <Plus size={16} /> Nuevo insumo
        </motion.button>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl">
          <EmptyState icon="⚠️" title="Error al cargar" message="No se pudo obtener el inventario." action="Reintentar" onAction={refresh} />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl">
          <EmptyState
            icon="📦"
            title={items.length === 0 ? 'Sin insumos registrados' : 'Sin resultados'}
            message={items.length === 0 ? 'Registrá tu primer insumo para llevar el control de stock.' : 'Probá ajustar la búsqueda o el filtro.'}
            action={items.length === 0 ? 'Nuevo insumo' : undefined}
            onAction={items.length === 0 ? openCreate : undefined}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-white/[0.02] text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-3.5 font-medium">Insumo</th>
                  <th className="text-left px-5 py-3.5 font-medium">SKU</th>
                  <th className="text-left px-5 py-3.5 font-medium">Categoría</th>
                  <th className="text-center px-5 py-3.5 font-medium">Stock</th>
                  <th className="text-center px-5 py-3.5 font-medium">Mín / Máx</th>
                  <th className="text-left px-5 py-3.5 font-medium">Ubicación</th>
                  <th className="text-right px-5 py-3.5 font-medium">Costo unit.</th>
                  <th className="text-left px-5 py-3.5 font-medium">Proveedor</th>
                  <th className="text-right px-5 py-3.5 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const meta = CATEGORY_META[item.category] || CATEGORY_META.GENERAL;
                  const Icon = meta.icon;
                  const lowOrOut = item.currentStock <= item.minStockAlert;
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`admin-itile admin-itile-${meta.tone} w-9 h-9`}>
                            <Icon size={16} className="text-white" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate">
                              {item.name}
                              {item.isActive === false && (
                                <span className="ml-2 text-[10px] font-medium text-slate-400 align-middle">(inactivo)</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400">{item.brand || `Unidad: ${item.unit}`}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-mono">{item.sku || '—'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-slate-500 dark:text-slate-400 text-xs">
                          {CATEGORIES.find((c) => c.value === item.category)?.label || item.category || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <motion.button
                            onClick={() => adjustStock(item, -1)}
                            disabled={adjustingId === item.id || item.currentStock <= 0}
                            whileTap={adjustingId === item.id || item.currentStock <= 0 ? undefined : tapSmall}
                            title="Restar 1"
                            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-rose-500 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Minus size={13} />
                          </motion.button>
                          <div className="text-center min-w-[72px]">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-sm font-semibold tabular-nums ${
                              lowOrOut
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                                : 'text-slate-900 dark:text-white'
                            }`}>
                              {item.currentStock}
                              <span className="text-[10px] font-normal opacity-70">{item.unit}</span>
                            </span>
                            <div className="mt-0.5"><StockBadge item={item} /></div>
                          </div>
                          <motion.button
                            onClick={() => adjustStock(item, +1)}
                            disabled={adjustingId === item.id}
                            whileTap={adjustingId === item.id ? undefined : tapSmall}
                            title="Sumar 1"
                            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-emerald-500 flex items-center justify-center transition-colors disabled:opacity-40"
                          >
                            <Plus size={13} />
                          </motion.button>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center tabular-nums text-slate-500 dark:text-slate-400 text-xs">
                        {item.minStockAlert} / {item.maxStock != null ? item.maxStock : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-slate-500 dark:text-slate-400 text-xs truncate block max-w-[120px]">
                          {item.location || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-slate-700 dark:text-slate-200">
                        {fmtGs(item.costPerUnit || 0)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-slate-500 dark:text-slate-400 text-xs truncate block max-w-[160px]">
                          {supplierName(item) || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <motion.button
                            onClick={() => openEdit(item)}
                            whileTap={tapSmall}
                            title="Editar"
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 flex items-center justify-center transition-colors"
                          >
                            <Pencil size={15} />
                          </motion.button>
                          <motion.button
                            onClick={() => setToDelete(item)}
                            whileTap={tapSmall}
                            title="Eliminar"
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                          >
                            <Trash2 size={15} />
                          </motion.button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      <FormModal
        isOpen={modalOpen}
        onClose={() => { if (!saving) { setModalOpen(false); setEditing(null); } }}
        title={editing ? 'Editar insumo' : 'Nuevo insumo'}
        subtitle={editing ? 'Actualizá los datos del insumo' : 'Registrá un nuevo insumo en el inventario'}
        icon={<Box size={18} />}
        formId="inventory-form"
        submitting={saving}
        submitLabel={editing ? 'Guardar cambios' : 'Registrar'}
        size="lg"
      >
        <form id="inventory-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Nombre" name="name" value={form.name} onChange={setField('name')}
              required error={formErrors.name} placeholder="Ej: Shampoo pH neutro"
            />
            <FormField
              label="Marca" name="brand" value={form.brand} onChange={setField('brand')}
              placeholder="Marca (opcional)"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              label="SKU" name="sku" value={form.sku} onChange={setField('sku')}
              placeholder="Código (opcional)"
            />
            <FormField as="select" label="Categoría" name="category" value={form.category} onChange={setField('category')}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </FormField>
            <FormField as="select" label="Unidad" name="unit" value={form.unit} onChange={setField('unit')} error={formErrors.unit}>
              {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </FormField>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <FormField
              label="Stock actual" name="currentStock" type="number" min={0} value={form.currentStock}
              onChange={setField('currentStock')} required error={formErrors.currentStock}
            />
            <FormField
              label="Alerta mínima" name="minStockAlert" type="number" min={0} value={form.minStockAlert}
              onChange={setField('minStockAlert')} required error={formErrors.minStockAlert}
              hint={!formErrors.minStockAlert ? 'Avisa al llegar a este nivel' : undefined}
            />
            <FormField
              label="Stock máximo" name="maxStock" type="number" min={0} value={form.maxStock}
              onChange={setField('maxStock')} error={formErrors.maxStock} placeholder="Opcional"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Costo unit." name="costPerUnit" type="number" min={0} value={form.costPerUnit}
              onChange={setField('costPerUnit')} error={formErrors.costPerUnit} prefix="₲" placeholder="0"
            />
            <FormField
              label="Ubicación" name="location" value={form.location} onChange={setField('location')}
              placeholder="Estante, depósito… (opcional)"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField as="select" label="Proveedor" name="supplierId" value={form.supplierId} onChange={setField('supplierId')}>
              <option value="">Sin proveedor</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </FormField>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="expiresAt" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Vencimiento
              </label>
              <DatePicker
                id="expiresAt"
                value={form.expiresAt}
                onChange={(v) => setForm((f) => ({ ...f, expiresAt: v }))}
                placeholder="Seleccionar fecha"
              />
              <p className="text-xs text-slate-400">Opcional</p>
            </div>
          </div>
          <label className="flex items-center gap-3 pt-1 cursor-pointer select-none">
            <motion.button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              whileTap={tapSmall}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-white/10'}`}
            >
              <motion.span
                layout
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }}
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow ${form.isActive ? 'left-[22px]' : 'left-0.5'}`}
              />
            </motion.button>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Insumo activo
              <span className="block text-xs font-normal text-slate-400">Los inactivos no se consumen ni aparecen en reportes</span>
            </span>
          </label>
        </form>
      </FormModal>

      {/* Confirmación eliminar */}
      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        variant="danger"
        title="Eliminar insumo"
        message={`¿Seguro que querés eliminar "${toDelete?.name}"? Si tiene historial de movimientos se desactivará en lugar de borrarse.`}
      />
    </div>
  );
}
