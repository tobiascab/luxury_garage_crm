import { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ClipboardList, Plus, Pencil, Trash2, RotateCcw,
  Percent, Check, X, PlusCircle, RefreshCcw, CreditCard,
  Layers, Sparkles, Infinity as InfinityIcon, Package,
  Minus,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatGs } from '../../constants/pricing';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import { SkeletonCard } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import AnimatedNumber from '../../components/AnimatedNumber';

const BILLING = [
  { value: 'monthly', label: 'Mensual', short: '/ mes' },
  { value: 'quarterly', label: 'Trimestral', short: '/ trimestre' },
  { value: 'yearly', label: 'Anual', short: '/ año' },
];
const billingShort = (v) => BILLING.find((b) => b.value === v)?.short || '';
const billingLabel = (v) => BILLING.find((b) => b.value === v)?.label || v;

// Normaliza features (en DB es Json: puede venir array o no).
const featuresOf = (p) => (Array.isArray(p.features) ? p.features.filter(Boolean) : []);
// Normaliza servicesIncluded (en DB es Json: puede venir number o array de cobertura).
const servicesCount = (p) => {
  if (typeof p.servicesIncluded === 'number') return p.servicesIncluded;
  if (Array.isArray(p.servicesIncluded)) return p.servicesIncluded.length;
  return null;
};
// Normaliza la cobertura desde plan.servicesIncluded (solo si ya es array de cobertura).
const coverageOf = (p) =>
  Array.isArray(p?.servicesIncluded)
    ? p.servicesIncluded
        .filter((c) => c && typeof c === 'object' && c.slug)
        .map((c) => ({
          slug: c.slug,
          quota: typeof c.quota === 'number' ? c.quota : 4,
          includedAddons:
            c.includedAddons === 'all'
              ? 'all'
              : Array.isArray(c.includedAddons)
              ? c.includedAddons.filter(Boolean)
              : [],
        }))
    : [];

const EMPTY_FORM = {
  name: '', description: '', priceGs: '', billingPeriod: 'monthly',
  discountPercent: 0, sortOrder: 0, isActive: true,
  features: [], coverage: [],
};

export default function PlansManager() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapIcon = reduceMotion ? undefined : { scale: 0.9 };

  const [plans, setPlans] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [quotaFocus, setQuotaFocus] = useState(null);

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
      const r = await api.get('/plans', { params: { includeInactive: true }, _noCache: true });
      setPlans(r.data.data || []);
    } catch (e) {
      setError(true);
      toast.error(e.response?.data?.message || 'No se pudieron cargar los planes');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadServices = useCallback(async () => {
    try {
      const r = await api.get('/services', { _noCache: true });
      setServices(r.data.data || []);
    } catch {
      // Sin servicios no se puede configurar la cobertura; el resto del form sigue usable.
      setServices([]);
    }
  }, []);

  useEffect(() => { load(); loadServices(); }, [load, loadServices]);

  // ── feature editor ────────────────────────────────────────────────────
  const addFeature = () =>
    setForm((prev) => ({ ...prev, features: [...(prev.features || []), ''] }));
  const updateFeature = (idx, value) =>
    setForm((prev) => {
      const next = [...(prev.features || [])];
      next[idx] = value;
      return { ...prev, features: next };
    });
  const removeFeature = (idx) =>
    setForm((prev) => ({ ...prev, features: (prev.features || []).filter((_, i) => i !== idx) }));

  // ── coverage editor (qué incluye el plan) ─────────────────────────────
  const coverageFor = (slug) => (form.coverage || []).find((c) => c.slug === slug) || null;

  // Reemplaza inmutablemente la entrada de cobertura de un slug usando un updater.
  const setCoverageEntry = (slug, updater) =>
    setForm((prev) => ({
      ...prev,
      coverage: (prev.coverage || []).map((c) => (c.slug === slug ? updater(c) : c)),
    }));

  const toggleService = (slug, on) =>
    setForm((prev) => {
      const rest = (prev.coverage || []).filter((c) => c.slug !== slug);
      return {
        ...prev,
        coverage: on ? [...rest, { slug, quota: 4, includedAddons: [] }] : rest,
      };
    });

  const setQuota = (slug, value) =>
    setCoverageEntry(slug, (c) => ({ ...c, quota: Math.max(1, Math.floor(Number(value) || 1)) }));

  const toggleUnlimited = (slug, unlimited) =>
    setCoverageEntry(slug, (c) => ({ ...c, quota: unlimited ? -1 : 4 }));

  const toggleAllAddons = (slug, all) =>
    setCoverageEntry(slug, (c) => ({ ...c, includedAddons: all ? 'all' : [] }));

  const toggleAddonKey = (slug, key) =>
    setCoverageEntry(slug, (c) => {
      const current = Array.isArray(c.includedAddons) ? c.includedAddons : [];
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
      return { ...c, includedAddons: next };
    });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || '',
      priceGs: p.priceGs ?? '',
      billingPeriod: p.billingPeriod || 'monthly',
      discountPercent: p.discountPercent || 0,
      sortOrder: p.sortOrder || 0,
      isActive: !!p.isActive,
      features: featuresOf(p),
      coverage: coverageOf(p),
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Nombre requerido';
    const price = Number(form.priceGs);
    if (!price || price <= 0) e.priceGs = 'Precio debe ser mayor a 0';
    const disc = Number(form.discountPercent);
    if (disc < 0 || disc > 100) e.discountPercent = 'Entre 0 y 100';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Cobertura limpia para el payload: quota entero (-1 = ilimitado), includedAddons 'all' | array.
  const cleanCoverage = () =>
    (form.coverage || [])
      .filter((c) => c && c.slug)
      .map((c) => ({
        slug: c.slug,
        quota: c.quota === -1 ? -1 : Math.max(1, Math.floor(Number(c.quota) || 1)),
        includedAddons:
          c.includedAddons === 'all'
            ? 'all'
            : Array.isArray(c.includedAddons)
            ? c.includedAddons.filter(Boolean)
            : [],
      }));

  const buildPayload = () => ({
    name: form.name.trim(),
    description: form.description?.trim() || undefined,
    priceGs: Number(form.priceGs),
    billingPeriod: form.billingPeriod,
    servicesIncluded: cleanCoverage(),
    discountPercent: Number(form.discountPercent) || 0,
    sortOrder: Number(form.sortOrder) || 0,
    isActive: !!form.isActive,
    features: (form.features || []).map((f) => (f || '').trim()).filter(Boolean),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (editing) {
        await api.put(`/plans/${editing.id}`, payload);
        toast.success('Plan actualizado');
      } else {
        await api.post('/plans', payload);
        toast.success('Plan creado');
      }
      api.invalidate('/plans');
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar el plan');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/plans/${toDelete.id}`);
      toast.success('Plan desactivado');
      api.invalidate('/plans');
      setToDelete(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo desactivar');
    } finally {
      setDeleting(false);
    }
  };

  const reactivate = async (p) => {
    try {
      await api.put(`/plans/${p.id}`, { isActive: true });
      toast.success('Plan reactivado');
      api.invalidate('/plans');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo reactivar');
    }
  };

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div className="page-content pb-16">
      {/* Header */}
      <div className="admin-page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="admin-itile admin-itile-violet w-10 h-10">
            <ClipboardList size={20} className="text-white" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Planes y membresías</h1>
            <p className="text-sm text-slate-500">Definí los planes de suscripción y sus beneficios</p>
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
            <Plus size={16} /> Nuevo plan
          </motion.button>
        </div>
      </div>

      {/* Estados */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <EmptyState icon="⚠️" title="Error al cargar" message="No se pudieron obtener los planes." action="Reintentar" onAction={load} />
      ) : plans.length === 0 ? (
        <EmptyState icon="💳" title="No hay planes" message="Creá tu primer plan de membresía." action="Nuevo plan" onAction={openCreate} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((p) => {
            const feats = featuresOf(p);
            const sCount = servicesCount(p);
            return (
              <div
                key={p.id}
                className={`relative overflow-hidden flex flex-col bg-white dark:bg-slate-900 border rounded-2xl p-6 shadow-sm transition-colors ${
                  p.isActive ? 'border-slate-200 dark:border-white/10 admin-tint-violet' : 'border-slate-200 dark:border-white/10 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">{p.name}</h3>
                    <span className="text-xs text-slate-400">{billingLabel(p.billingPeriod)}</span>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      p.isActive
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {p.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="mb-4">
                  <AnimatedNumber className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums" value={p.priceGs} format="gs" />
                  <span className="text-sm text-slate-400 ml-1">{billingShort(p.billingPeriod)}</span>
                </div>

                {p.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">{p.description}</p>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                  {p.discountPercent > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <Percent size={12} /> {p.discountPercent}% en extras
                    </span>
                  )}
                  {sCount != null && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
                      <CreditCard size={12} /> {sCount} servicio(s)/ciclo
                    </span>
                  )}
                </div>

                {feats.length > 0 && (
                  <ul className="space-y-1.5 mb-5">
                    {feats.slice(0, 5).map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <Check size={15} className="text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
                        <span className="leading-snug">{f}</span>
                      </li>
                    ))}
                    {feats.length > 5 && (
                      <li className="text-xs text-slate-400 pl-7">+{feats.length - 5} más</li>
                    )}
                  </ul>
                )}

                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-white/5 flex items-center gap-2">
                  <motion.button
                    whileTap={tap}
                    onClick={() => openEdit(p)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                  >
                    <Pencil size={14} /> Editar
                  </motion.button>
                  {p.isActive ? (
                    <motion.button
                      whileTap={tapIcon}
                      onClick={() => setToDelete(p)}
                      title="Desactivar"
                      className="w-10 h-10 shrink-0 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={15} />
                    </motion.button>
                  ) : (
                    <motion.button
                      whileTap={tapIcon}
                      onClick={() => reactivate(p)}
                      title="Reactivar"
                      className="w-10 h-10 shrink-0 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 flex items-center justify-center transition-colors"
                    >
                      <RotateCcw size={15} />
                    </motion.button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar plan' : 'Nuevo plan'}
        subtitle="Configuración de la membresía"
        icon={<ClipboardList size={18} />}
        formId="plan-form"
        submitting={submitting}
        submitLabel={editing ? 'Guardar cambios' : 'Crear plan'}
        size="lg"
      >
        <form id="plan-form" onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Nombre del plan"
            name="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
            placeholder="Ej: Plan Premium"
          />

          <FormField
            as="textarea"
            label="Descripción"
            name="description"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Resumen del alcance del plan…"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Precio (₲)"
              name="priceGs"
              type="number"
              min={0}
              required
              prefix="₲"
              value={form.priceGs}
              onChange={(e) => setForm({ ...form, priceGs: e.target.value })}
              error={errors.priceGs}
            />
            <FormField
              as="select"
              label="Período de facturación"
              name="billingPeriod"
              value={form.billingPeriod}
              onChange={(e) => setForm({ ...form, billingPeriod: e.target.value })}
            >
              {BILLING.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Descuento (%)"
              name="discountPercent"
              type="number"
              min={0}
              max={100}
              value={form.discountPercent}
              onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
              error={errors.discountPercent}
              hint="En servicios extra."
            />
            <FormField
              label="Orden"
              name="sortOrder"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              hint="Menor = primero."
            />
          </div>

          <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 rounded accent-emerald-600"
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">Plan activo (visible para clientes)</span>
          </label>

          {/* ¿Qué incluye este plan? — cobertura granular por servicio */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers size={15} className="text-indigo-600" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">¿Qué incluye este plan?</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Elegí qué servicios cubre el plan, su cupo mensual y qué adicionales quedan incluidos.
            </p>

            {services.length === 0 ? (
              <p className="text-xs text-slate-400">No hay servicios disponibles para configurar.</p>
            ) : (
              <div className="space-y-2.5">
                {services.map((svc) => {
                  const cov = coverageFor(svc.slug);
                  const included = !!cov;
                  const unlimited = included && cov.quota === -1;
                  const allAddons = included && cov.includedAddons === 'all';
                  const addons = Array.isArray(svc.addons) ? svc.addons : [];
                  const chosenAddons = included && Array.isArray(cov.includedAddons) ? cov.includedAddons : [];
                  return (
                    <div
                      key={svc.id ?? svc.slug}
                      className={`rounded-xl border p-3.5 transition-colors ${
                        included
                          ? 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-500/5'
                          : 'border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-slate-800/40'
                      }`}
                    >
                      {/* Toggle incluir servicio */}
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={(e) => toggleService(svc.slug, e.target.checked)}
                          className="w-4 h-4 rounded accent-indigo-600"
                        />
                        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                          <Package size={14} className="text-slate-400" />
                          {svc.name}
                        </span>
                      </label>

                      {included && (
                        <div className="mt-3 pl-7 space-y-3">
                          {/* Cupo mensual */}
                          <div>
                            <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                              Cupo mensual
                            </span>
                            <div className="flex items-center gap-3 flex-wrap">
                              {unlimited ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                                  <InfinityIcon size={15} /> Ilimitado
                                </span>
                              ) : (
                                <div className="relative w-28">
                                  <motion.button
                                    type="button"
                                    tabIndex={-1}
                                    aria-label="Disminuir"
                                    whileTap={tapIcon}
                                    disabled={Number(cov.quota) <= 1}
                                    onClick={() => setQuota(svc.slug, Number(cov.quota) - 1)}
                                    className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                  >
                                    <Minus size={14} />
                                  </motion.button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={cov.quota}
                                    onChange={(e) => setQuota(svc.slug, e.target.value)}
                                    onFocus={() => setQuotaFocus(svc.slug)}
                                    onBlur={() => setQuotaFocus(null)}
                                    className={`w-full bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-center px-8 py-2 text-sm text-slate-900 dark:text-white focus:outline-none transition-all duration-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                                      quotaFocus === svc.slug
                                        ? 'border-primary ring-2 ring-primary/15'
                                        : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                                    }`}
                                  />
                                  <motion.button
                                    type="button"
                                    tabIndex={-1}
                                    aria-label="Aumentar"
                                    whileTap={tapIcon}
                                    onClick={() => setQuota(svc.slug, Number(cov.quota) + 1)}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
                                  >
                                    <Plus size={14} />
                                  </motion.button>
                                </div>
                              )}
                              {!unlimited && (
                                <span className="text-xs text-slate-400">servicios / mes</span>
                              )}
                              <label className="flex items-center gap-2 cursor-pointer ml-auto">
                                <input
                                  type="checkbox"
                                  checked={unlimited}
                                  onChange={(e) => toggleUnlimited(svc.slug, e.target.checked)}
                                  className="w-4 h-4 rounded accent-indigo-600"
                                />
                                <span className="text-xs text-slate-600 dark:text-slate-300">Ilimitado</span>
                              </label>
                            </div>
                          </div>

                          {/* Adicionales incluidos */}
                          {addons.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between gap-3 mb-1.5">
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                  <Sparkles size={13} className="text-amber-500" /> Adicionales incluidos
                                </span>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={allAddons}
                                    onChange={(e) => toggleAllAddons(svc.slug, e.target.checked)}
                                    className="w-4 h-4 rounded accent-indigo-600"
                                  />
                                  <span className="text-xs text-slate-600 dark:text-slate-300">Todos incluidos</span>
                                </label>
                              </div>

                              {allAddons ? (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                  Todos los adicionales de este servicio quedan incluidos sin costo.
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {addons.map((ad) => {
                                    const on = chosenAddons.includes(ad.key);
                                    return (
                                      <motion.label
                                        key={ad.key}
                                        whileTap={tap}
                                        className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                          on
                                            ? 'border-indigo-300 dark:border-indigo-500/40 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                                            : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-indigo-200'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={on}
                                          onChange={() => toggleAddonKey(svc.slug, ad.key)}
                                          className="w-3.5 h-3.5 rounded accent-indigo-600"
                                        />
                                        <span className="font-medium">{ad.name}</span>
                                        <span className="text-slate-400">+{formatGs(ad.priceGs)}</span>
                                      </motion.label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Beneficios */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Beneficios</span>
              <motion.button
                whileTap={tap}
                type="button"
                onClick={addFeature}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
              >
                <PlusCircle size={14} /> Agregar
              </motion.button>
            </div>
            {(!form.features || form.features.length === 0) ? (
              <p className="text-xs text-slate-400">Sin beneficios. Agregá uno con el botón.</p>
            ) : (
              <div className="space-y-2.5">
                {form.features.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    <div className="flex-1">
                      <FormField
                        name={`feature-${idx}`}
                        value={f}
                        onChange={(e) => updateFeature(idx, e.target.value)}
                        placeholder="Ej: Lavados exteriores ilimitados"
                      />
                    </div>
                    <motion.button
                      whileTap={tapIcon}
                      type="button"
                      onClick={() => removeFeature(idx)}
                      title="Eliminar beneficio"
                      className="w-10 h-10 shrink-0 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                    >
                      <X size={16} />
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
        title="Desactivar plan"
        confirmLabel="Desactivar"
        message={`¿Desactivar "${toDelete?.name}"? Dejará de ofrecerse a nuevos clientes. Podés reactivarlo después.`}
      />
    </div>
  );
}
