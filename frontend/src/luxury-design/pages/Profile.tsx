import React, { useState, useEffect } from 'react';
import {
  motion,
  AnimatePresence,
  Reveal,
  StaggerList,
  StaggerItem,
  Pressable,
  popIn,
  scaleIn,
  springPop,
  springSoft,
  useReduce,
  Skeleton,
  AnimatedNumber,
} from '../lib/motion';
import {
  User,
  CreditCard,
  Car,
  Shield,
  Settings,
  Plus,
  Trash2,
  ChevronRight,
  Phone,
  Mail,
  LogOut,
  Sparkles,
  Save,
  X,
  Eye,
  EyeOff,
  Loader2,
  Edit2,
  Star,
  FileText,
  Wallet,
  Check,
  Crown,
  BadgeCheck,
  CalendarCheck2,
  AtSign,
  ScrollText,
} from 'lucide-react';

import api from '../../services/api';
import SelectorVehiculo from '../components/SelectorVehiculo';
import ImagenVehiculo from '../components/ImagenVehiculo';
import BottomSheet from '../components/BottomSheet';
import ConfirmDialog from '../components/ConfirmDialog';
import BancardCardManager from '../components/BancardCardManager';
import useScrollLock from '../../hooks/useScrollLock';

interface ProfileProps {
  user: any;
  onLogout: () => void;
  onUpdate: () => void;
}

type ProfileTab = 'datos' | 'pagos' | 'vehiculos' | 'seguridad';

/* ── Helpers de presentación ─────────────────────────────────────────────── */

const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Cliente',
  EMPLOYEE: 'Empleado',
  ADMIN: 'Administrador',
  SUPER_ADMIN: 'Administrador',
};

const roleLabel = (role?: string) => ROLE_LABELS[role ?? ''] ?? 'Cliente';

/** Parsea una fecha y devuelve null si es inválida (evita "Invalid Date"). */
const safeDate = (value?: string | number | Date | null): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

/** "junio 2026" — capitalizado. Devuelve null si la fecha es inválida. */
const formatMonthYear = (value?: string | number | Date | null): string | null => {
  const d = safeDate(value);
  if (!d) return null;
  const s = d.toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "8 jun 2026". Devuelve null si la fecha es inválida. */
const formatShortDate = (value?: string | number | Date | null): string | null => {
  const d = safeDate(value);
  if (!d) return null;
  return d.toLocaleDateString('es-PY', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function Profile({ user, onLogout, onUpdate }: ProfileProps) {
  // El empleado (staff) no es cliente: no tiene billetera, tarjetas ni vehículos propios.
  // Su perfil se limita a Datos + Seguridad (lo indispensable). Las tabs de Pagos/Vehículos
  // no se muestran y quedan bloqueadas por si el estado llega ahí por otra vía.
  const isEmployee = user?.role === 'Empleado' || user?.role === 'EMPLOYEE';
  const [activeTab, setActiveTab] = useState<ProfileTab>('datos');
  const reduce = useReduce();

  const renderTabContent = () => {
    if (isEmployee && (activeTab === 'pagos' || activeTab === 'vehiculos')) {
      return <PersonalInfo user={user} onUpdate={onUpdate} isEmployee={isEmployee} />;
    }
    switch (activeTab) {
      case 'datos': return <PersonalInfo user={user} onUpdate={onUpdate} isEmployee={isEmployee} />;
      case 'pagos': return <PaymentMethods methods={user.paymentMethods || []} userId={user.id} onUpdate={onUpdate} user={user} />;
      case 'vehiculos': return <MyVehicles userId={user.id} initialVehicles={user.vehicles || []} onUpdate={onUpdate} />;
      case 'seguridad': return <SecuritySettings userId={user.id} onLogout={onLogout} />;
      default: return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4 pb-24"
    >
      {/* Header / Profile Summary */}
      <Reveal className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary to-blue-700 dark:from-blue-600 dark:via-blue-600 dark:to-blue-800 p-5 sm:p-6 text-white shadow-lg shadow-primary/20 transition-colors">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute -bottom-10 -left-6 w-32 h-32 bg-secondary/20 rounded-full blur-[60px]" />
        {/* Sheen sweep al montar */}
        {!reduce && (
          <motion.div
            aria-hidden
            initial={{ x: '-130%' }}
            animate={{ x: '130%' }}
            transition={{ duration: 1.1, ease: 'easeInOut', delay: 0.25 }}
            className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-18deg] pointer-events-none"
          />
        )}
        <div className="relative z-10 flex items-center gap-4">
          <motion.div
            variants={popIn}
            initial="hidden"
            animate="show"
            transition={springPop}
            whileTap={{ scale: 0.94 }}
            className="relative w-16 h-16 shrink-0"
          >
            <div className="w-16 h-16 rounded-full border-2 border-white/25 overflow-hidden shadow-lg bg-white/10">
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-full" />
            </div>
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-lg font-black tracking-tight truncate">{user.name}</h2>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/15 rounded-full text-[9px] font-bold tracking-widest uppercase border border-white/10 shrink-0">
                <BadgeCheck size={10} /> {roleLabel(user.role)}
              </div>
            </div>
            <div className="flex flex-col gap-1 text-white/70 text-xs">
              <div className="flex items-center gap-1.5 min-w-0"><Mail size={11} className="shrink-0" /><span className="truncate">{user.email}</span></div>
              {user.phone ? (
                <div className="flex items-center gap-1.5"><Phone size={11} className="shrink-0" />{user.phone}</div>
              ) : (
                <div className="flex items-center gap-1.5 text-white/40 italic"><Phone size={11} className="shrink-0" />Sin teléfono registrado</div>
              )}
            </div>
          </div>
          <Pressable
            onClick={onLogout}
            title="Cerrar sesión"
            className="p-2.5 bg-white/10 hover:bg-red-500 rounded-xl transition-colors border border-white/10 shrink-0"
          >
            <LogOut size={16} />
          </Pressable>
        </div>
      </Reveal>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar">
        <TabButton active={activeTab === 'datos'} onClick={() => setActiveTab('datos')} icon={<User size={14} />} label="Datos" />
        {!isEmployee && <TabButton active={activeTab === 'pagos'} onClick={() => setActiveTab('pagos')} icon={<CreditCard size={14} />} label="Pagos" />}
        {!isEmployee && <TabButton active={activeTab === 'vehiculos'} onClick={() => setActiveTab('vehiculos')} icon={<Car size={14} />} label="Vehículos" />}
        <TabButton active={activeTab === 'seguridad'} onClick={() => setActiveTab('seguridad')} icon={<Shield size={14} />} label="Seguridad" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {renderTabContent()}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  const reduce = useReduce();
  return (
    <motion.button
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.95 }}
      transition={springPop}
      className={`relative flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-colors duration-200 border ${active
        ? 'text-white shadow-md shadow-primary/20 border-transparent'
        : 'bg-white dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm border-slate-100 dark:border-slate-800'
        }`}
    >
      {active && (
        <motion.span
          layoutId={reduce ? undefined : 'profileTabActive'}
          className="absolute inset-0 rounded-xl bg-primary dark:bg-blue-500"
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5">
        {icon}
        <span className="text-xs">{label}</span>
      </span>
    </motion.button>
  );
}

// Sub-components
function PersonalInfo({ user, onUpdate, isEmployee = false }: { user: any, onUpdate: () => void, isEmployee?: boolean }) {
  const reduce = useReduce();
  const [showModal, setShowModal] = useState(false);
  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2600);
  };

  // Abrir el modal de edición precargando los valores reales actuales.
  const openEdit = () => {
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setPhone(user.phone ?? '');
    setSaved(false);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      showToast('Nombre y apellido son obligatorios', false);
      return;
    }
    setIsSaving(true);
    try {
      await api.put('/auth/me', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
      });
      setSaved(true);
      onUpdate();
      showToast('Datos actualizados ✓');
      setTimeout(() => {
        setShowModal(false);
        setSaved(false);
      }, 850);
    } catch {
      showToast('No se pudo guardar. Intentá de nuevo', false);
    } finally {
      setIsSaving(false);
    }
  };

  const phoneMissing = !user.phone || !String(user.phone).trim();
  const inputCls = "w-full bg-slate-50 dark:bg-slate-800 border border-transparent rounded-xl px-4 py-3 font-bold text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none";
  const labelCls = "block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5";

  return (
    <>
      <StaggerList className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ── Datos Personales ── */}
        <StaggerItem className="bg-white dark:bg-slate-900/40 p-6 sm:p-7 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-blue-500/15 flex items-center justify-center text-primary dark:text-blue-400">
                <User size={17} />
              </div>
              <h3 className="font-headline text-lg font-black text-slate-900 dark:text-white">Datos Personales</h3>
            </div>
            <Pressable tapOnly onClick={openEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-primary dark:text-blue-400 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Edit2 size={13} /> Editar
            </Pressable>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <EditableField isEditing={false} icon={<User size={11} />} label="Nombre" value={user.firstName} placeholder="Sin definir" />
              <EditableField isEditing={false} icon={<User size={11} />} label="Apellido" value={user.lastName} placeholder="Sin definir" />
            </div>
            <EditableField isEditing={false} icon={<Phone size={11} />} label="Teléfono" value={user.phone} placeholder="Sin teléfono" />
            <EditableField isEditing={false} icon={<AtSign size={11} />} label="Correo Electrónico" value={user.email} disabled lockedHint="No editable" />
          </div>

          {/* Nudge para completar el perfil (dato real: teléfono faltante) */}
          <AnimatePresence>
            {phoneMissing && (
              <motion.button
                initial={reduce ? undefined : { opacity: 0, y: 6 }}
                animate={reduce ? undefined : { opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: 6 }}
                onClick={openEdit}
                className="mt-5 w-full flex items-center gap-2.5 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 rounded-2xl text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-400/20 flex items-center justify-center shrink-0">
                  <Phone size={13} className="text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 leading-tight">Agregá tu teléfono para recibir avisos de tus turnos.</p>
                <ChevronRight size={15} className="text-amber-500 ml-auto shrink-0" />
              </motion.button>
            )}
          </AnimatePresence>
        </StaggerItem>

        {/* ── Resumen de Cuenta ── (solo cliente: el empleado no tiene billetera/membresía/vehículos) */}
        {!isEmployee && (
        <StaggerItem className="space-y-4">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-blue-500/15 flex items-center justify-center text-primary dark:text-blue-400">
              <Sparkles size={17} />
            </div>
            <h3 className="font-headline text-lg font-black text-slate-900 dark:text-white">Resumen de Cuenta</h3>
          </div>

          <MembershipCard user={user} />

          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={<Wallet size={16} />}
              label="Saldo en billetera"
              value={<AnimatedNumber value={Number(user.wallet_balance || 0)} prefix="₲ " currency />}
            />
            <StatCard
              icon={<Car size={16} />}
              label={`Vehículo${(user.vehicleCount ?? user.vehicles?.length ?? 0) !== 1 ? 's' : ''}`}
              value={<AnimatedNumber value={Number(user.vehicleCount ?? user.vehicles?.length ?? 0)} />}
            />
          </div>
        </StaggerItem>
        )}
      </StaggerList>

      {/* Modal de edición de datos personales */}
      <BottomSheet isOpen={showModal} onClose={() => !isSaving && setShowModal(false)}>
        <div className="px-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-blue-500/15 flex items-center justify-center text-primary dark:text-blue-400">
              <User size={17} />
            </div>
            <h3 className="font-black text-lg text-slate-900 dark:text-white">Editar Datos</h3>
          </div>
          <button onClick={() => !isSaving && setShowModal(false)} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSave} className="px-5 pb-8 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre *</label>
              <input required autoFocus className={inputCls} placeholder="Tu nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Apellido *</label>
              <input required className={inputCls} placeholder="Tu apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Teléfono</label>
            <input type="tel" className={inputCls} placeholder="Ej: 0981 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Correo Electrónico
              <span className="ml-2 normal-case tracking-normal text-slate-300 dark:text-slate-600 font-medium">No editable</span>
            </label>
            <input disabled className={`${inputCls} opacity-60 cursor-not-allowed`} value={user.email} />
          </div>
          <Pressable
            type="submit"
            disabled={isSaving || saved}
            className={`w-full py-4 mt-1 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-lg transition-colors disabled:opacity-70 flex items-center justify-center gap-2 ${saved ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-primary dark:bg-blue-500 shadow-primary/20'}`}
          >
            {isSaving ? <Loader2 className="animate-spin" size={16} /> : saved ? <><Check size={15} /> Guardado</> : <><Save size={15} /> Guardar Cambios</>}
          </Pressable>
        </form>
      </BottomSheet>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black shadow-2xl ${toast.ok ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-red-500 text-white'}`}
          >
            {toast.ok ? <Check size={15} /> : <X size={15} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Tarjeta premium de membresía con sheen, estado pulsante y datos reales. */
function MembershipCard({ user }: { user: any }) {
  const reduce = useReduce();
  const plan = user.activeMembership?.plan;
  const isActive = user.membership_status === 'Activa';
  const planName = plan?.name || (isActive ? 'Membresía Activa' : 'Sin plan activo');
  const memberSince = formatMonthYear(user.createdAt);
  const validUntil = formatShortDate(user.activeMembership?.endDate);
  const priceGs = Number(plan?.priceGs || 0);

  return (
    <motion.div
      whileTap={reduce ? undefined : { scale: 0.985 }}
      whileHover={reduce ? undefined : { y: -3 }}
      transition={springSoft}
      className="relative overflow-hidden rounded-[1.75rem] p-6 text-white shadow-xl shadow-slate-900/25 border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900"
    >
      {/* Glows */}
      <div className="absolute -top-10 -right-8 w-44 h-44 bg-secondary/25 rounded-full blur-3xl" />
      <div className="absolute -bottom-14 -left-12 w-44 h-44 bg-primary/30 rounded-full blur-3xl" />
      {/* Patrón punteado tipo tarjeta */}
      <div className="absolute inset-0 opacity-[0.05] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
      {/* Sheen sweep */}
      {!reduce && (
        <motion.div
          aria-hidden
          initial={{ x: '-160%' }}
          animate={{ x: '160%' }}
          transition={{ duration: 1.3, ease: 'easeInOut', delay: 0.5 }}
          className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-[-20deg] pointer-events-none"
        />
      )}

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-7">
          <motion.div
            variants={popIn}
            initial="hidden"
            animate="show"
            transition={springPop}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-secondary/30 to-secondary/5 border border-white/10 flex items-center justify-center backdrop-blur-md"
          >
            <Crown size={22} className="text-secondary" />
          </motion.div>
          <StatusBadge active={isActive} />
        </div>

        <p className="text-[8px] font-bold text-white/45 uppercase tracking-[0.25em] mb-1">Membresía</p>
        <p className="text-2xl font-black italic tracking-tight leading-tight">{planName}</p>
        {priceGs > 0 && (
          <p className="text-sm font-bold text-secondary mt-1">
            <AnimatedNumber value={priceGs} prefix="₲ " currency />
            <span className="text-white/40 font-medium"> / mes</span>
          </p>
        )}

        <div className="my-5 h-px bg-gradient-to-r from-white/20 via-white/5 to-transparent" />

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[8px] font-bold text-white/40 uppercase tracking-[0.2em] mb-1">Miembro desde</p>
            <p className="text-sm font-bold flex items-center gap-1.5">
              <CalendarCheck2 size={13} className="text-white/40" />
              {memberSince ?? 'Recién llegado'}
            </p>
          </div>
          {validUntil && (
            <div className="text-right">
              <p className="text-[8px] font-bold text-white/40 uppercase tracking-[0.2em] mb-1">Válida hasta</p>
              <p className="text-sm font-bold">{validUntil}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  const reduce = useReduce();
  return (
    <motion.div
      variants={popIn}
      initial="hidden"
      animate="show"
      transition={springPop}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${active ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' : 'bg-white/10 text-white/60 border-white/10'}`}
    >
      <span className="relative flex h-2 w-2">
        {active && !reduce && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${active ? 'bg-emerald-400' : 'bg-white/40'}`} />
      </span>
      {active ? 'Activa' : 'Inactiva'}
    </motion.div>
  );
}

/** Mini-tarjeta de estadística (saldo, vehículos…). */
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <motion.div
      {...(useReduce() ? {} : { whileTap: { scale: 0.97 } })}
      className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 transition-colors"
    >
      <div className="w-8 h-8 rounded-xl bg-primary/10 dark:bg-blue-500/15 flex items-center justify-center text-primary dark:text-blue-400 mb-2.5">
        {icon}
      </div>
      <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{value}</p>
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1.5">{label}</p>
    </motion.div>
  );
}

function EditableField({ isEditing, label, value, onChange, disabled, icon, placeholder, type = 'text', lockedHint }: any) {
  const reduce = useReduce();
  const empty = !value || !String(value).trim();
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
        {icon}
        {label}
        {disabled && lockedHint && <span className="ml-auto text-[8px] text-slate-300 dark:text-slate-600 normal-case tracking-normal font-medium">{lockedHint}</span>}
      </p>
      <AnimatePresence mode="wait" initial={false}>
        {isEditing && !disabled ? (
          <motion.input
            key="input"
            initial={reduce ? undefined : { opacity: 0, y: -4 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            type={type}
            placeholder={placeholder}
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 rounded-xl px-4 py-2.5 font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:font-medium focus:ring-2 focus:ring-primary/25 focus:border-primary/40 outline-none transition-all"
            value={value ?? ''}
            onChange={(e) => onChange?.(e.target.value)}
          />
        ) : (
          <motion.p
            key="view"
            initial={reduce ? undefined : { opacity: 0 }}
            animate={reduce ? undefined : { opacity: 1 }}
            transition={{ duration: 0.15 }}
            className={`font-bold px-1 ${empty ? 'text-slate-300 dark:text-slate-600 italic font-medium' : 'text-slate-900 dark:text-slate-200'} ${disabled ? 'opacity-70' : ''}`}
          >
            {empty ? (placeholder ?? '—') : value}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function PaymentMethods({ onUpdate }: { methods: any[], userId: number, onUpdate: () => void, user: any }) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CreditCard size={16} className="text-primary dark:text-blue-400 shrink-0" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Medios de Pago</p>
      </div>

      {/* Tarjetas gestionadas con Bancard (listar / agregar / eliminar / principal) */}
      <BancardCardManager onChange={onUpdate} />
    </div>
  );
}
function MyVehicles({ userId, initialVehicles, onUpdate }: { userId: string; initialVehicles: any[]; onUpdate: () => void }) {
  const [vehicles, setVehicles] = useState<any[]>(initialVehicles);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const defaultForm = { brand: '', model: '', year: new Date().getFullYear(), licensePlate: '', color: '', mileage: '', notes: '' };
  const [form, setForm] = useState(defaultForm);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const refresh = async () => {
    const res = await api.get('/vehicles');
    const list = Array.isArray(res.data?.data) ? res.data.data : [];
    setVehicles(list);
    onUpdate();
  };

  // Al montar, reemplazar la lista sembrada (capada a 5 desde el perfil) por la real completa.
  useEffect(() => {
    let alive = true;
    api.get('/vehicles')
      .then((res) => {
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        if (alive) setVehicles(list);
      })
      .catch(() => { /* mantiene la lista sembrada si falla */ });
    return () => { alive = false; };
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (v: any) => {
    setEditing(v);
    setForm({ brand: v.brand ?? '', model: v.model ?? '', year: v.year ?? new Date().getFullYear(), licensePlate: v.licensePlate ?? '', color: v.color ?? '', mileage: v.mileage ?? '', notes: v.notes ?? '' });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editing) {
        await api.put(`/vehicles/${editing.id}`, form);
        showToast('Vehículo actualizado ✓');
      } else {
        await api.post('/vehicles', form);
        showToast('Vehículo agregado ✓');
      }
      setShowModal(false);
      await refresh();
    } catch (e: any) {
      showToast(e?.response?.data?.message ?? 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await api.delete(`/vehicles/${toDelete.id}`);
      showToast('Vehículo eliminado');
      await refresh();
    } catch {
      showToast('Error al eliminar');
    } finally {
      setToDelete(null);
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await api.put(`/vehicles/${id}/primary`, {});
      showToast('Vehículo principal actualizado ✓');
      await refresh();
    } catch { showToast('Error'); }
  };

  const inputCls = "w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none";
  const labelCls = "block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{vehicles.length} vehículo{vehicles.length !== 1 ? 's' : ''} registrado{vehicles.length !== 1 ? 's' : ''}</p>
        <Pressable
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary dark:bg-blue-500 text-white rounded-xl font-black text-xs shadow-md shadow-primary/20 hover:shadow-primary/30 transition-colors"
        >
          <Plus size={14} /> Agregar Vehículo
        </Pressable>
      </div>

      {/* Vehicle Cards */}
      {vehicles.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Car size={28} className="text-slate-300 dark:text-slate-600" />
          </div>
          <p className="font-bold text-slate-400 dark:text-slate-500 text-sm">No tenés vehículos registrados</p>
          <Pressable tapOnly onClick={openAdd} className="mt-4 mx-auto text-primary dark:text-blue-400 font-black text-xs uppercase tracking-widest hover:underline">
            + Agregar tu primer vehículo
          </Pressable>
        </div>
      ) : (
        <StaggerList className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          {vehicles.map(v => (
            <StaggerItem
              key={v.id}
              layout
              className={`md:flex md:flex-col bg-white dark:bg-slate-900/40 rounded-[1.5rem] border transition-colors overflow-hidden ${v.isPrimary ? 'border-primary/30 dark:border-blue-500/30' : 'border-slate-100 dark:border-slate-800'
                }`}
            >
              {/* El auto, arriba y en grande: es lo que el cliente reconoce de un vistazo.
                  Sale su propia foto si la tiene; si no, la del catálogo; si tampoco,
                  una silueta según el tipo de carrocería. */}
              <div className={`px-4 pt-4 ${v.isPrimary ? 'bg-primary/5 dark:bg-blue-500/5' : ''}`}>
                <div className="h-28 flex items-center justify-center">
                  <ImagenVehiculo marca={v.brand} modelo={v.model} fotoUrl={v.photoUrl} className="max-h-28 w-auto" />
                </div>
              </div>

              {/* Card Header */}
              <div className={`flex items-start gap-4 p-4 ${v.isPrimary ? 'bg-primary/5 dark:bg-blue-500/5' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">
                      {v.brand} {v.model} {v.year ? `(${v.year})` : ''}
                    </h4>
                    {v.isPrimary && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-400 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0">
                        <Star size={8} fill="currentColor" /> Principal
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                    {v.licensePlate && <span className="text-xs font-bold text-slate-500 dark:text-slate-400">🪧 {v.licensePlate}</span>}
                    {v.color && <span className="text-xs font-bold text-slate-500 dark:text-slate-400">🎨 {v.color}</span>}
                    {v.mileage && <span className="text-xs font-bold text-slate-500 dark:text-slate-400">📍 {Number(v.mileage).toLocaleString()} km</span>}
                  </div>
                  {v.notes && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 italic truncate">{v.notes}</p>}
                </div>
              </div>

              {/* Card Actions */}
              <div className="flex border-t border-slate-50 dark:border-slate-800 md:mt-auto">
                {!v.isPrimary && (
                  <Pressable
                    tapOnly
                    onClick={() => handleSetPrimary(v.id)}
                    className="flex-1 py-3 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <Star size={12} /> Marcar principal
                  </Pressable>
                )}
                <Pressable
                  tapOnly
                  onClick={() => openEdit(v)}
                  className="flex-1 py-3 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border-l border-slate-50 dark:border-slate-800"
                >
                  <Edit2 size={12} /> Editar
                </Pressable>
                <Pressable
                  tapOnly
                  onClick={() => setToDelete(v)}
                  className="flex-1 py-3 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border-l border-slate-50 dark:border-slate-800"
                >
                  <Trash2 size={12} /> Eliminar
                </Pressable>
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[400] bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3 rounded-2xl text-xs font-black shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Edit BottomSheet */}
      <BottomSheet isOpen={showModal} onClose={() => setShowModal(false)}>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h3 className="font-black text-lg text-slate-900 dark:text-white">
            {editing ? 'Editar Vehículo' : 'Agregar Vehículo'}
          </h3>
          <button onClick={() => setShowModal(false)} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSave} className="px-5 pb-8 pt-3 space-y-3">
          {/* Marca y modelo se eligen de la lista con buscador, no se escriben: así el
              historial del vehículo queda agrupable y sin variantes mal tipeadas. */}
          <SelectorVehiculo
            marca={form.brand}
            modelo={form.model}
            onChange={({ marca, modelo }) => setForm({ ...form, brand: marca, model: modelo })}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Año</label>
              <input type="number" min={1980} max={2030} className={inputCls} placeholder="2023" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Chapa / Placa *</label>
              <input required className={inputCls} placeholder="ABC 123" value={form.licensePlate} onChange={e => setForm({ ...form, licensePlate: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className={labelCls}>Color</label>
              <input className={inputCls} placeholder="Blanco" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Kilometraje</label>
              <input type="number" min={0} className={inputCls} placeholder="50000" value={form.mileage} onChange={e => setForm({ ...form, mileage: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notas adicionales</label>
            <textarea rows={2} className={`${inputCls} resize-none`} placeholder="Ej: vidrios polarizados, techo solar..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <Pressable
            type="submit"
            disabled={isSaving}
            className="w-full py-4 mt-1 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={15} /> {editing ? 'Guardar Cambios' : 'Agregar Vehículo'}</>}
          </Pressable>
        </form>
      </BottomSheet>

      {/* Confirmación de borrado (reemplaza window.confirm nativo) */}
      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="Eliminar vehículo"
        message={toDelete ? `¿Seguro que querés eliminar ${[toDelete.brand, toDelete.model].filter(Boolean).join(' ')}? Esta acción no se puede deshacer.` : ''}
        confirmText="Eliminar"
        icon={<Trash2 size={26} />}
      />
    </div>
  );
}

function SecuritySettings({ userId, onLogout }: { userId: number, onLogout: () => void }) {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '' });
  const [showPwd, setShowPwd] = useState({ current: false, new: false });
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 'terms' | 'privacy' | null → documento legal abierto en el sheet
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null);

  // Bloquea el scroll del fondo mientras el modal de cambio de contraseña está abierto
  useScrollLock(showPasswordModal);

  // Requisitos que valida el backend (POST /auth/change-password)
  const rules = [
    { ok: passwords.new.length >= 8, label: 'Mínimo 8 caracteres' },
    { ok: /[A-Z]/.test(passwords.new), label: 'Una mayúscula' },
    { ok: /[0-9]/.test(passwords.new), label: 'Un número' },
  ];
  const allValid = rules.every((r) => r.ok);

  const closeModal = () => {
    setShowPasswordModal(false);
    setError(null);
    setPasswords({ current: '', new: '' });
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!passwords.current) return setError('Ingresá tu contraseña actual');
    if (!allValid) return setError('La nueva contraseña no cumple los requisitos');
    setIsUpdating(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.new,
      });
      onLogout();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo actualizar la contraseña');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Reveal className="bg-white dark:bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
        <h3 className="font-headline text-xl font-black mb-6 dark:text-white">Seguridad</h3>
        <StaggerList className="space-y-4">
          <StaggerItem>
            <Pressable
              onClick={() => setShowPasswordModal(true)}
              className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-primary dark:text-blue-400" />
                <span className="font-bold text-sm dark:text-slate-200">Cambiar Contraseña</span>
              </div>
              <ChevronRight size={20} className="text-slate-300 dark:text-slate-600" />
            </Pressable>
          </StaggerItem>
          <StaggerItem>
            <Pressable
              onClick={() => setLegalDoc('terms')}
              className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ScrollText size={20} className="text-primary dark:text-blue-400" />
                <span className="font-bold text-sm dark:text-slate-200">Términos y Condiciones</span>
              </div>
              <ChevronRight size={20} className="text-slate-300 dark:text-slate-600" />
            </Pressable>
          </StaggerItem>
          <StaggerItem>
            <Pressable
              onClick={() => setLegalDoc('privacy')}
              className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-primary dark:text-blue-400" />
                <span className="font-bold text-sm dark:text-slate-200">Política de Privacidad</span>
              </div>
              <ChevronRight size={20} className="text-slate-300 dark:text-slate-600" />
            </Pressable>
          </StaggerItem>
        </StaggerList>
      </Reveal>

      {/* Sheet con el texto legal real (GET /settings/legal) */}
      <LegalSheet doc={legalDoc} onClose={() => setLegalDoc(null)} />

      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              variants={scaleIn}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto overscroll-contain"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline text-xl font-black text-slate-900 dark:text-white">Cambiar Contraseña</h3>
                <Pressable onClick={closeModal} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <X size={20} className="text-slate-600 dark:text-slate-400" />
                </Pressable>
              </div>
              <form onSubmit={handleUpdatePassword} className="space-y-5">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Contraseña Actual</label>
                  <div className="relative">
                    <input
                      type={showPwd.current ? 'text' : 'password'}
                      value={passwords.current}
                      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      className="w-full mt-1 pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold dark:text-white"
                    />
                    <button type="button" onClick={() => setShowPwd({ ...showPwd, current: !showPwd.current })} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPwd.current ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Nueva Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPwd.new ? 'text' : 'password'}
                      value={passwords.new}
                      onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      className="w-full mt-1 pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold dark:text-white"
                    />
                    <button type="button" onClick={() => setShowPwd({ ...showPwd, new: !showPwd.new })} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPwd.new ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {/* Checklist de requisitos */}
                  <AnimatePresence>
                    {passwords.new.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 overflow-hidden"
                      >
                        {rules.map((r) => (
                          <span key={r.label} className={`flex items-center gap-1.5 text-[11px] font-bold transition-colors ${r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            <motion.span animate={{ scale: r.ok ? [1, 1.3, 1] : 1 }} transition={{ duration: 0.3 }}>
                              {r.ok ? <Check size={13} /> : <span className="inline-block w-[13px] text-center">•</span>}
                            </motion.span>
                            {r.label}
                          </span>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Error inline */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200/70 dark:border-red-500/20 rounded-xl text-xs font-bold text-red-600 dark:text-red-400"
                    >
                      <X size={14} className="shrink-0" /> {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-snug">
                  Por seguridad, vas a cerrar sesión luego de cambiar tu contraseña.
                </p>

                <Pressable
                  type="submit"
                  disabled={isUpdating || !allValid || !passwords.current}
                  className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-lg shadow-primary/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUpdating ? <><Loader2 size={16} className="animate-spin" /> Actualizando</> : 'Confirmar Cambios'}
                </Pressable>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Sheet de documentos legales (T&C / Privacidad) ───────────────────────────
   Carga el texto REAL desde GET /settings/legal (endpoint público) y lo muestra
   en un BottomSheet. El admin lo edita desde Configuración → Legal. */
const LEGAL_TITLES: Record<'terms' | 'privacy', string> = {
  terms: 'Términos y Condiciones',
  privacy: 'Política de Privacidad',
};

function LegalSheet({ doc, onClose }: { doc: 'terms' | 'privacy' | null; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [content, setContent] = useState<{ text: string; updatedAt: string | null }>({ text: '', updatedAt: null });

  useEffect(() => {
    if (!doc) return;
    let active = true;
    setLoading(true);
    setError(false);
    api.get('/settings/legal')
      .then((res) => {
        if (!active) return;
        const d = res.data?.data?.[doc] || {};
        setContent({ text: typeof d.text === 'string' ? d.text : '', updatedAt: d.updatedAt || null });
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [doc]);

  const updated = content.updatedAt ? new Date(content.updatedAt) : null;
  const updatedLabel = updated && !isNaN(updated.getTime())
    ? updated.toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <BottomSheet isOpen={!!doc} onClose={onClose} height="full">
      <div className="px-5 pb-2 pt-1 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-blue-500/15 flex items-center justify-center text-primary dark:text-blue-400 shrink-0">
            <ScrollText size={17} />
          </div>
          <h3 className="font-black text-lg text-slate-900 dark:text-white truncate">{doc ? LEGAL_TITLES[doc] : ''}</h3>
        </div>
        <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0">
          <X size={18} />
        </button>
      </div>

      <div className="px-5 pb-10 pt-3">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-11/12 rounded" />
            <Skeleton className="h-4 w-10/12 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-9/12 rounded" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <FileText size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-bold text-slate-400">No se pudo cargar el documento. Intentá de nuevo.</p>
          </div>
        ) : !content.text.trim() ? (
          <div className="text-center py-16">
            <FileText size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-bold text-slate-400">Este documento aún no fue publicado.</p>
          </div>
        ) : (
          <>
            {updatedLabel && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
                Última actualización: {updatedLabel}
              </p>
            )}
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {content.text}
            </p>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
