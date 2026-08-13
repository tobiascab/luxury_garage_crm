import { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Users, Search, UserPlus, Mail, Phone, Calendar, X,
  Crown, Car, ChevronRight, MessageSquare, ShieldAlert, Shield,
  Pencil, KeyRound, RefreshCcw, ChevronLeft, ChevronDown,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatGs } from '../../constants/pricing';
import AnimatedNumber from '../../components/AnimatedNumber';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import EmptyState from '../../components/EmptyState';
import { SkeletonTable } from '../../components/Skeleton';
import useScrollLock from '../../hooks/useScrollLock';

const EMPTY_CREATE = {
  email: '', firstName: '', lastName: '', phone: '',
  planId: '', vehicleBrand: '', vehicleModel: '', vehicleYear: new Date().getFullYear(),
  vehicleColor: '', vehiclePlate: '', sendWhatsApp: true,
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function MembersManager() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapSm = reduceMotion ? undefined : { scale: 0.9 };
  const [searchFocused, setSearchFocused] = useState(false);
  const [statusFocused, setStatusFocused] = useState(false);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [plans, setPlans] = useState([]);

  // Detail / edit panel
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);
  const [createErrors, setCreateErrors] = useState({});

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const [showPlan, setShowPlan] = useState(false);
  const [planForm, setPlanForm] = useState({ planId: '', months: 1 });
  const [savingPlan, setSavingPlan] = useState(false);

  const [showPwd, setShowPwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ newPassword: '', confirm: '', sendCredentials: false });
  const [pwdErrors, setPwdErrors] = useState({});
  const [savingPwd, setSavingPwd] = useState(false);

  const [confirmStatus, setConfirmStatus] = useState(null); // member to toggle suspend
  const [confirmCancelPlan, setConfirmCancelPlan] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Bloquea el scroll del body mientras cualquier overlay esté abierto
  useScrollLock(
    !!selected || showCreate || showEdit || showPlan || showPwd || !!confirmStatus || confirmCancelPlan
  );

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadPlans = useCallback(async () => {
    try {
      const res = await api.get('/plans');
      setPlans(res.data.data || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filterStatus) params.set('status', filterStatus);
      api.invalidate('/members');
      const res = await api.get(`/members?${params}`);
      setMembers(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterStatus]);

  useEffect(() => { loadPlans(); }, [loadPlans]);
  useEffect(() => { loadMembers(); }, [loadMembers]);

  // ── Detail ──
  const openDetail = async (member) => {
    setSelected(member);
    setDetailLoading(true);
    try {
      const res = await api.get(`/members/${member.id}`);
      setSelected(res.data.data);
    } catch {
      toast.error('No se pudo cargar el detalle');
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async (id) => {
    try {
      const res = await api.get(`/members/${id}`);
      setSelected(res.data.data);
    } catch { /* ignore */ }
  };

  // ── Create ──
  const validateCreate = () => {
    const e = {};
    if (!createForm.firstName.trim()) e.firstName = 'Requerido';
    if (!createForm.lastName.trim()) e.lastName = 'Requerido';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email)) e.email = 'Email inválido';
    setCreateErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!validateCreate()) return;
    setCreating(true);
    try {
      await api.post('/auth/admin-create', {
        email: createForm.email.trim(),
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        phone: createForm.phone || undefined,
        planId: createForm.planId || undefined,
        vehicleBrand: createForm.vehicleBrand || undefined,
        vehicleModel: createForm.vehicleModel || undefined,
        vehicleYear: createForm.vehicleYear ? parseInt(createForm.vehicleYear) : undefined,
        vehicleColor: createForm.vehicleColor || undefined,
        vehiclePlate: createForm.vehiclePlate || undefined,
        sendWhatsApp: createForm.sendWhatsApp,
      });
      toast.success(createForm.sendWhatsApp
        ? 'Cliente creado y credenciales enviadas. Activará su plan al entrar y pagar.'
        : 'Cliente creado. Compartí las credenciales: activa su plan al entrar y pagar.');
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
      setCreateErrors({});
      loadMembers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear cliente');
    }
    setCreating(false);
  };

  // ── Edit ──
  const openEdit = () => {
    setEditForm({
      firstName: selected.firstName || '',
      lastName: selected.lastName || '',
      email: selected.email || '',
      phone: selected.phone || '',
      documentNumber: selected.documentNumber || '',
    });
    setEditErrors({});
    setShowEdit(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!editForm.firstName.trim()) errs.firstName = 'Requerido';
    if (!editForm.lastName.trim()) errs.lastName = 'Requerido';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) errs.email = 'Email inválido';
    setEditErrors(errs);
    if (Object.keys(errs).length) return;

    setSavingEdit(true);
    try {
      await api.put(`/members/${selected.id}`, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        documentNumber: editForm.documentNumber.trim() || null,
      });
      toast.success('Datos actualizados');
      setShowEdit(false);
      await refreshDetail(selected.id);
      loadMembers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar');
    }
    setSavingEdit(false);
  };

  // ── Membership / Plan ──
  const openPlan = () => {
    setPlanForm({ planId: selected.memberships?.find(m => m.status === 'ACTIVE')?.planId || '', months: 1 });
    setShowPlan(true);
  };

  const handleAssignPlan = async (e) => {
    e.preventDefault();
    if (!planForm.planId) { toast.error('Seleccioná un plan'); return; }
    setSavingPlan(true);
    try {
      await api.post(`/members/${selected.id}/membership`, {
        planId: planForm.planId,
        months: parseInt(planForm.months) || 1,
      });
      toast.success('Membresía asignada');
      setShowPlan(false);
      await refreshDetail(selected.id);
      loadMembers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al asignar el plan');
    }
    setSavingPlan(false);
  };

  const handleCancelPlan = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/members/${selected.id}/membership`);
      toast.success('Membresía cancelada');
      setConfirmCancelPlan(false);
      await refreshDetail(selected.id);
      loadMembers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cancelar');
    }
    setActionLoading(false);
  };

  // ── Password ──
  const openPwd = () => {
    setPwdForm({ newPassword: '', confirm: '', sendCredentials: false });
    setPwdErrors({});
    setShowPwd(true);
  };

  const handlePwd = async (e) => {
    e.preventDefault();
    const errs = {};
    if (pwdForm.newPassword.length < 8) errs.newPassword = 'Mínimo 8 caracteres';
    else if (!/[A-Z]/.test(pwdForm.newPassword)) errs.newPassword = 'Incluí al menos una mayúscula';
    else if (!/[0-9]/.test(pwdForm.newPassword)) errs.newPassword = 'Incluí al menos un número';
    if (pwdForm.confirm !== pwdForm.newPassword) errs.confirm = 'Las contraseñas no coinciden';
    setPwdErrors(errs);
    if (Object.keys(errs).length) return;

    setSavingPwd(true);
    try {
      await api.put(`/members/${selected.id}/password`, {
        newPassword: pwdForm.newPassword,
        sendCredentials: pwdForm.sendCredentials,
      });
      toast.success(pwdForm.sendCredentials ? 'Contraseña actualizada y enviada por WhatsApp' : 'Contraseña actualizada');
      setShowPwd(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cambiar la contraseña');
    }
    setSavingPwd(false);
  };

  // ── Status ──
  const doToggleStatus = async () => {
    const member = confirmStatus;
    const newStatus = !member.isActive;
    setActionLoading(true);
    try {
      await api.put(`/members/${member.id}/status`, { isActive: newStatus });
      toast.success(newStatus ? 'Cliente reactivado' : 'Cliente suspendido');
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, isActive: newStatus } : m));
      if (selected?.id === member.id) setSelected(s => ({ ...s, isActive: newStatus }));
      setConfirmStatus(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cambiar estado');
    }
    setActionLoading(false);
  };

  const activeMembership = selected?.memberships?.find(m => m.status === 'ACTIVE');

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="admin-itile admin-itile-indigo w-11 h-11 rounded-2xl">
            <Users size={22} className="text-white" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clientes</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400"><AnimatedNumber value={pagination.total} format="int" /> clientes registrados</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={tapSm}
            onClick={loadMembers}
            title="Recargar"
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors"
          >
            <RefreshCcw size={16} />
          </motion.button>
          <motion.button
            whileTap={tap}
            onClick={() => { setCreateForm(EMPTY_CREATE); setCreateErrors({}); setShowCreate(true); }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-colors"
          >
            <UserPlus size={18} /> Nuevo cliente
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar por nombre, email o teléfono…"
            className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
              searchFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          />
        </div>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            onFocus={() => setStatusFocused(true)}
            onBlur={() => setStatusFocused(false)}
            className={`appearance-none bg-white dark:bg-slate-900 border rounded-xl pl-4 pr-10 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none transition-all duration-200 cursor-pointer ${
              statusFocused
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}
          >
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Suspendidos</option>
          </select>
          <motion.span
            aria-hidden
            animate={{ rotate: statusFocused ? 180 : 0, color: statusFocused ? 'var(--color-primary)' : '#94a3b8' }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 24 }}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          >
            <ChevronDown size={16} />
          </motion.span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : members.length === 0 ? (
        <EmptyState
          icon="🧑‍💼"
          title="Sin clientes"
          message={debouncedSearch || filterStatus ? 'No hay clientes que coincidan con el filtro.' : 'Todavía no registraste ningún cliente.'}
          action="Nuevo cliente"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-white/[0.02] text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <th className="px-5 py-3.5">Cliente</th>
                  <th className="px-5 py-3.5 hidden md:table-cell">Contacto</th>
                  <th className="px-5 py-3.5 hidden lg:table-cell">Membresía</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5 hidden sm:table-cell">Registro</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const am = m.memberships?.find(x => x.status === 'ACTIVE') || m.memberships?.[0];
                  return (
                    <motion.tr
                      key={m.id}
                      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
                      className="group border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                      onClick={() => openDetail(m)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-semibold text-xs shrink-0">
                            {m.firstName?.[0]}{m.lastName?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{m.firstName} {m.lastName}</p>
                            <p className="text-xs text-slate-400 truncate md:hidden">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <div className="space-y-0.5">
                          <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><Mail size={12} className="text-slate-400" /> {m.email}</p>
                          {m.phone && <p className="text-sm text-slate-500 flex items-center gap-1.5"><Phone size={12} className="text-slate-400" /> {m.phone}</p>}
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        {am?.plan ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
                            <Crown size={12} /> {am.plan.name}
                          </span>
                        ) : <span className="text-xs text-slate-400">Sin plan</span>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${m.isActive ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${m.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {m.isActive ? 'Activo' : 'Suspendido'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <span className="text-sm text-slate-500 tabular-nums">{fmtDate(m.createdAt)}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <motion.button
                            whileTap={tapSm}
                            onClick={(e) => { e.stopPropagation(); setConfirmStatus(m); }}
                            title={m.isActive ? 'Suspender' : 'Reactivar'}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${m.isActive ? 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-rose-600 hover:text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-emerald-600 hover:text-white'}`}
                          >
                            {m.isActive ? <ShieldAlert size={15} /> : <Shield size={15} />}
                          </motion.button>
                          <motion.button
                            whileTap={tapSm}
                            onClick={(e) => { e.stopPropagation(); openDetail(m); }}
                            title="Ver / editar"
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-colors"
                          >
                            <ChevronRight size={16} />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02]">
              <p className="text-xs text-slate-400">Página {pagination.page} de {pagination.pages}</p>
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={page <= 1 ? undefined : tap}
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={15} /> Anterior
                </motion.button>
                <motion.button
                  whileTap={page >= pagination.pages ? undefined : tap}
                  disabled={page >= pagination.pages}
                  onClick={() => setPage(p => p + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
                >
                  Siguiente <ChevronRight size={15} />
                </motion.button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DETAIL PANEL (drawer) ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div
            className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="admin-itile admin-itile-indigo w-12 h-12 rounded-2xl font-semibold shrink-0">
                  {selected.firstName?.[0]}{selected.lastName?.[0]}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">{selected.firstName} {selected.lastName}</h2>
                  <p className="text-xs text-slate-400 truncate">{selected.email}</p>
                </div>
              </div>
              <motion.button whileTap={tapSm} onClick={() => setSelected(null)} className="shrink-0 w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors">
                <X size={18} />
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-6">
              {/* Status chips */}
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${selected.isActive ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selected.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {selected.isActive ? 'Activo' : 'Suspendido'}
                </span>
              </div>

              {/* Contact grid */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Teléfono" value={selected.phone || '—'} />
                <Field label="Documento" value={selected.documentNumber ? `${selected.documentType || 'CI'} ${selected.documentNumber}` : '—'} />
                <Field label="Registro" value={fmtDate(selected.createdAt)} />
                <Field label="Último acceso" value={selected.lastLoginAt ? fmtDate(selected.lastLoginAt) : 'Sin actividad'} />
              </div>

              {/* Edit button */}
              <motion.button
                whileTap={tap}
                onClick={openEdit}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                <Pencil size={15} /> Editar datos
              </motion.button>

              {/* Membership */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Membresía</h3>
                  <button onClick={openPlan} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                    {activeMembership ? 'Cambiar plan' : 'Asignar plan'}
                  </button>
                </div>
                {detailLoading ? (
                  <div className="h-20 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" />
                ) : activeMembership ? (
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Crown size={14} className="text-amber-500" /> {activeMembership.plan?.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <Calendar size={11} /> Vence {fmtDate(activeMembership.endDate)}
                        </p>
                      </div>
                      <AnimatedNumber className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums" value={activeMembership.plan?.priceGs} format="gs" />
                    </div>
                    <button
                      onClick={() => setConfirmCancelPlan(true)}
                      className="mt-3 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      Cancelar membresía
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-4 text-center">
                    <p className="text-sm text-slate-400">Sin membresía activa</p>
                  </div>
                )}
              </div>

              {/* Vehicles */}
              {selected.vehicles?.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Vehículos</h3>
                  <div className="space-y-2">
                    {selected.vehicles.map(v => (
                      <div key={v.id} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5">
                        <Car size={15} className="text-slate-400 shrink-0" />
                        <span className="text-sm text-slate-700 dark:text-slate-200">{v.brand} {v.model}{v.year ? ` · ${v.year}` : ''}{v.licensePlate ? ` · ${v.licensePlate}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Footer actions */}
            <div className="border-t border-slate-100 dark:border-white/5 px-6 py-4 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <motion.button
                  whileTap={tap}
                  onClick={openPwd}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                >
                  <KeyRound size={15} /> Contraseña
                </motion.button>
                <motion.button
                  whileTap={tap}
                  onClick={() => setConfirmStatus(selected)}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${selected.isActive ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20' : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100'}`}
                >
                  {selected.isActive ? <><ShieldAlert size={15} /> Suspender</> : <><Shield size={15} /> Activar</>}
                </motion.button>
              </div>
              {selected.phone && (
                <a
                  href={`https://wa.me/${selected.phone.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                >
                  <MessageSquare size={15} /> Escribir por WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE CLIENT MODAL ── */}
      <FormModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo cliente"
        subtitle="Se crea la cuenta y se sincroniza con ARIZAR IA"
        icon={<UserPlus size={18} />}
        formId="create-client-form"
        submitting={creating}
        submitLabel="Crear cliente"
        size="lg"
      >
        <form id="create-client-form" onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nombre" name="firstName" required value={createForm.firstName} error={createErrors.firstName}
              onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} placeholder="Juan" />
            <FormField label="Apellido" name="lastName" required value={createForm.lastName} error={createErrors.lastName}
              onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} placeholder="Pérez" />
          </div>
          <FormField label="Email" name="email" type="email" required value={createForm.email} error={createErrors.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="cliente@email.com" />
          <FormField label="Teléfono (WhatsApp)" name="phone" value={createForm.phone}
            onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+595 9XX XXX XXX" hint="Necesario para enviar las credenciales" />
          <FormField as="select" label="Plan (opcional)" name="planId" value={createForm.planId}
            onChange={(e) => setCreateForm({ ...createForm, planId: e.target.value })}
            hint="Queda preseleccionado. Se activa cuando el cliente entre, cargue su tarjeta y se le debite el primer mes.">
            <option value="">Sin plan</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {formatGs(p.priceGs)}</option>)}
          </FormField>

          <div className="pt-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Car size={13} /> Vehículo (opcional)</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Marca" name="vehicleBrand" value={createForm.vehicleBrand}
                onChange={(e) => setCreateForm({ ...createForm, vehicleBrand: e.target.value })} placeholder="Toyota" />
              <FormField label="Modelo" name="vehicleModel" value={createForm.vehicleModel}
                onChange={(e) => setCreateForm({ ...createForm, vehicleModel: e.target.value })} placeholder="Hilux" />
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <FormField label="Año" name="vehicleYear" type="number" value={createForm.vehicleYear}
                onChange={(e) => setCreateForm({ ...createForm, vehicleYear: e.target.value })} />
              <FormField label="Color" name="vehicleColor" value={createForm.vehicleColor}
                onChange={(e) => setCreateForm({ ...createForm, vehicleColor: e.target.value })} />
              <FormField label="Patente" name="vehiclePlate" value={createForm.vehiclePlate}
                onChange={(e) => setCreateForm({ ...createForm, vehiclePlate: e.target.value })} />
            </div>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">Enviar credenciales por WhatsApp</p>
              <p className="text-xs text-slate-400">El cliente recibe su email y contraseña</p>
            </div>
            <input type="checkbox" className="sr-only peer" checked={createForm.sendWhatsApp}
              onChange={(e) => setCreateForm({ ...createForm, sendWhatsApp: e.target.checked })} />
            <span className="w-11 h-6 rounded-full bg-slate-300 dark:bg-slate-700 peer-checked:bg-emerald-500 transition-colors relative shrink-0">
              <motion.span
                layout
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 34 }}
                className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-1 ${createForm.sendWhatsApp ? 'left-6' : 'left-1'}`}
              />
            </span>
          </label>
        </form>
      </FormModal>

      {/* ── EDIT MODAL ── */}
      <FormModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title="Editar cliente"
        icon={<Pencil size={18} />}
        formId="edit-client-form"
        submitting={savingEdit}
        size="md"
      >
        {editForm && (
          <form id="edit-client-form" onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Nombre" name="e-firstName" required value={editForm.firstName} error={editErrors.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              <FormField label="Apellido" name="e-lastName" required value={editForm.lastName} error={editErrors.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
            </div>
            <FormField label="Email" name="e-email" type="email" required value={editForm.email} error={editErrors.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            <FormField label="Teléfono" name="e-phone" value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+595 9XX XXX XXX" />
            <FormField label="Documento (CI/RUC)" name="e-doc" value={editForm.documentNumber}
              onChange={(e) => setEditForm({ ...editForm, documentNumber: e.target.value })} placeholder="1.234.567" />
          </form>
        )}
      </FormModal>

      {/* ── PLAN / MEMBERSHIP MODAL ── */}
      <FormModal
        isOpen={showPlan}
        onClose={() => setShowPlan(false)}
        title={activeMembership ? 'Cambiar plan' : 'Asignar plan'}
        subtitle="Se activa una nueva membresía para el cliente"
        icon={<Crown size={18} />}
        formId="plan-form"
        submitting={savingPlan}
        submitLabel="Asignar"
        size="md"
      >
        <form id="plan-form" onSubmit={handleAssignPlan} className="space-y-4">
          <FormField as="select" label="Plan" name="planId" required value={planForm.planId}
            onChange={(e) => setPlanForm({ ...planForm, planId: e.target.value })}>
            <option value="">Seleccioná un plan</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {formatGs(p.priceGs)}</option>)}
          </FormField>
          <FormField as="select" label="Duración" name="months" value={planForm.months}
            onChange={(e) => setPlanForm({ ...planForm, months: e.target.value })}
            hint="Define la fecha de vencimiento de la membresía">
            <option value={1}>1 mes</option>
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </FormField>
        </form>
      </FormModal>

      {/* ── PASSWORD MODAL ── */}
      <FormModal
        isOpen={showPwd}
        onClose={() => setShowPwd(false)}
        title="Cambiar contraseña"
        subtitle={selected ? `Para ${selected.firstName} ${selected.lastName}` : ''}
        icon={<KeyRound size={18} />}
        formId="pwd-form"
        submitting={savingPwd}
        submitLabel="Actualizar"
        size="sm"
      >
        <form id="pwd-form" onSubmit={handlePwd} className="space-y-4">
          <FormField label="Nueva contraseña" name="newPassword" type="password" required value={pwdForm.newPassword} error={pwdErrors.newPassword}
            onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
            hint="Mínimo 8 caracteres, 1 mayúscula y 1 número" />
          <FormField label="Confirmar contraseña" name="confirm" type="password" required value={pwdForm.confirm} error={pwdErrors.confirm}
            onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })} />
          {selected?.phone && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={pwdForm.sendCredentials}
                onChange={(e) => setPwdForm({ ...pwdForm, sendCredentials: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30" />
              <span className="text-sm text-slate-600 dark:text-slate-300">Enviar nueva contraseña por WhatsApp</span>
            </label>
          )}
        </form>
      </FormModal>

      {/* ── CONFIRM: suspend/activate ── */}
      <ConfirmDialog
        isOpen={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        onConfirm={doToggleStatus}
        loading={actionLoading}
        variant={confirmStatus?.isActive ? 'danger' : 'primary'}
        title={confirmStatus?.isActive ? 'Suspender cliente' : 'Reactivar cliente'}
        message={confirmStatus
          ? `¿Confirmás ${confirmStatus.isActive ? 'suspender' : 'reactivar'} a ${confirmStatus.firstName} ${confirmStatus.lastName}? ${confirmStatus.isActive ? 'No podrá iniciar sesión hasta reactivarlo.' : 'Podrá volver a iniciar sesión.'}`
          : ''}
        confirmLabel={confirmStatus?.isActive ? 'Suspender' : 'Reactivar'}
      />

      {/* ── CONFIRM: cancel membership ── */}
      <ConfirmDialog
        isOpen={confirmCancelPlan}
        onClose={() => setConfirmCancelPlan(false)}
        onConfirm={handleCancelPlan}
        loading={actionLoading}
        variant="danger"
        title="Cancelar membresía"
        message="La membresía activa pasará a CANCELLED y no se renovará. El cliente quedará sin plan."
        confirmLabel="Cancelar membresía"
      />
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 px-3.5 py-3">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-900 dark:text-white break-words">{value}</p>
    </div>
  );
}
