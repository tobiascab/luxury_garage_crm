import { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Users, Mail, Phone, Search, UserPlus, Pencil, Trash2,
  KeyRound, RefreshCcw, ShieldCheck, ShieldAlert, Shield, HardHat,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import StatCard from '../../components/StatCard';
import AnimatedNumber from '../../components/AnimatedNumber';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import EmptyState from '../../components/EmptyState';
import { SkeletonStats, SkeletonTable } from '../../components/Skeleton';

const EMPTY_CREATE = { email: '', password: '', firstName: '', lastName: '', phone: '', role: 'EMPLOYEE' };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const ROLE_LABEL = { EMPLOYEE: 'Empleado', ADMIN: 'Administrador', SUPER_ADMIN: 'Super Admin' };

export default function EmployeesManager() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapSm = reduceMotion ? undefined : { scale: 0.9 };
  const [searchFocused, setSearchFocused] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createErrors, setCreateErrors] = useState({});
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const [pwdTarget, setPwdTarget] = useState(null);
  const [pwdForm, setPwdForm] = useState({ newPassword: '', confirm: '' });
  const [pwdErrors, setPwdErrors] = useState({});
  const [savingPwd, setSavingPwd] = useState(false);

  const [toDelete, setToDelete] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      api.invalidate('/members');
      const [empRes, admRes] = await Promise.all([
        api.get('/members?role=EMPLOYEE&limit=100'),
        api.get('/members?role=ADMIN&limit=100'),
      ]);
      setEmployees(empRes.data.data || []);
      setAdmins(admRes.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cargar el personal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const staff = [...employees, ...admins];
  const filtered = staff.filter(e =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  );
  const activeCount = staff.filter(e => e.isActive).length;

  // ── Create ──
  const handleCreate = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!createForm.firstName.trim()) errs.firstName = 'Requerido';
    if (!createForm.lastName.trim()) errs.lastName = 'Requerido';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email)) errs.email = 'Email inválido';
    if (createForm.password.length < 8) errs.password = 'Mínimo 8 caracteres';
    else if (!/[A-Z]/.test(createForm.password)) errs.password = 'Incluí una mayúscula';
    else if (!/[0-9]/.test(createForm.password)) errs.password = 'Incluí un número';
    setCreateErrors(errs);
    if (Object.keys(errs).length) return;

    setCreating(true);
    try {
      await api.post('/members/staff', {
        email: createForm.email.trim(),
        password: createForm.password,
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        phone: createForm.phone.trim() || undefined,
        role: createForm.role,
      });
      toast.success('Colaborador creado');
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
      setCreateErrors({});
      loadStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear el colaborador');
    }
    setCreating(false);
  };

  // ── Edit ──
  const openEdit = (emp) => {
    setEditing(emp);
    setEditForm({ firstName: emp.firstName || '', lastName: emp.lastName || '', email: emp.email || '', phone: emp.phone || '', role: emp.role });
    setEditErrors({});
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
      const payload = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
      };
      if (editForm.role !== editing.role) payload.role = editForm.role;
      await api.put(`/members/${editing.id}`, payload);
      toast.success('Datos actualizados');
      setEditing(null);
      setEditForm(null);
      loadStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar');
    }
    setSavingEdit(false);
  };

  // ── Password ──
  const openPwd = (emp) => {
    setPwdTarget(emp);
    setPwdForm({ newPassword: '', confirm: '' });
    setPwdErrors({});
  };

  const handlePwd = async (e) => {
    e.preventDefault();
    const errs = {};
    if (pwdForm.newPassword.length < 8) errs.newPassword = 'Mínimo 8 caracteres';
    else if (!/[A-Z]/.test(pwdForm.newPassword)) errs.newPassword = 'Incluí una mayúscula';
    else if (!/[0-9]/.test(pwdForm.newPassword)) errs.newPassword = 'Incluí un número';
    if (pwdForm.confirm !== pwdForm.newPassword) errs.confirm = 'No coinciden';
    setPwdErrors(errs);
    if (Object.keys(errs).length) return;

    setSavingPwd(true);
    try {
      await api.put(`/members/${pwdTarget.id}/password`, { newPassword: pwdForm.newPassword });
      toast.success('Contraseña actualizada');
      setPwdTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cambiar la contraseña');
    }
    setSavingPwd(false);
  };

  // ── Delete ──
  const handleDelete = async () => {
    setActionLoading(true);
    try {
      const r = await api.delete(`/members/${toDelete.id}`);
      toast.success(r.data?.softDeleted ? 'Tenía historial: se desactivó su acceso' : 'Colaborador eliminado');
      setToDelete(null);
      loadStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar');
    }
    setActionLoading(false);
  };

  // ── Activate/Suspend ──
  const handleToggle = async () => {
    const newStatus = !toggleTarget.isActive;
    setActionLoading(true);
    try {
      await api.put(`/members/${toggleTarget.id}/status`, { isActive: newStatus });
      toast.success(newStatus ? 'Colaborador reactivado' : 'Colaborador suspendido');
      setToggleTarget(null);
      loadStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cambiar estado');
    }
    setActionLoading(false);
  };

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-600/20">
            <HardHat size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Personal</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Empleados y administradores de Luxury Garage</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={tapSm}
            onClick={loadStaff}
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
            <UserPlus size={18} /> Alta de personal
          </motion.button>
        </div>
      </div>

      {/* Stats (reales) */}
      {loading ? (
        <SkeletonStats count={3} className="mb-6 lg:grid-cols-3" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<Users size={18} />} title="Empleados" value={<AnimatedNumber value={employees.length} format="int" />} color="#6366f1" />
          <StatCard icon={<ShieldCheck size={18} />} title="Administradores" value={<AnimatedNumber value={admins.length} format="int" />} color="#10b981" />
          <StatCard icon={<Shield size={18} />} title="Activos" value={<AnimatedNumber value={activeCount} format="int" />} color="#f59e0b" />
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search size={18} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Buscar por nombre o email…"
          className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
            searchFocused
              ? 'border-primary ring-2 ring-primary/15'
              : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
          }`}
        />
      </div>

      {/* List */}
      {loading ? (
        <SkeletonTable rows={6} cols={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🧰"
          title="Sin colaboradores"
          message={search ? 'No hay personal que coincida con la búsqueda.' : 'Todavía no diste de alta a ningún colaborador.'}
          action="Alta de personal"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-white/[0.02] text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <th className="px-5 py-3.5">Colaborador</th>
                  <th className="px-5 py-3.5 hidden md:table-cell">Contacto</th>
                  <th className="px-5 py-3.5">Rol</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5 hidden lg:table-cell">Alta</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr
                    key={emp.id}
                    className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-semibold text-xs shrink-0">
                          {emp.firstName?.[0]}{emp.lastName?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-slate-400 truncate md:hidden">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <div className="space-y-0.5">
                        <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><Mail size={12} className="text-slate-400" /> {emp.email}</p>
                        {emp.phone && <p className="text-sm text-slate-500 flex items-center gap-1.5"><Phone size={12} className="text-slate-400" /> {emp.phone}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${emp.role === 'EMPLOYEE' ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
                        {emp.role === 'EMPLOYEE' ? <HardHat size={12} /> : <ShieldCheck size={12} />}
                        {ROLE_LABEL[emp.role] || emp.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${emp.isActive ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {emp.isActive ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <span className="text-sm text-slate-500 tabular-nums">{fmtDate(emp.createdAt)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <motion.button whileTap={tapSm} onClick={() => openEdit(emp)} title="Editar"
                          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-colors">
                          <Pencil size={15} />
                        </motion.button>
                        <motion.button whileTap={tapSm} onClick={() => openPwd(emp)} title="Cambiar contraseña"
                          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-colors">
                          <KeyRound size={15} />
                        </motion.button>
                        <motion.button whileTap={tapSm} onClick={() => setToggleTarget(emp)} title={emp.isActive ? 'Suspender' : 'Reactivar'}
                          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-amber-500 hover:text-white flex items-center justify-center transition-colors">
                          {emp.isActive ? <ShieldAlert size={15} /> : <Shield size={15} />}
                        </motion.button>
                        <motion.button whileTap={tapSm} onClick={() => setToDelete(emp)} title="Eliminar"
                          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-colors">
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

      {/* ── CREATE MODAL ── */}
      <FormModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Alta de personal"
        subtitle="Crea una cuenta de empleado o administrador"
        icon={<UserPlus size={18} />}
        formId="create-staff-form"
        submitting={creating}
        submitLabel="Crear colaborador"
        size="md"
      >
        <form id="create-staff-form" onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nombre" name="firstName" required value={createForm.firstName} error={createErrors.firstName}
              onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} placeholder="Nicolás" />
            <FormField label="Apellido" name="lastName" required value={createForm.lastName} error={createErrors.lastName}
              onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} placeholder="Giménez" />
          </div>
          <FormField label="Email" name="email" type="email" required value={createForm.email} error={createErrors.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="empleado@luxurygarage.com" />
          <FormField label="Teléfono" name="phone" value={createForm.phone}
            onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+595 9XX XXX XXX" />
          <FormField as="select" label="Rol" name="role" value={createForm.role}
            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
            hint="Administrador requiere permisos de Super Admin">
            <option value="EMPLOYEE">Empleado</option>
            <option value="ADMIN">Administrador</option>
          </FormField>
          <FormField label="Contraseña" name="password" type="password" required value={createForm.password} error={createErrors.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            hint="Mínimo 8 caracteres, 1 mayúscula y 1 número" />
        </form>
      </FormModal>

      {/* ── EDIT MODAL ── */}
      <FormModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title="Editar colaborador"
        icon={<Pencil size={18} />}
        formId="edit-staff-form"
        submitting={savingEdit}
        size="md"
      >
        {editForm && (
          <form id="edit-staff-form" onSubmit={handleEdit} className="space-y-4">
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
            <FormField as="select" label="Rol" name="e-role" value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              hint="Cambiar a Administrador requiere permisos de Super Admin">
              <option value="EMPLOYEE">Empleado</option>
              <option value="ADMIN">Administrador</option>
            </FormField>
          </form>
        )}
      </FormModal>

      {/* ── PASSWORD MODAL ── */}
      <FormModal
        isOpen={!!pwdTarget}
        onClose={() => setPwdTarget(null)}
        title="Cambiar contraseña"
        subtitle={pwdTarget ? `Para ${pwdTarget.firstName} ${pwdTarget.lastName}` : ''}
        icon={<KeyRound size={18} />}
        formId="staff-pwd-form"
        submitting={savingPwd}
        submitLabel="Actualizar"
        size="sm"
      >
        <form id="staff-pwd-form" onSubmit={handlePwd} className="space-y-4">
          <FormField label="Nueva contraseña" name="newPassword" type="password" required value={pwdForm.newPassword} error={pwdErrors.newPassword}
            onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
            hint="Mínimo 8 caracteres, 1 mayúscula y 1 número" />
          <FormField label="Confirmar contraseña" name="confirm" type="password" required value={pwdForm.confirm} error={pwdErrors.confirm}
            onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })} />
        </form>
      </FormModal>

      {/* ── CONFIRM: delete ── */}
      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        loading={actionLoading}
        variant="danger"
        title="Eliminar colaborador"
        message={toDelete ? `¿Eliminar a ${toDelete.firstName} ${toDelete.lastName} del equipo? Si tiene historial de servicios se desactivará en lugar de borrarse.` : ''}
        confirmLabel="Eliminar"
      />

      {/* ── CONFIRM: toggle status ── */}
      <ConfirmDialog
        isOpen={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        loading={actionLoading}
        variant={toggleTarget?.isActive ? 'danger' : 'primary'}
        title={toggleTarget?.isActive ? 'Suspender colaborador' : 'Reactivar colaborador'}
        message={toggleTarget
          ? `¿${toggleTarget.isActive ? 'Suspender' : 'Reactivar'} a ${toggleTarget.firstName} ${toggleTarget.lastName}? ${toggleTarget.isActive ? 'No podrá iniciar sesión.' : 'Podrá volver a iniciar sesión.'}`
          : ''}
        confirmLabel={toggleTarget?.isActive ? 'Suspender' : 'Reactivar'}
      />
    </div>
  );
}
