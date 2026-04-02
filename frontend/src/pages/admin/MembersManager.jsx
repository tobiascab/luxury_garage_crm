import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Plus, UserPlus,
  Shield, ShieldAlert, Mail,
  Phone, Calendar, ArrowRight, X, Trash2,
  CheckCircle2, AlertCircle, Loader2,
  RefreshCcw, Crown, Car,
  ChevronRight, UserCheck,
  MessageSquare, Send
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function MembersManager() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selectedMember, setSelectedMember] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [plans, setPlans] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '', firstName: '', lastName: '', phone: '',
    planId: '', vehicleBrand: '', vehicleModel: '', vehicleYear: new Date().getFullYear(),
    vehicleColor: '', vehiclePlate: '', sendWhatsApp: true,
  });

  useEffect(() => { loadMembers(); loadPlans(); }, []);
  useEffect(() => { loadMembers(); }, [page, search, filterStatus]);

  const loadPlans = async () => {
    try {
      const res = await api.get('/plans');
      setPlans(res.data.data || []);
    } catch (e) { console.error(e); }
  };

  const loadMembers = async (bustCache = false) => {
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      const url = `/members?${params}`;
      if (bustCache) api.invalidate('/members');
      const res = await api.get(url);
      setMembers(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar miembros');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (member) => {
    const newStatus = !member.isActive;
    try {
      await api.put(`/members/${member.id}/status`, { isActive: newStatus });
      toast.success(newStatus ? '✅ Miembro activado' : '⛔ Miembro suspendido');
      // Update local state immediately for instant feedback
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, isActive: newStatus } : m));
      if (selectedMember?.id === member.id) setSelectedMember({ ...selectedMember, isActive: newStatus });
    } catch (err) {
      toast.error('Error al cambiar estado');
    }
  };

  const toggleTestMode = async (member) => {
    const newMode = !member.isTestMode;
    try {
      await api.put(`/members/${member.id}/test-mode`, { isTestMode: newMode });
      toast.success(newMode ? '🧪 Modo de Pruebas Activado' : '🔒 Modo de Pruebas Desactivado');
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, isTestMode: newMode } : m));
      if (selectedMember?.id === member.id) setSelectedMember({ ...selectedMember, isTestMode: newMode });
    } catch (err) {
      toast.error('Error al cambiar modo de pruebas');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post('/auth/admin-create', {
        email: createForm.email,
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        phone: createForm.phone || undefined,
        planId: createForm.planId || undefined,
        vehicleBrand: createForm.vehicleBrand || undefined,
        vehicleModel: createForm.vehicleModel || undefined,
        vehicleYear: createForm.vehicleYear ? parseInt(createForm.vehicleYear) : undefined,
        vehicleColor: createForm.vehicleColor || undefined,
        vehiclePlate: createForm.vehiclePlate || undefined,
        sendWhatsApp: createForm.sendWhatsApp,
      });

      const tempPass = res.data.data?.tempPassword;
      toast.success(
        createForm.sendWhatsApp
          ? `✅ Cliente creado y credenciales enviadas por WhatsApp`
          : `✅ Cliente creado. Contraseña temporal: ${tempPass}`,
        { duration: 8000 }
      );

      setShowCreate(false);
      setCreateForm({
        email: '', firstName: '', lastName: '', phone: '',
        planId: '', vehicleBrand: '', vehicleModel: '', vehicleYear: new Date().getFullYear(),
        vehicleColor: '', vehiclePlate: '', sendWhatsApp: true,
      });
      loadMembers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear cliente');
    }
    setCreating(false);
  };

  if (loading && page === 1) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Cargando miembros...</p>
    </div>
  );

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-white shadow-md">
              <Users size={28} />
            </div>
            Miembros
          </h1>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            {pagination.total || 0} clientes registrados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); loadMembers(); }}
            className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-primary transition-all shadow-sm"
            title="Recargar"
          >
            <RefreshCcw size={18} />
          </button>
          <button className="admin-btn-primary" onClick={() => setShowCreate(true)}>
            <UserPlus size={18} /> Nuevo Cliente
          </button>
        </div>
      </header>

      {/* Search + Filter */}
      <div className="flex flex-col lg:flex-row gap-6 mb-10">
        <div className="flex-1">
          <div className="admin-search-wrapper">
            <Search className="admin-search-icon" size={18} />
            <input
              className="admin-search-input"
              placeholder="Buscar por nombre, email o teléfono..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select
            className="h-14 px-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary transition-all shadow-sm"
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          >
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Suspendidos</option>
          </select>
        </div>
      </div>

      {/* Members Table */}
      <div className="admin-card !p-0 overflow-hidden shadow-xl">
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="pl-10">Cliente</th>
                <th>Contacto</th>
                <th>Membresía</th>
                <th>Estado</th>
                <th>Registro</th>
                <th className="pr-10 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode='popLayout'>
                {members.map((m, i) => (
                  <motion.tr
                    key={m.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.01 }}
                    className="group cursor-pointer"
                    onClick={() => setSelectedMember(m)}
                  >
                    <td className="pl-10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 font-semibold text-xs shadow-sm">
                          {m.firstName?.[0]}{m.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{m.firstName} {m.lastName}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">ID: {m.id.slice(-8).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                          <Mail size={12} className="text-slate-400" /> {m.email}
                        </div>
                        {m.phone && (
                          <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                            <Phone size={12} className="text-slate-400" /> {m.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {m.memberships?.[0]?.plan ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          <Crown size={12} />
                          <span className="text-xs font-bold">{m.memberships[0].plan.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Sin plan</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-col gap-2 items-start">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold
                           ${m.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}
                        `}>
                          <div className={`w-1.5 h-1.5 rounded-full ${m.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {m.isActive ? 'Activo' : 'Suspendido'}
                        </div>
                        {m.isTestMode && (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold border border-amber-500/20">
                            🧪 Pruebas
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </td>
                    <td className="pr-10">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedMember(m); }}
                          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:text-primary hover:bg-primary/10 transition-all flex items-center justify-center"
                        >
                          <ChevronRight size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleStatus(m); }}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${m.isActive ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}
                        >
                          {m.isActive ? <ShieldAlert size={14} /> : <Shield size={14} />}
                        </button>
                      </div>
                      <div className="group-hover:hidden text-slate-300 dark:text-slate-600 text-right pr-2">
                        <ChevronRight size={16} />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-4 py-8 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-primary transition-all disabled:opacity-30 flex items-center gap-2"
            >
              <ArrowRight size={14} className="rotate-180" /> Anterior
            </button>
            <div className="flex items-center gap-2">
              {[...Array(Math.min(pagination.pages, 5))].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${page === i + 1 ? 'bg-primary text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-primary border border-slate-200 dark:border-slate-700'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              disabled={page === pagination.pages}
              onClick={() => setPage(page + 1)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-primary transition-all disabled:opacity-30 flex items-center gap-2"
            >
              Siguiente <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── MEMBER DETAIL MODAL ── */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedMember(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-xl">
                    {selectedMember.firstName?.[0]}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {selectedMember.firstName} {selectedMember.lastName}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{selectedMember.email}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedMember(null)} className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">Teléfono</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedMember.phone || 'No registrado'}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">Fecha de registro</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{new Date(selectedMember.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">Último acceso</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedMember.lastLoginAt ? new Date(selectedMember.lastLoginAt).toLocaleDateString() : 'Sin actividad'}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">Vehículo</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedMember.vehicles?.[0] ? `${selectedMember.vehicles[0].brand} ${selectedMember.vehicles[0].model}` : 'No registrado'}
                    </p>
                  </div>
                </div>

                {selectedMember.memberships?.[0] ? (
                  <div className="p-6 rounded-2xl bg-indigo-600 text-white relative overflow-hidden shadow-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Crown size={18} className="text-amber-300" />
                          <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Membresía Activa</span>
                        </div>
                        <h4 className="text-2xl font-bold">{selectedMember.memberships[0].plan?.name}</h4>
                        <p className="text-sm opacity-70 mt-1 flex items-center gap-2">
                          <Calendar size={12} /> Vence: {new Date(selectedMember.memberships[0].endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold">₲{(selectedMember.memberships[0].plan?.priceGs / 1000).toFixed(0)}K</p>
                        <p className="text-xs opacity-60 mt-1">por mes</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-600 flex flex-col items-center text-center">
                    <AlertCircle size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
                    <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400">Sin membresía activa</h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Este cliente no tiene plan asignado.</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-3 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      🧪
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">Modo de Pruebas</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Permite activar planes sin pagar</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleTestMode(selectedMember)}
                    className={`w-12 h-7 rounded-full transition-all relative ${selectedMember.isTestMode ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1 transition-all ${selectedMember.isTestMode ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => toggleStatus(selectedMember)}
                    className={`flex-1 h-14 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${selectedMember.isActive ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-500 hover:text-white hover:border-rose-500' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-500 hover:bg-emerald-500 hover:text-white hover:border-emerald-500'}`}>
                    {selectedMember.isActive ? <><ShieldAlert size={16} /> Suspender</> : <><Shield size={16} /> Activar</>}
                  </button>
                  {selectedMember.phone && (
                    <a href={`https://wa.me/${selectedMember.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex-1 h-14 rounded-2xl bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all hover:bg-emerald-600">
                      <MessageSquare size={16} /> WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CREATE CLIENT MODAL ── */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCreate(false)}
            />
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registrar Nuevo Cliente</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Se creará la cuenta y se sincronizará con ARIZAR IA</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"><X size={20} /></button>
              </div>

              <form onSubmit={handleCreate} className="p-8 space-y-6">
                {/* Personal info */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                    <UserCheck size={14} /> Datos del cliente
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Nombre *</label>
                      <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all" required value={createForm.firstName} onChange={e => setCreateForm({ ...createForm, firstName: e.target.value })} placeholder="Juan" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Apellido *</label>
                      <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all" required value={createForm.lastName} onChange={e => setCreateForm({ ...createForm, lastName: e.target.value })} placeholder="Pérez" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Email *</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all" type="email" required value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} placeholder="cliente@email.com" />
                  </div>
                  <div className="mt-4">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Teléfono (WhatsApp)</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+595 9XX XXX XXX" />
                  </div>
                </div>

                {/* Plan */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                    <Crown size={14} /> Membresía
                  </p>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all"
                    value={createForm.planId}
                    onChange={e => setCreateForm({ ...createForm, planId: e.target.value })}
                  >
                    <option value="">Sin plan (se asigna después)</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — ₲{p.priceGs?.toLocaleString('es-PY')}/mes</option>
                    ))}
                  </select>
                </div>

                {/* Vehicle */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                    <Car size={14} /> Vehículo (opcional)
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all" value={createForm.vehicleBrand} onChange={e => setCreateForm({ ...createForm, vehicleBrand: e.target.value })} placeholder="Marca (Toyota)" />
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all" value={createForm.vehicleModel} onChange={e => setCreateForm({ ...createForm, vehicleModel: e.target.value })} placeholder="Modelo (Hilux)" />
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all" type="number" value={createForm.vehicleYear} onChange={e => setCreateForm({ ...createForm, vehicleYear: e.target.value })} placeholder="Año" />
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all" value={createForm.vehicleColor} onChange={e => setCreateForm({ ...createForm, vehicleColor: e.target.value })} placeholder="Color" />
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-all" value={createForm.vehiclePlate} onChange={e => setCreateForm({ ...createForm, vehiclePlate: e.target.value })} placeholder="Patente" />
                  </div>
                </div>

                {/* WhatsApp toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <div className="flex items-center gap-3">
                    <Send size={18} className="text-emerald-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Enviar credenciales por WhatsApp</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">El cliente recibirá su email y contraseña por WhatsApp</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, sendWhatsApp: !createForm.sendWhatsApp })}
                    className={`w-12 h-7 rounded-full transition-all relative ${createForm.sendWhatsApp ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1 transition-all ${createForm.sendWhatsApp ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                {/* Submit */}
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="flex-1 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-500 dark:text-slate-400 transition-all hover:bg-slate-200 dark:hover:bg-slate-700">
                    Cancelar
                  </button>
                  <button type="submit" disabled={creating}
                    className="flex-[1.5] h-14 rounded-2xl bg-primary text-white text-sm font-bold shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                    {creating ? <Loader2 size={18} className="animate-spin" /> : <><UserPlus size={18} /> Crear Cliente</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
