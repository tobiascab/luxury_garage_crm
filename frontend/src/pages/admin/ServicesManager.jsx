import { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Wrench, Plus, Pencil, Trash2, RotateCcw,
  Clock, Search, Car, Zap, PlusCircle,
  RefreshCcw, AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatGs } from '../../constants/pricing';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import { SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';

// Genera un key/slug a partir de un nombre.
const slugify = (str) =>
  (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const CATEGORIES = [
  { value: 'standard', label: 'Estándar' },
  { value: 'premium', label: 'Premium' },
  { value: 'vip', label: 'VIP' },
  { value: 'addon', label: 'Adicional' },
];
const categoryLabel = (c) =>
  CATEGORIES.find((x) => x.value === (c || '').toLowerCase())?.label || c || '—';

const EMPTY_FORM = {
  name: '', description: '', category: 'standard',
  durationMinutes: 30, basePriceGs: '', isAddon: false, isActive: true,
  pricingBySize: {}, addons: [],
};

export default function ServicesManager() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapIcon = reduceMotion ? undefined : { scale: 0.9 };

  const [services, setServices] = useState([]);
  const [vehicleSizes, setVehicleSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [svc, sizes] = await Promise.all([
        api.get('/services', { params: { includeInactive: true }, _noCache: true }),
        api.get('/vehicle-sizes', { params: { includeInactive: true }, _noCache: true }),
      ]);
      setServices(svc.data.data || []);
      setVehicleSizes((sizes.data.data || []).filter((s) => s.isActive));
    } catch (e) {
      setError(true);
      toast.error(e.response?.data?.message || 'No se pudieron cargar los servicios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── form helpers ──────────────────────────────────────────────────────
  const setSizePrice = (sizeKey, value) => {
    setForm((prev) => {
      const next = { ...(prev.pricingBySize || {}) };
      if (value === '' || value === null) delete next[sizeKey];
      else next[sizeKey] = value;
      return { ...prev, pricingBySize: next };
    });
  };
  const addAddonRow = () =>
    setForm((prev) => ({ ...prev, addons: [...(prev.addons || []), { name: '', priceGs: '' }] }));
  const updateAddonRow = (idx, field, value) =>
    setForm((prev) => {
      const next = [...(prev.addons || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, addons: next };
    });
  const removeAddonRow = (idx) =>
    setForm((prev) => ({ ...prev, addons: (prev.addons || []).filter((_, i) => i !== idx) }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };
  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description || '',
      category: (s.category || 'standard').toLowerCase(),
      durationMinutes: s.durationMinutes,
      basePriceGs: s.basePriceGs ?? '',
      isAddon: !!s.isAddon,
      isActive: !!s.isActive,
      pricingBySize: s.pricingBySize || {},
      addons: (s.addons || []).map((a) => ({ name: a.name || '', priceGs: a.priceGs ?? '' })),
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Nombre requerido';
    const dur = Number(form.durationMinutes);
    if (!dur || dur <= 0) e.durationMinutes = 'Duración inválida';
    const sizeValues = Object.values(form.pricingBySize || {})
      .map(Number)
      .filter((n) => !Number.isNaN(n) && n > 0);
    const base = Number(form.basePriceGs);
    if ((!base || base <= 0) && sizeValues.length === 0) {
      e.basePriceGs = 'Definí un precio base o al menos un precio por tamaño';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildPayload = () => {
    const pricingBySize = {};
    Object.entries(form.pricingBySize || {}).forEach(([key, val]) => {
      const n = Number(val);
      if (val !== '' && val != null && !Number.isNaN(n) && n > 0) pricingBySize[key] = n;
    });
    const addons = (form.addons || [])
      .filter((a) => a && a.name && a.name.trim())
      .map((a) => ({ key: slugify(a.name), name: a.name.trim(), priceGs: Number(a.priceGs) || 0 }));

    const sizeValues = Object.values(pricingBySize);
    const basePriceGs =
      (!form.basePriceGs || Number(form.basePriceGs) === 0) && sizeValues.length
        ? Math.min(...sizeValues)
        : Number(form.basePriceGs) || 0;

    return {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      category: form.category,
      durationMinutes: Number(form.durationMinutes),
      basePriceGs,
      isAddon: !!form.isAddon,
      isActive: !!form.isActive,
      pricingBySize,
      addons,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (editing) {
        await api.put(`/services/${editing.id}`, payload);
        toast.success('Servicio actualizado');
      } else {
        await api.post('/services', payload);
        toast.success('Servicio creado');
      }
      api.invalidate('/services');
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar el servicio');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/services/${toDelete.id}`);
      toast.success('Servicio desactivado');
      api.invalidate('/services');
      setToDelete(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo desactivar');
    } finally {
      setDeleting(false);
    }
  };

  const reactivate = async (s) => {
    try {
      await api.put(`/services/${s.id}`, { isActive: true });
      toast.success('Servicio reactivado');
      api.invalidate('/services');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo reactivar');
    }
  };

  const filtered = services.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(search.toLowerCase());
    const matchCat =
      categoryFilter === 'all' || (s.category || 'standard').toLowerCase() === categoryFilter;
    return matchSearch && matchCat;
  });

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div className="page-content pb-16">
      {/* Header */}
      <div className="admin-page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="admin-itile admin-itile-indigo w-10 h-10">
            <Wrench size={20} className="text-white" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Servicios</h1>
            <p className="text-sm text-slate-500">Catálogo de servicios y precios por tamaño de vehículo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={tapIcon}
            onClick={load}
            title="Recargar"
            className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors"
          >
            <RefreshCcw size={16} />
          </motion.button>
          <motion.button
            whileTap={tap}
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-colors"
          >
            <Plus size={16} /> Nuevo servicio
          </motion.button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`}
            size={16}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar servicio por nombre o descripción…"
            className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
              searchFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {[{ value: 'all', label: 'Todos' }, ...CATEGORIES].map((c) => (
            <motion.button
              key={c.value}
              whileTap={tap}
              onClick={() => setCategoryFilter(c.value)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap border transition-colors ${
                categoryFilter === c.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {c.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Tabla / estados */}
      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : error ? (
        <EmptyState icon="⚠️" title="Error al cargar" message="No se pudieron obtener los servicios." action="Reintentar" onAction={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🧽"
          title={search || categoryFilter !== 'all' ? 'Sin resultados' : 'No hay servicios'}
          message={search || categoryFilter !== 'all' ? 'Probá con otro filtro o búsqueda.' : 'Creá tu primer servicio para empezar.'}
          action={search || categoryFilter !== 'all' ? undefined : 'Nuevo servicio'}
          onAction={search || categoryFilter !== 'all' ? undefined : openCreate}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-white/[0.02] text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <th className="px-5 py-3.5">Servicio</th>
                  <th className="px-5 py-3.5">Categoría</th>
                  <th className="px-5 py-3.5">Duración</th>
                  <th className="px-5 py-3.5 text-right">Precio base</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`admin-itile ${s.isAddon ? 'admin-itile-amber' : 'admin-itile-sky'} w-9 h-9 shrink-0`}>
                          {s.isAddon ? <Zap size={16} className="text-white" /> : <Wrench size={16} className="text-white" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.name}</p>
                          {s.description && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 max-w-md">{s.description}</p>
                          )}
                          {s.pricingBySize && Object.keys(s.pricingBySize).length > 0 && (
                            <p className="text-xs text-slate-400 mt-1">
                              {Object.keys(s.pricingBySize).length} precio(s) por tamaño · {(s.addons || []).length} adicional(es)
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {s.isAddon && <Zap size={12} className="text-amber-500" />}
                        {categoryLabel(s.category)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                        <Clock size={14} className="text-slate-400" /> {s.durationMinutes} min
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                      {s.basePriceGs > 0 ? formatGs(s.basePriceGs) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          s.isActive
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {s.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <motion.button
                          whileTap={tapIcon}
                          onClick={() => openEdit(s)}
                          title="Editar"
                          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 flex items-center justify-center transition-colors"
                        >
                          <Pencil size={15} />
                        </motion.button>
                        {s.isActive ? (
                          <motion.button
                            whileTap={tapIcon}
                            onClick={() => setToDelete(s)}
                            title="Desactivar"
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                          >
                            <Trash2 size={15} />
                          </motion.button>
                        ) : (
                          <motion.button
                            whileTap={tapIcon}
                            onClick={() => reactivate(s)}
                            title="Reactivar"
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 flex items-center justify-center transition-colors"
                          >
                            <RotateCcw size={15} />
                          </motion.button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar servicio' : 'Nuevo servicio'}
        subtitle="Configuración y precios del servicio"
        icon={<Wrench size={18} />}
        formId="service-form"
        submitting={submitting}
        submitLabel={editing ? 'Guardar cambios' : 'Crear servicio'}
        size="lg"
      >
        <form id="service-form" onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Nombre del servicio"
            name="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
            placeholder="Ej: Ducha, aspirado y cera carnauba"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Precio base (₲)"
              name="basePriceGs"
              type="number"
              min={0}
              prefix="₲"
              value={form.basePriceGs}
              onChange={(e) => setForm({ ...form, basePriceGs: e.target.value })}
              error={errors.basePriceGs}
              hint="Se usa si no hay precio por tamaño."
            />
            <FormField
              label="Duración (min)"
              name="durationMinutes"
              type="number"
              min={1}
              required
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              error={errors.durationMinutes}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              as="select"
              label="Categoría"
              name="category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </FormField>
            <div className="flex items-end gap-3">
              <label className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isAddon}
                  onChange={(e) => setForm({ ...form, isAddon: e.target.checked })}
                  className="w-4 h-4 rounded accent-indigo-600"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">Es adicional</span>
              </label>
              <label className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 rounded accent-emerald-600"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">Activo</span>
              </label>
            </div>
          </div>

          <FormField
            as="textarea"
            label="Descripción"
            name="description"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Qué incluye el servicio…"
          />

          {/* Precios por tamaño */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Car size={15} className="text-indigo-600" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Precios por tamaño de vehículo</span>
            </div>
            {vehicleSizes.length === 0 ? (
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <AlertCircle size={13} /> No hay tamaños de vehículo configurados.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {vehicleSizes.map((size) => (
                  <FormField
                    key={size.id ?? size.key}
                    label={size.label}
                    name={`size-${size.key}`}
                    type="number"
                    min={0}
                    prefix="₲"
                    value={form.pricingBySize?.[size.key] ?? ''}
                    onChange={(e) => setSizePrice(size.key, e.target.value)}
                    placeholder="0"
                    hint={form.pricingBySize?.[size.key] ? formatGs(form.pricingBySize[size.key]) : undefined}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Adicionales */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-amber-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Adicionales</span>
              </div>
              <motion.button
                whileTap={tap}
                type="button"
                onClick={addAddonRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
              >
                <PlusCircle size={14} /> Agregar
              </motion.button>
            </div>
            {(!form.addons || form.addons.length === 0) ? (
              <p className="text-xs text-slate-400">Sin adicionales. Agregá uno con el botón.</p>
            ) : (
              <div className="space-y-2.5">
                {form.addons.map((addon, idx) => (
                  <div key={idx} className="flex items-end gap-2.5">
                    <FormField
                      className="flex-1"
                      label={idx === 0 ? 'Nombre' : undefined}
                      name={`addon-name-${idx}`}
                      value={addon.name}
                      onChange={(e) => updateAddonRow(idx, 'name', e.target.value)}
                      placeholder="Nombre del adicional"
                    />
                    <FormField
                      className="w-36"
                      label={idx === 0 ? 'Precio' : undefined}
                      name={`addon-price-${idx}`}
                      type="number"
                      min={0}
                      prefix="₲"
                      value={addon.priceGs}
                      onChange={(e) => updateAddonRow(idx, 'priceGs', e.target.value)}
                      placeholder="0"
                    />
                    <motion.button
                      whileTap={tapIcon}
                      type="button"
                      onClick={() => removeAddonRow(idx)}
                      title="Eliminar adicional"
                      className="w-10 h-10 shrink-0 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={15} />
                    </motion.button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </FormModal>

      {/* Confirmar desactivación */}
      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        variant="danger"
        title="Desactivar servicio"
        confirmLabel="Desactivar"
        message={`¿Desactivar "${toDelete?.name}"? Dejará de mostrarse a los clientes. Podés reactivarlo después.`}
      />
    </div>
  );
}
