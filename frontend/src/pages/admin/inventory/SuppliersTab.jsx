import { useState, useEffect, useMemo } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import {
  Plus, Pencil, Trash2, Search, Truck, RefreshCcw,
  X, Loader2, Phone, Mail, User, CheckCircle2, CircleSlash,
} from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import useScrollLock from '../../../hooks/useScrollLock';

const EMPTY_FORM = { name: '', contact: '', phone: '', email: '', notes: '' };

export default function SuppliersTab() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapSmall = reduceMotion ? undefined : { scale: 0.9 };

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Bloquea el scroll del body mientras cualquier modal esté abierto
  useScrollLock(modalOpen || !!toDelete);

  const loadData = async () => {
    setError(false);
    try {
      const res = await api.get('/inventory/suppliers', { _noCache: true });
      setSuppliers(res.data.data || []);
    } catch (e) {
      setError(true);
      toast.error(e.response?.data?.message || 'No se pudo cargar la lista de proveedores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const refresh = () => { setLoading(true); loadData(); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.contact || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name || '',
      contact: s.contact || '',
      phone: s.phone || '',
      email: s.email || '',
      notes: s.notes || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Ingresá un nombre';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errs.email = 'Email inválido';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      contact: form.contact.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    try {
      if (editing) {
        await api.put(`/inventory/suppliers/${editing.id}`, payload);
        toast.success('Proveedor actualizado');
      } else {
        await api.post('/inventory/suppliers', payload);
        toast.success('Proveedor registrado');
      }
      api.invalidate('/inventory/suppliers');
      setModalOpen(false);
      setEditing(null);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar el proveedor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/inventory/suppliers/${toDelete.id}`);
      api.invalidate('/inventory/suppliers');
      toast.success('Proveedor desactivado');
      setToDelete(null);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo desactivar');
    } finally {
      setDeleting(false);
    }
  };

  const inputBase =
    'w-full bg-slate-50 dark:bg-slate-800/60 border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200';
  // Estado de foco/borde por campo (mismo lenguaje que FormField).
  const fieldCls = (field, hasError) => {
    const focused = focusedField === field;
    const border = hasError
      ? `border-rose-400 dark:border-rose-500 ${focused ? 'ring-2 ring-rose-500/15' : ''}`
      : focused
      ? 'border-primary ring-2 ring-primary/15'
      : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20';
    return `${inputBase} ${border}`;
  };
  const labelCls = (field, hasError) =>
    `text-xs font-semibold transition-colors duration-200 ${
      hasError ? 'text-rose-500' : focusedField === field ? 'text-primary' : 'text-slate-600 dark:text-slate-300'
    }`;
  const onFocusField = (field) => () => setFocusedField(field);
  const onBlurField = () => setFocusedField(null);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`} size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar proveedor por nombre, contacto, email…"
            className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
              searchFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          />
        </div>
        <div className="flex items-center gap-2">
          <Motion.button
            onClick={refresh}
            whileTap={tapSmall}
            title="Actualizar"
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors shrink-0"
          >
            <RefreshCcw size={16} />
          </Motion.button>
          <Motion.button
            onClick={openCreate}
            whileTap={tap}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-colors shrink-0"
          >
            <Plus size={16} /> Nuevo proveedor
          </Motion.button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-10 text-center text-sm text-slate-400">
          <Loader2 size={20} className="animate-spin inline mr-2" /> Cargando proveedores…
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-12 text-center">
          <p className="text-3xl mb-2">⚠️</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Error al cargar</p>
          <p className="text-xs text-slate-400 mt-1">No se pudo obtener la lista de proveedores.</p>
          <button onClick={refresh} className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 transition-colors">
            Reintentar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-12 text-center">
          <span className="admin-itile admin-itile-violet inline-flex w-12 h-12 rounded-2xl items-center justify-center mb-3">
            <Truck size={22} className="text-white" />
          </span>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {suppliers.length === 0 ? 'Sin proveedores registrados' : 'Sin resultados'}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {suppliers.length === 0
              ? 'Registrá tus proveedores para organizar compras y reposición de insumos.'
              : 'Probá ajustar la búsqueda.'}
          </p>
          {suppliers.length === 0 && (
            <Motion.button onClick={openCreate} whileTap={tap} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
              <Plus size={15} /> Nuevo proveedor
            </Motion.button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-white/[0.02] text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-3.5 font-medium">Proveedor</th>
                  <th className="text-left px-5 py-3.5 font-medium">Contacto</th>
                  <th className="text-left px-5 py-3.5 font-medium">Teléfono</th>
                  <th className="text-left px-5 py-3.5 font-medium">Email</th>
                  <th className="text-center px-5 py-3.5 font-medium">Estado</th>
                  <th className="text-right px-5 py-3.5 font-medium">Acciones</th>
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
                        <span className="admin-itile admin-itile-violet w-9 h-9">
                          <Truck size={16} className="text-white" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">{s.name}</p>
                          {s.notes && <p className="text-xs text-slate-400 truncate max-w-[200px]">{s.notes}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">{s.contact || '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">{s.phone || '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-500 dark:text-slate-400 text-xs truncate block max-w-[180px]">{s.email || '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center">
                        {s.isActive === false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                            <CircleSlash size={11} /> Inactivo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                            <CheckCircle2 size={11} /> Activo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Motion.button
                          onClick={() => openEdit(s)}
                          whileTap={tapSmall}
                          title="Editar"
                          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 flex items-center justify-center transition-colors"
                        >
                          <Pencil size={15} />
                        </Motion.button>
                        {s.isActive !== false && (
                          <Motion.button
                            onClick={() => setToDelete(s)}
                            whileTap={tapSmall}
                            title="Desactivar"
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                          >
                            <Trash2 size={15} />
                          </Motion.button>
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
      {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => { if (!saving) { setModalOpen(false); setEditing(null); } }}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="admin-itile admin-itile-violet shrink-0 w-9 h-9">
                    <Truck size={18} className="text-white" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                      {editing ? 'Editar proveedor' : 'Nuevo proveedor'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {editing ? 'Actualizá los datos del proveedor' : 'Registrá un nuevo proveedor de insumos'}
                    </p>
                  </div>
                </div>
                <Motion.button
                  type="button"
                  onClick={() => { if (!saving) { setModalOpen(false); setEditing(null); } }}
                  disabled={saving}
                  whileTap={saving ? undefined : tapSmall}
                  aria-label="Cerrar"
                  className="shrink-0 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  <X size={18} />
                </Motion.button>
              </div>

              <div className="px-6 py-5 overflow-y-auto overscroll-contain flex-1">
                <form id="supplier-form" onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="name" className={labelCls('name', formErrors.name)}>
                      Nombre<span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <input
                      id="name" value={form.name} onChange={setField('name')}
                      onFocus={onFocusField('name')} onBlur={onBlurField}
                      placeholder="Ej: Distribuidora Química S.A."
                      className={fieldCls('name', !!formErrors.name)}
                    />
                    {formErrors.name && <p className="text-xs text-rose-500">{formErrors.name}</p>}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="contact" className={labelCls('contact', false)}>
                      Persona de contacto
                    </label>
                    <div className="relative">
                      <User size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === 'contact' ? 'text-primary' : 'text-slate-400'}`} />
                      <input
                        id="contact" value={form.contact} onChange={setField('contact')}
                        onFocus={onFocusField('contact')} onBlur={onBlurField}
                        placeholder="Nombre del responsable"
                        className={`${fieldCls('contact', false)} pl-9`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="phone" className={labelCls('phone', false)}>
                        Teléfono
                      </label>
                      <div className="relative">
                        <Phone size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === 'phone' ? 'text-primary' : 'text-slate-400'}`} />
                        <input
                          id="phone" value={form.phone} onChange={setField('phone')}
                          onFocus={onFocusField('phone')} onBlur={onBlurField}
                          placeholder="+595 ..." className={`${fieldCls('phone', false)} pl-9`}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="email" className={labelCls('email', formErrors.email)}>
                        Email
                      </label>
                      <div className="relative">
                        <Mail size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 ${formErrors.email ? 'text-rose-400' : focusedField === 'email' ? 'text-primary' : 'text-slate-400'}`} />
                        <input
                          id="email" type="email" value={form.email} onChange={setField('email')}
                          onFocus={onFocusField('email')} onBlur={onBlurField}
                          placeholder="ventas@..."
                          className={`${fieldCls('email', !!formErrors.email)} pl-9`}
                        />
                      </div>
                      {formErrors.email && <p className="text-xs text-rose-500">{formErrors.email}</p>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="notes" className={labelCls('notes', false)}>
                      Notas
                    </label>
                    <textarea
                      id="notes" value={form.notes} onChange={setField('notes')} rows={3}
                      onFocus={onFocusField('notes')} onBlur={onBlurField}
                      placeholder="Condiciones de pago, rubros, observaciones…"
                      className={`${fieldCls('notes', false)} resize-y`}
                    />
                  </div>
                </form>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02]">
                <Motion.button
                  type="button"
                  onClick={() => { if (!saving) { setModalOpen(false); setEditing(null); } }}
                  disabled={saving}
                  whileTap={saving ? undefined : tap}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </Motion.button>
                <Motion.button
                  type="submit"
                  form="supplier-form"
                  disabled={saving}
                  whileTap={saving ? undefined : tap}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/20 disabled:opacity-60"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editing ? 'Guardar cambios' : 'Registrar'}
                </Motion.button>
              </div>
            </div>
          </div>
        )}

      {/* Confirmación desactivar */}
      {toDelete && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => { if (!deleting) setToDelete(null); }}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <span className="shrink-0 w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <Trash2 size={20} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">Desactivar proveedor</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      ¿Seguro que querés desactivar "{toDelete?.name}"? Se desvincularán sus insumos y dejará de aparecer como activo.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 mt-6">
                  <Motion.button
                    type="button"
                    onClick={() => setToDelete(null)}
                    disabled={deleting}
                    whileTap={deleting ? undefined : tap}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </Motion.button>
                  <Motion.button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    whileTap={deleting ? undefined : tap}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm shadow-rose-600/20 disabled:opacity-60"
                  >
                    {deleting && <Loader2 size={16} className="animate-spin" />}
                    Desactivar
                  </Motion.button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
