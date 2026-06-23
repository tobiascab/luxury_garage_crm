import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import {
  Plus, Pencil, Trash2, Search, Wallet, RefreshCcw, Receipt,
  Tag, Calendar, Layers, ChevronLeft, ChevronRight, TrendingDown,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatGs } from '../../constants/pricing';
import FormModal from '../../components/FormModal';
import FormField from '../../components/FormField';
import ConfirmDialog from '../../components/ConfirmDialog';
import { SkeletonStats, SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import AnimatedNumber from '../../components/AnimatedNumber';
import { DatePicker } from '../../components/DatePicker';

// ── Helpers ────────────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);

// Primer y último día del mes actual en formato ISO (yyyy-mm-dd)
const monthStartISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'check', label: 'Cheque' },
  { value: 'other', label: 'Otro' },
];
const methodLabel = (m) => PAYMENT_METHODS.find((x) => x.value === m)?.label || (m ? m.replace(/_/g, ' ') : '—');

const EMPTY_FORM = {
  date: todayISO(),
  amountGs: '',
  description: '',
  categoryId: '',
  supplier: '',
  paymentMethod: '',
  ivaGs: '',
  notes: '',
};

const FALLBACK_COLOR = '#6366f1';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ExpensesManager() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapIcon = reduceMotion ? undefined : { scale: 0.9 };

  // ── Stats ──
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // ── Categories ──
  const [categories, setCategories] = useState([]);

  // ── Expenses table ──
  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [catFilterFocused, setCatFilterFocused] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromDate, setFromDate] = useState(monthStartISO());
  const [toDate, setToDate] = useState(todayISO());
  const [page, setPage] = useState(1);

  // ── Expense modal ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [catSelectFocused, setCatSelectFocused] = useState(false);

  // ── Category modal ──
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', color: FALLBACK_COLOR });
  const [catError, setCatError] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  // ── Delete ──
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load categories ──
  const loadCategories = useCallback(async () => {
    try {
      const res = await api.get('/accounting/expense-categories', { _noCache: true });
      setCategories(res.data.data || []);
    } catch {
      // las categorías son secundarias; no rompemos la vista por esto
    }
  }, []);

  // ── Load stats ──
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await api.get('/accounting/expenses/summary', {
        _noCache: true,
        params: { from: fromDate || undefined, to: toDate || undefined },
      });
      setStats(res.data.data || {});
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, [fromDate, toDate]);

  // ── Load expenses ──
  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/expenses', {
        _noCache: true,
        params: {
          page,
          limit: 20,
          from: fromDate || undefined,
          to: toDate || undefined,
          categoryId: categoryFilter || undefined,
          search: debouncedSearch || undefined,
        },
      });
      setExpenses(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo cargar la lista de egresos');
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [page, fromDate, toDate, categoryFilter, debouncedSearch]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const refreshAll = () => {
    api.invalidate('/accounting/expenses', '/accounting/expense-categories');
    loadCategories();
    loadStats();
    loadExpenses();
  };

  const categoryMap = useMemo(() => {
    const m = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  // ── Expense form handlers ──
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id || '' });
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (ex) => {
    setEditing(ex);
    setForm({
      date: ex.date ? new Date(ex.date).toISOString().slice(0, 10) : todayISO(),
      amountGs: String(ex.amountGs ?? ''),
      description: ex.description || '',
      categoryId: ex.categoryId || '',
      supplier: ex.supplier || '',
      paymentMethod: ex.paymentMethod || '',
      ivaGs: ex.ivaGs != null ? String(ex.ivaGs) : '',
      notes: ex.notes || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.date) errs.date = 'Indicá la fecha';
    const amount = Number(form.amountGs);
    if (!form.amountGs || !Number.isFinite(amount) || amount <= 0)
      errs.amountGs = 'Ingresá un monto válido en guaraníes';
    else if (!Number.isInteger(amount))
      errs.amountGs = 'El monto debe ser un entero (sin decimales)';
    if (!form.description.trim()) errs.description = 'Describí el egreso';
    if (!form.categoryId) errs.categoryId = 'Elegí una categoría';
    if (form.ivaGs !== '') {
      const iva = Number(form.ivaGs);
      if (!Number.isFinite(iva) || iva < 0 || !Number.isInteger(iva))
        errs.ivaGs = 'IVA inválido (entero ≥ 0)';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      date: form.date,
      amountGs: Number(form.amountGs),
      description: form.description.trim(),
      categoryId: form.categoryId,
      supplier: form.supplier.trim() || undefined,
      paymentMethod: form.paymentMethod || undefined,
      ivaGs: form.ivaGs !== '' ? Number(form.ivaGs) : undefined,
      notes: form.notes.trim() || undefined,
    };
    try {
      if (editing) {
        await api.put(`/accounting/expenses/${editing.id}`, payload);
        toast.success('Egreso actualizado');
      } else {
        await api.post('/accounting/expenses', payload);
        toast.success('Egreso registrado');
      }
      setModalOpen(false);
      setEditing(null);
      refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar el egreso');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/accounting/expenses/${toDelete.id}`);
      toast.success('Egreso eliminado');
      setToDelete(null);
      refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar el egreso');
    } finally {
      setDeleting(false);
    }
  };

  // ── Category form handlers ──
  const openCatModal = () => {
    setCatForm({ name: '', color: FALLBACK_COLOR });
    setCatError('');
    setCatModalOpen(true);
  };

  const handleCatSubmit = async (e) => {
    e.preventDefault();
    if (!catForm.name.trim()) {
      setCatError('Ingresá un nombre');
      return;
    }
    setSavingCat(true);
    try {
      const res = await api.post('/accounting/expense-categories', {
        name: catForm.name.trim(),
        color: catForm.color || undefined,
      });
      toast.success('Categoría creada');
      api.invalidate('/accounting/expense-categories');
      await loadCategories();
      const created = res.data?.data;
      setCatModalOpen(false);
      // Selecciona la categoría recién creada si el modal de egreso está abierto
      if (created?.id) setForm((f) => ({ ...f, categoryId: created.id }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo crear la categoría');
    } finally {
      setSavingCat(false);
    }
  };

  const s = stats || {};
  const byCategory = Array.isArray(s.byCategory) ? s.byCategory : [];
  const hasActiveFilters = !!(debouncedSearch || categoryFilter);

  return (
    <div className="page-content space-y-6 pb-16">
      {/* Header */}
      <div className="admin-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Egresos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gastos operativos del lavadero — montos en Guaraníes (₲)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Motion.button
            whileTap={tapIcon}
            onClick={refreshAll}
            title="Actualizar"
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors shrink-0"
          >
            <RefreshCcw size={16} />
          </Motion.button>
          <Motion.button
            whileTap={tap}
            onClick={openCatModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors shrink-0"
          >
            <Tag size={16} /> Categoría
          </Motion.button>
          <Motion.button
            whileTap={tap}
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-colors shrink-0"
          >
            <Plus size={16} /> Nuevo egreso
          </Motion.button>
        </div>
      </div>

      {/* Date range */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Desde</label>
          <DatePicker
            value={fromDate}
            max={toDate || undefined}
            onChange={(v) => { setFromDate(v); setPage(1); }}
            placeholder="Desde"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Hasta</label>
          <DatePicker
            value={toDate}
            min={fromDate || undefined}
            onChange={(v) => { setToDate(v); setPage(1); }}
            placeholder="Hasta"
          />
        </div>
      </div>

      {/* Stats */}
      {loadingStats ? (
        <SkeletonStats count={3} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ExpenseCard
            label="Total egresos (período)"
            value={<AnimatedNumber value={s.totalGs} format="gs" />}
            sub={`${s.count || 0} movimientos`}
            icon={<TrendingDown size={18} />}
            color="rose"
          />
          <ExpenseCard
            label="IVA del período"
            value={<AnimatedNumber value={s.ivaGs} format="gs" />}
            sub="Crédito fiscal estimado"
            icon={<Receipt size={18} />}
            color="amber"
          />
          <ExpenseCard
            label="Categorías con gasto"
            value={<AnimatedNumber value={byCategory.length} format="int" />}
            sub={byCategory[0] ? `Mayor: ${byCategory[0].name}` : 'Sin datos'}
            icon={<Layers size={18} />}
            color="indigo"
          />
        </div>
      )}

      {/* By-category breakdown */}
      {!loadingStats && byCategory.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Gasto por categoría</h2>
          <div className="space-y-3">
            {byCategory.map((c) => {
              const pct = s.totalGs > 0 ? Math.round((c.totalGs / s.totalGs) * 100) : 0;
              const color = c.color || categoryMap[c.categoryId]?.color || FALLBACK_COLOR;
              return (
                <div key={c.categoryId || c.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      {c.name}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatGs(c.totalGs)} <span className="text-xs text-slate-400">· {pct}%</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`}
            size={16}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar por descripción o proveedor…"
            className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
              searchFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          />
        </div>
        <div className="relative sm:w-56">
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            onFocus={() => setCatFilterFocused(true)}
            onBlur={() => setCatFilterFocused(false)}
            className={`w-full appearance-none cursor-pointer bg-white dark:bg-slate-900 border rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition-all duration-200 ${
              catFilterFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Motion.svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
            viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
            animate={{ rotate: catFilterFocused ? 180 : 0, color: catFilterFocused ? 'var(--color-primary)' : '#94a3b8' }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 24 }}
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </Motion.svg>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : expenses.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl py-16">
          <EmptyState
            icon="🧾"
            title="Sin egresos"
            message={hasActiveFilters
              ? 'No hay egresos que coincidan con el filtro.'
              : 'Registrá tus gastos operativos para llevar la contabilidad.'}
            action={hasActiveFilters ? 'Limpiar filtros' : 'Nuevo egreso'}
            onAction={hasActiveFilters
              ? () => { setSearch(''); setCategoryFilter(''); setPage(1); }
              : openCreate}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
                  <th className="text-left text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Fecha</th>
                  <th className="text-left text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Descripción</th>
                  <th className="text-left text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Categoría</th>
                  <th className="text-left text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Proveedor</th>
                  <th className="text-left text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Medio</th>
                  <th className="text-right text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Monto</th>
                  <th className="text-right text-xs font-medium uppercase tracking-wide text-slate-400 px-5 py-3.5">Acciones</th>
                </tr>
              </thead>
              <tbody>
                  {expenses.map((ex) => {
                    const cat = ex.category || categoryMap[ex.categoryId];
                    const color = cat?.color || FALLBACK_COLOR;
                    return (
                      <tr
                        key={ex.id}
                        className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-5 py-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {fmtDate(ex.date)}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium text-slate-900 dark:text-white">{ex.description}</p>
                          {ex.notes && <p className="text-xs text-slate-400 truncate max-w-[260px]">{ex.notes}</p>}
                        </td>
                        <td className="px-5 py-4">
                          {cat ? (
                            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium"
                              style={{ background: `${color}1a`, color }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                              {cat.name}
                            </span>
                          ) : <span className="text-slate-400 text-xs">—</span>}
                        </td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs">
                          {ex.supplier || '—'}
                        </td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs">
                          {methodLabel(ex.paymentMethod)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                            {formatGs(ex.amountGs)}
                          </span>
                          {ex.ivaGs != null && ex.ivaGs > 0 && (
                            <p className="text-[11px] text-slate-400">IVA {formatGs(ex.ivaGs)}</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Motion.button
                              whileTap={tapIcon}
                              onClick={() => openEdit(ex)}
                              title="Editar"
                              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 flex items-center justify-center transition-colors"
                            >
                              <Pencil size={15} />
                            </Motion.button>
                            <Motion.button
                              whileTap={tapIcon}
                              onClick={() => setToDelete(ex)}
                              title="Eliminar"
                              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                            >
                              <Trash2 size={15} />
                            </Motion.button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 bg-slate-50/60 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5">
            <p className="text-xs text-slate-400">
              Página <span className="font-semibold text-slate-700 dark:text-slate-200">{pagination.page}</span> de{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">{pagination.totalPages}</span>
              {' · '}{pagination.total} egresos
            </p>
            <div className="flex gap-2">
              <Motion.button
                whileTap={page <= 1 || loading ? undefined : tap}
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} /> Anterior
              </Motion.button>
              <Motion.button
                whileTap={page >= pagination.totalPages || loading ? undefined : tap}
                type="button"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente <ChevronRight size={14} />
              </Motion.button>
            </div>
          </div>
        </div>
      )}

      {/* Expense modal */}
      <FormModal
        isOpen={modalOpen}
        onClose={() => { if (!saving) { setModalOpen(false); setEditing(null); } }}
        title={editing ? 'Editar egreso' : 'Nuevo egreso'}
        subtitle={editing ? 'Actualizá los datos del gasto' : 'Registrá un gasto operativo'}
        icon={<Wallet size={18} />}
        formId="expense-form"
        submitting={saving}
        submitLabel={editing ? 'Guardar cambios' : 'Registrar'}
        size="lg"
      >
        <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="date" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Fecha<span className="text-rose-500 ml-0.5">*</span>
              </label>
              <DatePicker
                id="date"
                value={form.date}
                onChange={(v) => { setForm((f) => ({ ...f, date: v })); }}
                placeholder="Seleccionar fecha"
              />
              {formErrors.date && <p className="text-xs text-rose-500">{formErrors.date}</p>}
            </div>
            <FormField
              label="Monto (₲)" name="amountGs" type="number" required
              prefix="₲" min="0" step="1" inputMode="numeric"
              placeholder="0"
              value={form.amountGs} onChange={setField('amountGs')}
              error={formErrors.amountGs}
              hint="Entero, sin decimales"
            />
          </div>

          <FormField
            label="Descripción" name="description" required
            placeholder="Ej: Compra de shampoo de carrocería"
            value={form.description} onChange={setField('description')}
            error={formErrors.description}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="categoryId" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Categoría<span className="text-rose-500 ml-0.5">*</span>
                </label>
                <Motion.button
                  whileTap={tap}
                  type="button"
                  onClick={() => setCatModalOpen(true)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  + Nueva
                </Motion.button>
              </div>
              <div className="relative">
                <select
                  id="categoryId" name="categoryId"
                  value={form.categoryId} onChange={setField('categoryId')}
                  onFocus={() => setCatSelectFocused(true)}
                  onBlur={() => setCatSelectFocused(false)}
                  className={`w-full appearance-none cursor-pointer bg-slate-50 dark:bg-slate-800/60 border rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition-all duration-200 ${
                    formErrors.categoryId
                      ? `border-rose-400 dark:border-rose-500 ${catSelectFocused ? 'ring-2 ring-rose-500/15' : ''}`
                      : catSelectFocused
                      ? 'border-primary ring-2 ring-primary/15'
                      : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <option value="">Seleccionar…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <Motion.svg
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
                  animate={{ rotate: catSelectFocused ? 180 : 0, color: catSelectFocused ? (formErrors.categoryId ? '#f43f5e' : 'var(--color-primary)') : '#94a3b8' }}
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 24 }}
                >
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </Motion.svg>
              </div>
              {formErrors.categoryId && <p className="text-xs text-rose-500">{formErrors.categoryId}</p>}
            </div>

            <FormField
              as="select" label="Medio de pago" name="paymentMethod"
              value={form.paymentMethod} onChange={setField('paymentMethod')}
            >
              <option value="">Sin especificar</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Proveedor" name="supplier"
              placeholder="Texto libre (opcional)"
              value={form.supplier} onChange={setField('supplier')}
            />
            <FormField
              label="IVA (₲)" name="ivaGs" type="number"
              prefix="₲" min="0" step="1" inputMode="numeric"
              placeholder="0 (opcional)"
              value={form.ivaGs} onChange={setField('ivaGs')}
              error={formErrors.ivaGs}
              hint="IVA incluido en el monto"
            />
          </div>

          <FormField
            as="textarea" label="Notas" name="notes" rows={2}
            placeholder="Observaciones (opcional)"
            value={form.notes} onChange={setField('notes')}
          />
        </form>
      </FormModal>

      {/* Category modal */}
      <FormModal
        isOpen={catModalOpen}
        onClose={() => { if (!savingCat) setCatModalOpen(false); }}
        title="Nueva categoría"
        subtitle="Clasificá tus egresos para los reportes"
        icon={<Tag size={18} />}
        formId="category-form"
        submitting={savingCat}
        submitLabel="Crear categoría"
        size="sm"
      >
        <form id="category-form" onSubmit={handleCatSubmit} className="space-y-4">
          <FormField
            label="Nombre" name="catName" required
            placeholder="Ej: Insumos, Sueldos, Alquiler…"
            value={catForm.name}
            onChange={(e) => { setCatForm((f) => ({ ...f, name: e.target.value })); setCatError(''); }}
            error={catError}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="catColor" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="catColor" type="color"
                value={catForm.color}
                onChange={(e) => setCatForm((f) => ({ ...f, color: e.target.value }))}
                className="w-12 h-10 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent cursor-pointer"
              />
              <span className="text-xs text-slate-400">Se usa en los gráficos del reporte.</span>
            </div>
          </div>
        </form>
      </FormModal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        variant="danger"
        title="Eliminar egreso"
        message={toDelete
          ? `¿Seguro que querés eliminar "${toDelete.description}" por ${formatGs(toDelete.amountGs)}? Esta acción no se puede deshacer.`
          : ''}
      />
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────
const CARD_COLORS = {
  rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
  amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  indigo: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

function ExpenseCard({ label, value, sub, icon, color }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${CARD_COLORS[color] || CARD_COLORS.indigo}`}>{icon}</span>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-tight">{value}</p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      {sub ? <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}
