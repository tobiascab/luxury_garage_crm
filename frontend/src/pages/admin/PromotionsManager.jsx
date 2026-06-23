import { useState, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Ticket, Plus, Pencil, Trash2, Search, RefreshCcw,
  Percent, Banknote, Power, Tag,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatGs } from '../../constants/pricing';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import FormModal from '../../components/FormModal';
import FormField from '../../components/FormField';
import ConfirmDialog from '../../components/ConfirmDialog';
import { SkeletonTable } from '../../components/Skeleton';
import { DatePicker } from '../../components/DatePicker';

const EMPTY_FORM = {
  code: '', type: 'PERCENTAGE', value: '10',
  maxUses: '', validFrom: '', validUntil: '', isActive: true,
};

const todayStr = () => new Date().toISOString().split('T')[0];

function promoState(p) {
  if (!p.isActive) return { label: 'Inactiva', cls: 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400' };
  const now = new Date();
  if (p.validFrom && now < new Date(p.validFrom)) return { label: 'Programada', cls: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400' };
  if (p.validUntil && now > new Date(p.validUntil)) return { label: 'Expirada', cls: 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400' };
  if (p.maxUses && (p.usesCount || 0) >= p.maxUses) return { label: 'Agotada', cls: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' };
  return { label: 'Activa', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' };
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PromotionsManager() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapIcon = reduceMotion ? undefined : { scale: 0.9 };

  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [togglingId, setTogglingId] = useState(null);

  const loadPromos = async () => {
    setError(false);
    try {
      const r = await api.get('/promotions', { _noCache: true });
      setPromos(r.data.data || []);
    } catch (e) {
      setError(true);
      toast.error(e.response?.data?.message || 'No se pudieron cargar las promociones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPromos(); }, []);

  const refresh = () => { setLoading(true); loadPromos(); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return promos;
    return promos.filter((p) => p.code.toLowerCase().includes(q));
  }, [promos, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, validFrom: todayStr() });
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      code: p.code,
      type: p.type || 'PERCENTAGE',
      value: String(p.value ?? ''),
      maxUses: p.maxUses != null ? String(p.maxUses) : '',
      validFrom: p.validFrom ? p.validFrom.split('T')[0] : '',
      validUntil: p.validUntil ? p.validUntil.split('T')[0] : '',
      isActive: p.isActive,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.code.trim()) errs.code = 'Ingresá un código';
    const value = Number(form.value);
    if (form.value === '' || Number.isNaN(value) || value <= 0 || !Number.isInteger(value))
      errs.value = 'Valor inválido';
    else if (form.type === 'PERCENTAGE' && value > 100)
      errs.value = 'Máximo 100%';
    if (form.maxUses !== '') {
      const m = Number(form.maxUses);
      if (Number.isNaN(m) || m <= 0 || !Number.isInteger(m)) errs.maxUses = 'Límite inválido';
    }
    if (!form.validUntil) errs.validUntil = 'Indicá la fecha de cierre';
    if (form.validFrom && form.validUntil && form.validUntil < form.validFrom)
      errs.validUntil = 'No puede ser anterior al inicio';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: parseInt(form.value, 10),
      maxUses: form.maxUses === '' ? null : parseInt(form.maxUses, 10),
      validFrom: form.validFrom || todayStr(),
      validUntil: form.validUntil,
      isActive: form.isActive,
    };
    try {
      if (editing) {
        await api.put(`/promotions/${editing.id}`, payload);
        toast.success('Promoción actualizada');
      } else {
        await api.post('/promotions', payload);
        toast.success('Promoción creada');
      }
      api.invalidate('/promotions');
      setModalOpen(false);
      setEditing(null);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar la promoción');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/promotions/${toDelete.id}`);
      api.invalidate('/promotions');
      toast.success('Promoción eliminada');
      setToDelete(null);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (p) => {
    setTogglingId(p.id);
    const next = !p.isActive;
    setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, isActive: next } : x)));
    try {
      await api.put(`/promotions/${p.id}`, { isActive: next });
      api.invalidate('/promotions');
      toast.success(next ? 'Promoción activada' : 'Promoción desactivada');
    } catch (err) {
      setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, isActive: p.isActive } : x)));
      toast.error(err.response?.data?.message || 'No se pudo actualizar');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="page-content pb-16">
      <PageHeader
        title="Promociones"
        subtitle="Cupones de descuento, vigencia y límites de uso"
        actions={
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={tapIcon}
              onClick={refresh}
              title="Actualizar"
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors"
            >
              <RefreshCcw size={16} />
            </motion.button>
            <motion.button
              whileTap={tap}
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-colors"
            >
              <Plus size={16} /> Nueva promoción
            </motion.button>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`}
            size={16}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar por código…"
            className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
              searchFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl">
          <EmptyState icon="⚠️" title="Error al cargar" message="No se pudieron obtener las promociones." action="Reintentar" onAction={refresh} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl">
          <EmptyState
            icon="🎟️"
            title={promos.length === 0 ? 'Sin promociones' : 'Sin resultados'}
            message={promos.length === 0 ? 'Creá tu primer cupón de descuento.' : 'No hay códigos que coincidan con la búsqueda.'}
            action={promos.length === 0 ? 'Nueva promoción' : undefined}
            onAction={promos.length === 0 ? openCreate : undefined}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-white/[0.02] text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-3.5 font-medium">Código</th>
                  <th className="text-left px-5 py-3.5 font-medium">Beneficio</th>
                  <th className="text-left px-5 py-3.5 font-medium">Usos</th>
                  <th className="text-left px-5 py-3.5 font-medium">Vigencia</th>
                  <th className="text-left px-5 py-3.5 font-medium">Estado</th>
                  <th className="text-right px-5 py-3.5 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const st = promoState(p);
                  const isPct = p.type === 'PERCENTAGE';
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <span className="admin-itile admin-itile-amber w-8 h-8 rounded-lg shrink-0">
                            <Tag size={14} className="text-white" />
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white tracking-wide">{p.code}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-slate-900 dark:text-white font-medium">
                          {isPct ? <Percent size={13} className="text-amber-500" /> : <Banknote size={13} className="text-amber-500" />}
                          {isPct ? `${p.value}%` : formatGs(p.value)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300 tabular-nums">
                        {(p.usesCount || 0)}{p.maxUses ? ` / ${p.maxUses}` : ' / ∞'}
                      </td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs">
                        {fmtDate(p.validFrom)} — {fmtDate(p.validUntil)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <motion.button
                            whileTap={togglingId === p.id ? undefined : tapIcon}
                            onClick={() => toggleActive(p)}
                            disabled={togglingId === p.id}
                            title={p.isActive ? 'Desactivar' : 'Activar'}
                            className={`w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center transition-colors disabled:opacity-50 ${
                              p.isActive ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10' : 'text-slate-400 hover:text-emerald-600'
                            }`}
                          >
                            <Power size={15} />
                          </motion.button>
                          <motion.button
                            whileTap={tapIcon}
                            onClick={() => openEdit(p)}
                            title="Editar"
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 flex items-center justify-center transition-colors"
                          >
                            <Pencil size={15} />
                          </motion.button>
                          <motion.button
                            whileTap={tapIcon}
                            onClick={() => setToDelete(p)}
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
        title={editing ? 'Editar promoción' : 'Nueva promoción'}
        subtitle={editing ? 'Actualizá los datos del cupón' : 'Configurá un nuevo cupón de descuento'}
        icon={<Ticket size={18} />}
        formId="promotion-form"
        submitting={saving}
        submitLabel={editing ? 'Guardar cambios' : 'Crear'}
        size="lg"
      >
        <form id="promotion-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Código" name="code" value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              required error={formErrors.code} placeholder="EJ: VERANO2026"
            />
            <FormField as="select" label="Tipo de descuento" name="type" value={form.type} onChange={setField('type')}>
              <option value="PERCENTAGE">Porcentaje (%)</option>
              <option value="FIXED">Monto fijo (₲)</option>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label={form.type === 'PERCENTAGE' ? 'Valor del descuento (%)' : 'Monto del descuento'}
              name="value" type="number" min={1} value={form.value} onChange={setField('value')}
              required error={formErrors.value}
              prefix={form.type === 'PERCENTAGE' ? '%' : '₲'}
            />
            <FormField
              label="Límite de usos" name="maxUses" type="number" min={1} value={form.maxUses}
              onChange={setField('maxUses')} error={formErrors.maxUses}
              hint={!formErrors.maxUses ? 'Vacío = ilimitado' : undefined}
              placeholder="Ilimitado"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="validFrom" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Inicio de vigencia
              </label>
              <DatePicker
                id="validFrom"
                value={form.validFrom}
                onChange={(v) => setForm((f) => ({ ...f, validFrom: v }))}
                placeholder="Seleccionar fecha"
              />
              <p className="text-xs text-slate-400">Por defecto, hoy</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="validUntil" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Fin de vigencia
                <span className="text-rose-500 ml-0.5">*</span>
              </label>
              <DatePicker
                id="validUntil"
                value={form.validUntil}
                onChange={(v) => setForm((f) => ({ ...f, validUntil: v }))}
                min={form.validFrom || undefined}
                placeholder="Seleccionar fecha"
              />
              {formErrors.validUntil && <p className="text-xs text-rose-500">{formErrors.validUntil}</p>}
            </div>
          </div>

          <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 rounded accent-indigo-600"
            />
            <div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Activar inmediatamente</span>
              <p className="text-xs text-slate-400">Si la desactivás, no podrá canjearse hasta reactivarla.</p>
            </div>
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
        title="Eliminar promoción"
        message={`¿Seguro que querés eliminar el cupón "${toDelete?.code}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
