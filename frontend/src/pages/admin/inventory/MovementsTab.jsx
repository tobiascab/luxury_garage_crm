import { useState, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeftRight, Plus, RefreshCcw, Info, ChevronDown,
  ArrowDownToLine, SlidersHorizontal, Trash2 as WasteIcon, Undo2,
} from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import EmptyState from '../../../components/EmptyState';
import FormModal from '../../../components/FormModal';
import FormField from '../../../components/FormField';
import { SkeletonTable } from '../../../components/Skeleton';

// Tipos registrables manualmente (CONSUMPTION es automático).
const MOVEMENT_TYPES = [
  { value: 'IN', label: 'Entrada / compra', icon: ArrowDownToLine },
  { value: 'ADJUSTMENT', label: 'Ajuste', icon: SlidersHorizontal },
  { value: 'WASTE', label: 'Merma', icon: WasteIcon },
  { value: 'RETURN', label: 'Devolución', icon: Undo2 },
];

const TYPE_META = {
  IN: { label: 'Entrada', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  CONSUMPTION: { label: 'Consumo', cls: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400' },
  ADJUSTMENT: { label: 'Ajuste', cls: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
  WASTE: { label: 'Merma', cls: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' },
  RETURN: { label: 'Devolución', cls: 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400' },
};

const FILTER_TYPES = [
  { value: 'IN', label: 'Entrada' },
  { value: 'CONSUMPTION', label: 'Consumo' },
  { value: 'ADJUSTMENT', label: 'Ajuste' },
  { value: 'WASTE', label: 'Merma' },
  { value: 'RETURN', label: 'Devolución' },
];

const EMPTY_FORM = {
  itemId: '', type: 'IN', quantity: '', reason: '', unitCostGs: '', supplierId: '',
};

function TypeBadge({ type }) {
  const meta = TYPE_META[type] || { label: type, cls: 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

const fmtDate = (v) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('es-PY', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

export default function MovementsTab() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapSmall = reduceMotion ? undefined : { scale: 0.9 };

  const [movements, setMovements] = useState([]);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [itemFilter, setItemFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [itemFocused, setItemFocused] = useState(false);
  const [typeFocused, setTypeFocused] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const loadMovements = async () => {
    setError(false);
    try {
      const params = {};
      if (itemFilter) params.itemId = itemFilter;
      if (typeFilter) params.type = typeFilter;
      const res = await api.get('/inventory/movements', { params, _noCache: true });
      setMovements(res.data.data || []);
    } catch (e) {
      setError(true);
      toast.error(e.response?.data?.message || 'No se pudieron cargar los movimientos');
    } finally {
      setLoading(false);
    }
  };

  // Catálogos para filtros y modal (insumos + proveedores)
  const loadCatalogs = async () => {
    try {
      const [itemsRes, supRes] = await Promise.all([
        api.get('/inventory', { params: { limit: 200 } }),
        api.get('/inventory/suppliers').catch(() => ({ data: { data: [] } })),
      ]);
      setItems(itemsRes.data.data || []);
      setSuppliers(supRes.data.data || []);
    } catch {
      // no bloquea la tabla
    }
  };

  useEffect(() => { loadCatalogs(); }, []);
  useEffect(() => { setLoading(true); loadMovements(); }, [itemFilter, typeFilter]);

  const refresh = () => { setLoading(true); loadMovements(); };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.itemId) errs.itemId = 'Elegí un insumo';
    if (!form.type) errs.type = 'Elegí un tipo';
    const qty = Number(form.quantity);
    if (form.quantity === '' || Number.isNaN(qty) || qty <= 0 || !Number.isInteger(qty))
      errs.quantity = 'Cantidad inválida (entero positivo)';
    if (form.unitCostGs !== '') {
      const c = Number(form.unitCostGs);
      if (Number.isNaN(c) || c < 0 || !Number.isInteger(c)) errs.unitCostGs = 'Costo inválido';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      itemId: form.itemId,
      type: form.type,
      quantity: parseInt(form.quantity, 10),
      reason: form.reason.trim() || undefined,
    };
    if (form.type === 'IN' && form.unitCostGs !== '') payload.unitCostGs = parseInt(form.unitCostGs, 10);
    if (form.supplierId) payload.supplierId = form.supplierId;
    try {
      await api.post('/inventory/movements', payload);
      api.invalidate('/inventory');
      toast.success('Movimiento registrado');
      setModalOpen(false);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo registrar el movimiento');
    } finally {
      setSaving(false);
    }
  };

  const isIn = form.type === 'IN';

  const itemsById = useMemo(() => {
    const m = {};
    for (const it of items) m[it.id] = it;
    return m;
  }, [items]);

  return (
    <div>
      {/* Aviso movimientos automáticos */}
      <div className="flex items-start gap-2.5 mb-4 px-4 py-3 rounded-xl bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/20">
        <Info size={16} className="text-sky-500 mt-0.5 shrink-0" />
        <p className="text-xs text-sky-700 dark:text-sky-300">
          Los movimientos de tipo <span className="font-semibold">Consumo</span> se generan
          automáticamente al completar servicios y no se registran manualmente desde aquí.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <select
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
            onFocus={() => setItemFocused(true)}
            onBlur={() => setItemFocused(false)}
            className={`w-full appearance-none bg-white dark:bg-slate-900 border rounded-xl pl-3 pr-9 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none transition-all duration-200 cursor-pointer ${
              itemFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          >
            <option value="">Todos los insumos</option>
            {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
          </select>
          <motion.span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            animate={{ rotate: itemFocused ? 180 : 0, color: itemFocused ? 'var(--color-primary)' : '#94a3b8' }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 24 }}
          >
            <ChevronDown size={16} />
          </motion.span>
        </div>
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            onFocus={() => setTypeFocused(true)}
            onBlur={() => setTypeFocused(false)}
            className={`w-full appearance-none bg-white dark:bg-slate-900 border rounded-xl pl-3 pr-9 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none transition-all duration-200 cursor-pointer ${
              typeFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          >
            <option value="">Todos los tipos</option>
            {FILTER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <motion.span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            animate={{ rotate: typeFocused ? 180 : 0, color: typeFocused ? 'var(--color-primary)' : '#94a3b8' }}
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
          <Plus size={16} /> Registrar movimiento
        </motion.button>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl">
          <EmptyState icon="⚠️" title="Error al cargar" message="No se pudieron obtener los movimientos." action="Reintentar" onAction={refresh} />
        </div>
      ) : movements.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl">
          <EmptyState
            icon="🔁"
            title="Sin movimientos"
            message={(itemFilter || typeFilter) ? 'No hay movimientos con esos filtros.' : 'Registrá una entrada para empezar el historial.'}
            action={(itemFilter || typeFilter) ? undefined : 'Registrar movimiento'}
            onAction={(itemFilter || typeFilter) ? undefined : openCreate}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-white/[0.02] text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-3.5 font-medium">Fecha</th>
                  <th className="text-left px-5 py-3.5 font-medium">Insumo</th>
                  <th className="text-left px-5 py-3.5 font-medium">Tipo</th>
                  <th className="text-center px-5 py-3.5 font-medium">Cantidad</th>
                  <th className="text-center px-5 py-3.5 font-medium">Antes → Después</th>
                  <th className="text-left px-5 py-3.5 font-medium">Motivo</th>
                  <th className="text-left px-5 py-3.5 font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((mv) => {
                  const unit = mv.item?.unit || '';
                  const before = mv.quantityBefore;
                  const after = mv.quantityAfter;
                  const signed = mv.type === 'IN' || mv.type === 'RETURN';
                  const user = mv.user ? `${mv.user.firstName || ''} ${mv.user.lastName || ''}`.trim() : '';
                  return (
                    <tr
                      key={mv.id}
                      className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                        {fmtDate(mv.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-medium text-slate-900 dark:text-white truncate block max-w-[180px]">
                          {mv.item?.name || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4"><TypeBadge type={mv.type} /></td>
                      <td className="px-5 py-4 text-center tabular-nums font-medium text-slate-900 dark:text-white">
                        <span className={signed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {signed ? '+' : '−'}{mv.quantity}
                        </span>
                        {unit && <span className="text-[10px] text-slate-400 ml-1">{unit}</span>}
                      </td>
                      <td className="px-5 py-4 text-center text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        {before != null && after != null ? (
                          <>{before} <span className="text-slate-300 dark:text-slate-600">→</span> <span className="font-medium text-slate-700 dark:text-slate-200">{after}</span></>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate block max-w-[200px]">
                          {mv.reason || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{user || '—'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal registrar movimiento */}
      <FormModal
        isOpen={modalOpen}
        onClose={() => { if (!saving) setModalOpen(false); }}
        title="Registrar movimiento"
        subtitle="Entrada, ajuste, merma o devolución de stock"
        icon={<ArrowLeftRight size={18} />}
        formId="movement-form"
        submitting={saving}
        submitLabel="Registrar"
        size="md"
      >
        <form id="movement-form" onSubmit={handleSubmit} className="space-y-4">
          <FormField as="select" label="Insumo" name="itemId" value={form.itemId} onChange={setField('itemId')} required error={formErrors.itemId}>
            <option value="">Elegí un insumo…</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{it.name} ({it.currentStock} {it.unit})</option>
            ))}
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField as="select" label="Tipo" name="type" value={form.type} onChange={setField('type')} required error={formErrors.type}>
              {MOVEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </FormField>
            <FormField
              label="Cantidad" name="quantity" type="number" min={1} value={form.quantity}
              onChange={setField('quantity')} required error={formErrors.quantity}
              hint={!formErrors.quantity && form.itemId ? `Stock actual: ${itemsById[form.itemId]?.currentStock ?? '—'}` : undefined}
            />
          </div>
          {isIn && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Costo unitario" name="unitCostGs" type="number" min={0} value={form.unitCostGs}
                onChange={setField('unitCostGs')} error={formErrors.unitCostGs} prefix="₲"
                placeholder="Opcional"
              />
              <FormField as="select" label="Proveedor" name="supplierId" value={form.supplierId} onChange={setField('supplierId')}>
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </FormField>
            </div>
          )}
          <FormField
            as="textarea" label="Motivo" name="reason" value={form.reason} onChange={setField('reason')}
            rows={2} placeholder="Detalle del movimiento (opcional)"
          />
        </form>
      </FormModal>
    </div>
  );
}
