import { useState, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Car, Search, User, Calendar, Palette,
  Pencil, Trash2, Mail, Phone, Star,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import AnimatedNumber from '../../components/AnimatedNumber';
import EmptyState from '../../components/EmptyState';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import { SkeletonStats, SkeletonTable } from '../../components/Skeleton';

const EMPTY_FORM = { brand: '', model: '', licensePlate: '', year: '', color: '', size: '', notes: '' };

export default function VehiclesAdmin() {
  const reduceMotion = useReducedMotion();
  const tapIcon = reduceMotion ? undefined : { scale: 0.9 };

  const [vehicles, setVehicles] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState(null); // vehicle object
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [v, s] = await Promise.all([
        api.get('/vehicles/all', { _noCache: true }),
        api.get('/vehicle-sizes').catch(() => ({ data: { data: [] } })),
      ]);
      setVehicles(v.data.data || []);
      setSizes(s.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudieron cargar los vehículos');
    } finally {
      setLoading(false);
    }
  };

  const sizeLabel = (key) => sizes.find((s) => s.key === key)?.label || (key ? key : '—');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => {
      const owner = `${v.user?.firstName || ''} ${v.user?.lastName || ''}`.toLowerCase();
      return (
        `${v.brand} ${v.model} ${v.licensePlate} ${v.color || ''}`.toLowerCase().includes(q) ||
        owner.includes(q) ||
        (v.user?.email || '').toLowerCase().includes(q)
      );
    });
  }, [vehicles, search]);

  const stats = useMemo(() => ({
    total: vehicles.length,
    owners: new Set(vehicles.map((v) => v.userId)).size,
    brands: new Set(vehicles.map((v) => v.brand).filter(Boolean)).size,
  }), [vehicles]);

  const openEdit = (v) => {
    setEditing(v);
    setForm({
      brand: v.brand || '',
      model: v.model || '',
      licensePlate: v.licensePlate || '',
      year: v.year != null ? String(v.year) : '',
      color: v.color || '',
      size: v.size || '',
      notes: v.notes || '',
    });
    setErrors({});
  };

  const validate = () => {
    const e = {};
    if (!form.brand.trim()) e.brand = 'Marca requerida';
    if (!form.model.trim()) e.model = 'Modelo requerido';
    if (!form.licensePlate.trim()) e.licensePlate = 'Placa requerida';
    if (form.year && (isNaN(Number(form.year)) || Number(form.year) < 1900 || Number(form.year) > 2100)) {
      e.year = 'Año inválido';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitEdit = async (e) => {
    e?.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        brand: form.brand.trim(),
        model: form.model.trim(),
        licensePlate: form.licensePlate.trim(),
        year: form.year ? Number(form.year) : null,
        color: form.color.trim() || null,
        size: form.size || null,
        notes: form.notes.trim() || null,
      };
      const r = await api.put(`/vehicles/admin/${editing.id}`, payload);
      const updated = r.data.data;
      setVehicles((prev) => prev.map((v) => (v.id === editing.id ? { ...v, ...updated } : v)));
      toast.success('Vehículo actualizado');
      setEditing(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar el vehículo');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/vehicles/admin/${toDelete.id}`);
      setVehicles((prev) => prev.filter((v) => v.id !== toDelete.id));
      toast.success('Vehículo eliminado');
      setToDelete(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar el vehículo');
    } finally {
      setDeleting(false);
    }
  };

  const updateForm = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  return (
    <div className="page-content pb-12">
      <PageHeader
        title="Vehículos"
        subtitle="Flota registrada por los clientes"
      />

      {/* KPIs */}
      {loading ? (
        <SkeletonStats count={3} className="mb-6 lg:grid-cols-3" />
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard icon={<Car size={18} />} title="Vehículos" value={<AnimatedNumber value={stats.total} format="int" />} color="#6366f1" />
          <StatCard icon={<User size={18} />} title="Propietarios" value={<AnimatedNumber value={stats.owners} format="int" />} color="#10b981" />
          <StatCard icon={<Star size={18} />} title="Marcas únicas" value={<AnimatedNumber value={stats.brands} format="int" />} color="#f59e0b" />
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search
          size={16}
          className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Buscar por marca, placa, color o cliente..."
          className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
            searchFocused
              ? 'border-primary ring-2 ring-primary/15'
              : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
          }`}
        />
      </div>

      {/* Tabla */}
      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl">
          <EmptyState
            icon="🚗"
            title={vehicles.length === 0 ? 'Sin vehículos registrados' : 'Sin resultados'}
            message={vehicles.length === 0
              ? 'Cuando los clientes registren sus vehículos, aparecerán acá.'
              : 'Ningún vehículo coincide con la búsqueda.'}
            action={search ? 'Limpiar búsqueda' : undefined}
            onAction={search ? () => setSearch('') : undefined}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-white/[0.02] text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-3.5">Vehículo</th>
                  <th className="text-left px-5 py-3.5">Placa</th>
                  <th className="text-left px-5 py-3.5 hidden md:table-cell">Año / Color</th>
                  <th className="text-left px-5 py-3.5 hidden lg:table-cell">Tamaño</th>
                  <th className="text-left px-5 py-3.5">Propietario</th>
                  <th className="text-right px-5 py-3.5 w-24">Acciones</th>
                </tr>
              </thead>
              <tbody>
                  {filtered.map((v) => (
                    <tr
                      key={v.id}
                      className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-300 shrink-0">
                            <Car size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate">{v.brand} {v.model}</p>
                            {v.isPrimary && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500">
                                <Star size={10} fill="currentColor" /> Principal
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center font-mono text-xs font-semibold tracking-wider text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg">
                          {v.licensePlate}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <Calendar size={13} className="text-slate-400" /> {v.year || '—'}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs capitalize">
                            <Palette size={13} className="text-slate-400" /> {v.color || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <span className="text-xs text-slate-600 dark:text-slate-300">{v.size ? sizeLabel(v.size) : '—'}</span>
                      </td>
                      <td className="px-5 py-4">
                        {v.user ? (
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate">{v.user.firstName} {v.user.lastName}</p>
                            <p className="text-xs text-slate-400 truncate">{v.user.email}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Sin propietario</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <motion.button
                            whileTap={tapIcon}
                            onClick={() => openEdit(v)}
                            aria-label="Editar"
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-colors"
                          >
                            <Pencil size={15} />
                          </motion.button>
                          <motion.button
                            whileTap={tapIcon}
                            onClick={() => setToDelete(v)}
                            aria-label="Eliminar"
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-colors"
                          >
                            <Trash2 size={15} />
                          </motion.button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de edición */}
      <FormModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title="Editar vehículo"
        subtitle={editing?.user ? `Propietario: ${editing.user.firstName} ${editing.user.lastName}` : undefined}
        icon={<Car size={18} />}
        formId="vehicle-form"
        submitting={saving}
        submitLabel="Guardar cambios"
        size="lg"
      >
        <form id="vehicle-form" onSubmit={submitEdit} className="space-y-4">
          {editing?.user && (
            <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <User size={13} className="text-slate-400" /> {editing.user.firstName} {editing.user.lastName}
              </span>
              {editing.user.email && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <Mail size={13} className="text-slate-400" /> {editing.user.email}
                </span>
              )}
              {editing.user.phone && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <Phone size={13} className="text-slate-400" /> {editing.user.phone}
                </span>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Marca" name="brand" value={form.brand} onChange={updateForm('brand')} error={errors.brand} required placeholder="Toyota" />
            <FormField label="Modelo" name="model" value={form.model} onChange={updateForm('model')} error={errors.model} required placeholder="Corolla" />
            <FormField label="Placa" name="licensePlate" value={form.licensePlate} onChange={updateForm('licensePlate')} error={errors.licensePlate} required placeholder="ABC 123" />
            <FormField label="Año" name="year" type="number" value={form.year} onChange={updateForm('year')} error={errors.year} placeholder="2020" />
            <FormField label="Color" name="color" value={form.color} onChange={updateForm('color')} placeholder="Negro" />
            <FormField as="select" label="Tamaño" name="size" value={form.size} onChange={updateForm('size')}>
              <option value="">Sin definir</option>
              {sizes.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </FormField>
          </div>
          <FormField
            as="textarea"
            label="Notas"
            name="notes"
            value={form.notes}
            onChange={updateForm('notes')}
            rows={3}
            placeholder="Observaciones internas sobre el vehículo..."
          />
        </form>
      </FormModal>

      {/* Confirmación de eliminación */}
      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        variant="danger"
        title="Eliminar vehículo"
        message={`¿Seguro que querés eliminar ${toDelete ? `${toDelete.brand} ${toDelete.model} (${toDelete.licensePlate})` : 'este vehículo'}? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
