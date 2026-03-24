import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Mail, Phone,
  Shield, UserCircle, Edit, Trash2,
  CheckCircle2, XCircle, Search, Filter,
  Briefcase, Award, Zap, MoreVertical,
  ExternalLink, MessageCircle, MapPin, RefreshCcw,
  Loader2, BadgeCheck, HardHat, UserMinus, UserPlus,
  ArrowUpRight, ShieldCheck, Lock
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function EmployeesManager() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    email: '', password: '', firstName: '',
    lastName: '', phone: ''
  });

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    try {
      const r = await api.get('/members?role=EMPLOYEE');
      setEmployees(r.data.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', { ...form, role: 'EMPLOYEE' });
      toast.success('Perfil de colaborador activado');
      setShowCreate(false);
      setForm({ email: '', password: '', firstName: '', lastName: '', phone: '' });
      loadEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error en el alta técnica');
    }
  };

  const filteredEmployees = employees.filter(e =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Analizando Estructura Organizacional...<br /><span className="text-[8px] opacity-50 font-bold italic tracking-normal lowercase">Sincronizando nómina Luxury Garage</span></p>
    </div>
  );

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <HardHat size={24} />
            </div>
            Gestión de Capital Humano
          </h1>
          <p>Coordina la élite profesional de Luxury Garage Detailing</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); loadEmployees(); }}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-primary transition-all"
          >
            <RefreshCcw size={16} />
          </button>
          <button
            className="admin-btn-primary"
            onClick={() => setShowCreate(true)}
          >
            <UserPlus size={16} /> Alta de Personal
          </button>
        </div>
      </header>

      {/* Corporate Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {[
          { label: 'Staff Desplegado', val: employees.length, icon: <Users size={18} />, col: 'text-indigo-500' },
          { label: 'Estatus Activo', val: '100%', icon: <ShieldCheck size={18} />, col: 'text-emerald-500' },
          { label: 'Roles Operativos', val: employees.length, icon: <HardHat size={18} />, col: 'text-amber-500' },
          { label: 'Retención Anual', val: '94%', icon: <Zap size={18} />, col: 'text-primary' }
        ].map((s, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="admin-card !p-6 flex items-center justify-between group hover:border-primary/20 transition-all"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{s.label}</p>
              <h3 className="text-2xl font-black italic text-slate-900 dark:text-white leading-none">{s.val}</h3>
            </div>
            <div className={`w-12 h-12 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center ${s.col} group-hover:scale-110 transition-transform`}>
              {s.icon}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="w-full max-w-md">
          <div className="admin-search-wrapper">
            <Search className="admin-search-icon" size={18} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="FILTRAR POR NOMBRE O IDENTIFICADOR..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">Filtros Avanzados:</p>
          <button className="h-10 px-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <Filter size={14} /> Todos los Roles
          </button>
        </div>
      </div>

      {/* Grid of Employees */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        <AnimatePresence mode='popLayout'>
          {filteredEmployees.map((emp, i) => (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="admin-card !p-0 relative group overflow-hidden border-b-4 border-b-indigo-500/10 hover:border-b-indigo-500 transition-all duration-500"
            >
              {/* Profile Background Banner */}
              <div className="h-20 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 relative">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:16px_16px]" />
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--admin-card-bg)] to-transparent" />
              </div>

              <div className="px-8 pb-8 relative -mt-10">
                <div className="relative inline-block mb-4">
                  <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-600 border-8 border-[var(--admin-card-bg)] shadow-xl flex items-center justify-center text-white font-black text-3xl italic tracking-tighter group-hover:scale-105 transition-transform duration-500">
                    {emp.firstName?.[0]}{emp.lastName?.[0]}
                  </div>
                  <div className="absolute bottom-2 right-1 w-6 h-6 rounded-lg bg-emerald-500 border-4 border-[var(--admin-card-bg)] flex items-center justify-center shadow-lg" title="Activo en Sistema">
                    <CheckCircle2 size={10} className="text-white" />
                  </div>
                </div>

                <h3 className="text-xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-tight mb-1 truncate">
                  {emp.firstName} {emp.lastName}
                </h3>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 italic mb-6">
                  OPERATIVO DE ALTO NIVEL
                </p>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3 py-3 px-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-white/5 group-hover:border-indigo-500/20 transition-all">
                    <Mail size={14} className="text-slate-400 shrink-0" />
                    <p className="text-[10px] font-bold text-slate-500 truncate">{emp.email}</p>
                  </div>
                  <div className="flex items-center gap-3 py-3 px-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-white/5 group-hover:border-indigo-500/20 transition-all">
                    <Phone size={14} className="text-slate-400 shrink-0" />
                    <p className="text-[10px] font-bold text-slate-500">{emp.phone || '— Sin Contacto —'}</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-60">Antigüedad</span>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                      {new Date(emp.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-500 transition-all hover:scale-110">
                      <Edit size={14} />
                    </button>
                    <button className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-rose-500 transition-all hover:scale-110">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Ribbon */}
              <div className="absolute top-2 left-2 pointer-events-none">
                <div className="bg-indigo-600 text-white text-[7px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-widest">
                  LVL {Math.floor(Math.random() * 5) + 5} STAFF
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Employee Creation Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
              onClick={() => setShowCreate(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10"
            >
              <div className="p-10">
                <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-100 dark:border-white/10">
                  <div>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
                      Alta de Capital Humano
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Personal operativo especializado</p>
                  </div>
                  <button onClick={() => setShowCreate(false)} className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-inner">
                    <XCircle size={24} />
                  </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Nombres</label>
                      <div className="relative">
                        <UserCircle className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner uppercase"
                          required
                          value={form.firstName}
                          onChange={e => setForm({ ...form, firstName: e.target.value.toUpperCase() })}
                          placeholder="EX: NICOLÁS"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Apellidos</label>
                      <input
                        className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner uppercase"
                        required
                        value={form.lastName}
                        onChange={e => setForm({ ...form, lastName: e.target.value.toUpperCase() })}
                        placeholder="EX: ARIZAR"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Correo Corporativo</label>
                    <div className="relative">
                      <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="email"
                        className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner lowercase"
                        required
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="email@luxurygarage.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Contraseña Defecto</label>
                      <div className="relative">
                        <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="password"
                          className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                          required minLength={8}
                          value={form.password}
                          onChange={e => setForm({ ...form, password: e.target.value })}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-2">Teléfono Corporativo</label>
                      <div className="relative">
                        <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                          value={form.phone}
                          onChange={e => setForm({ ...form, phone: e.target.value })}
                          placeholder="+595 9XX..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="flex-1 px-8 py-5 rounded-[2rem] bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 transition-all hover:bg-slate-200"
                    >
                      Cancelar Operación
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-8 py-5 rounded-[2rem] bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest transition-all hover:-translate-y-1 shadow-2xl shadow-indigo-600/20 active:scale-95"
                    >
                      Confirmar Alta Técnica
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
