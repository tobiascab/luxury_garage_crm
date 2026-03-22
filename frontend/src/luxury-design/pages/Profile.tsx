import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  CreditCard,
  Car,
  Shield,
  Settings,
  Plus,
  Trash2,
  CheckCircle2,
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
  AlertCircle
} from 'lucide-react';

import { API_URL } from '../config';

interface ProfileProps {
  user: any;
  onLogout: () => void;
  onUpdate: () => void;
}

type ProfileTab = 'datos' | 'pagos' | 'vehiculos' | 'seguridad';

export default function Profile({ user, onLogout, onUpdate }: ProfileProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('datos');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'datos': return <PersonalInfo user={user} onUpdate={onUpdate} />;
      case 'pagos': return <PaymentMethods methods={user.paymentMethods} userId={user.id} onUpdate={onUpdate} />;
      case 'vehiculos': return <MyVehicles vehicles={user.vehicles} />;
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
      <section className="relative overflow-hidden rounded-[2rem] bg-primary dark:bg-blue-600 p-5 text-white shadow-lg transition-colors">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-white/20 overflow-hidden shadow-lg shrink-0">
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h2 className="text-lg font-black tracking-tight truncate">{user.name}</h2>
              <div className="px-2 py-0.5 bg-white/10 rounded-full text-[9px] font-bold tracking-widest uppercase border border-white/10 shrink-0">
                {user.role}
              </div>
            </div>
            <div className="flex flex-col gap-0.5 text-white/60 text-xs">
              <div className="flex items-center gap-1.5"><Mail size={11} />{user.email}</div>
              <div className="flex items-center gap-1.5"><Phone size={11} />{user.phone}</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="p-2 bg-white/10 hover:bg-red-500 rounded-xl transition-all border border-white/10 shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar">
        <TabButton active={activeTab === 'datos'} onClick={() => setActiveTab('datos')} icon={<User size={14} />} label="Datos" />
        <TabButton active={activeTab === 'pagos'} onClick={() => setActiveTab('pagos')} icon={<CreditCard size={14} />} label="Pagos" />
        <TabButton active={activeTab === 'vehiculos'} onClick={() => setActiveTab('vehiculos')} icon={<Car size={14} />} label="Vehículos" />
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
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all duration-200 border ${active
        ? 'bg-primary dark:bg-blue-500 text-white shadow-md shadow-primary/20 border-transparent'
        : 'bg-white dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm border-slate-100 dark:border-slate-800'
        }`}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  );
}

// Sub-components
function PersonalInfo({ user, onUpdate }: { user: any, onUpdate: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [address, setAddress] = useState(user.address || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, address })
      });
      if (res.ok) {
        onUpdate();
        setIsEditing(false);
      }
    } catch (e) {
      alert('Error al actualizar');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-xl font-black text-slate-900 dark:text-white">Datos Personales</h3>
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="text-primary dark:text-blue-400 font-bold text-sm">Editar</button>
          ) : (
            <div className="flex gap-4">
              <button onClick={() => setIsEditing(false)} className="text-slate-400 font-bold text-sm">Cancelar</button>
              <button onClick={handleSave} disabled={isSaving} className="text-primary dark:text-blue-400 font-black text-sm flex items-center gap-2">
                {isSaving ? '...' : <><Save size={16} /> Guardar</>}
              </button>
            </div>
          )}
        </div>
        <div className="space-y-6">
          <EditableField isEditing={isEditing} label="Nombre Completo" value={name} onChange={setName} />
          <EditableField isEditing={isEditing} label="Teléfono" value={phone} onChange={setPhone} />
          <EditableField isEditing={isEditing} label="Correo Electrónico" value={user.email} disabled={true} />
          <EditableField isEditing={isEditing} label="Dirección Habitual" value={address} onChange={setAddress} />
        </div>
      </div>
      {/* Membership Card */}
      <div className="bg-white dark:bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
        <h3 className="font-headline text-xl font-black text-slate-900 dark:text-white">Resumen de Cuenta</h3>
        <div className="p-6 bg-slate-900 dark:bg-slate-800/80 rounded-3xl text-white relative overflow-hidden shadow-inner border border-white/5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/20 rounded-full blur-3xl opacity-50" />
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <Sparkles size={24} className="text-secondary" />
            </div>
            <div>
              <p className="text-[8px] font-bold text-white/50 uppercase tracking-[0.2em] mb-1">Membresía</p>
              <p className="text-xl font-black italic">{user.role}</p>
            </div>
          </div>
          <div className="space-y-3 relative z-10">
            <StatusItem label="Estado" value={user.membership_status} />
            <StatusItem label="Miembro desde" value={new Date(user.created_at).toLocaleDateString()} />
          </div>
        </div>
      </div>
    </div>
  );
}

function EditableField({ isEditing, label, value, onChange, disabled }: any) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</p>
      {isEditing && !disabled ? (
        <input
          className="w-full bg-slate-50 dark:bg-slate-800/60 border-none rounded-xl px-4 py-2 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/10 transition-colors"
          value={value}
          onChange={e => onChange?.(e.target.value)}
        />
      ) : (
        <p className="text-slate-900 dark:text-slate-200 font-bold px-1">{value}</p>
      )}
    </div>
  );
}

function StatusItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="opacity-60">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function PaymentMethods({ methods, userId, onUpdate }: { methods: any[], userId: number, onUpdate: () => void }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCard, setNewCard] = useState({ number: '', name: '', expiry: '' });
  const [isAdding, setIsAdding] = useState(false);

  const handleDelete = async (cardId: number) => {
    if (!confirm('¿Deseas eliminar esta tarjeta?')) return;
    try {
      const res = await fetch(`${API_URL}/api/users/payments/${cardId}`, { method: 'DELETE' });
      if (res.ok) onUpdate();
    } catch (e) { alert('Error al eliminar'); }
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCard.number || !newCard.name || !newCard.expiry) return alert('Por favor, completa todos los campos.');
    setIsAdding(true);
    try {
      const card_type = newCard.number.startsWith('4') ? 'Visa' : 'Mastercard';
      const last4 = newCard.number.slice(-4);
      const res = await fetch(`${API_URL}/api/users/${userId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_type,
          last4,
          holder_name: newCard.name.toUpperCase(),
          expiry_date: newCard.expiry
        })
      });
      if (res.ok) {
        onUpdate();
        setShowAddModal(false);
        setNewCard({ number: '', name: '', expiry: '' });
      }
    } catch (e) { alert('Error de conexión'); } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h3 className="font-headline text-2xl font-black text-slate-900 dark:text-white">Mis Tarjetas</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-3 px-6 py-3 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black text-xs hover:shadow-lg transition-all"
        >
          <Plus size={18} /> AÑADIR NUEVA
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {methods.map((method) => (
          <motion.div
            key={method.id}
            whileHover={{ y: -5 }}
            className={`relative p-8 rounded-[2rem] text-white overflow-hidden shadow-xl ${method.is_default ? 'bg-gradient-to-br from-[#1a365d] to-[#0d1b2e]' : 'bg-gradient-to-br from-[#2d3748] to-[#1a202c]'
              } group border border-white/5`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="flex justify-between items-start mb-12">
              <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg text-[10px] font-black tracking-widest border border-white/10">
                {method.card_type.toUpperCase()}
              </div>
              <button onClick={() => handleDelete(method.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-red-500/20 hover:bg-red-500 rounded-xl">
                <Trash2 size={16} />
              </button>
            </div>
            <p className="text-xl font-bold tracking-[0.2em] mb-12 truncate">•••• •••• •••• {method.last4}</p>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[7px] font-bold uppercase opacity-50 mb-1 tracking-widest">Titular</p>
                <p className="text-[11px] font-black truncate">{method.holder_name}</p>
              </div>
              <div className="text-right">
                <p className="text-[7px] font-bold uppercase opacity-50 mb-1 tracking-widest">Expira</p>
                <p className="text-[11px] font-black">{method.expiry_date}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add Card Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline text-xl font-black text-slate-900 dark:text-white">Añadir Tarjeta</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                  <X size={20} className="text-slate-600 dark:text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleAddCard} className="space-y-5">
                <div>
                  <label className="text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-500">Número de Tarjeta</label>
                  <input
                    type="text"
                    placeholder="0000 0000 0000 0000"
                    maxLength={16}
                    value={newCard.number}
                    onChange={(e) => setNewCard({ ...newCard, number: e.target.value.replace(/\D/g, '') })}
                    className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/20 dark:focus:ring-blue-500/20 font-bold dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-500">Titular</label>
                    <input
                      type="text"
                      placeholder="Nombre"
                      value={newCard.name}
                      onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                      className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/20 dark:focus:ring-blue-500/20 font-bold dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-500">Expira</label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      maxLength={5}
                      value={newCard.expiry}
                      onChange={(e) => setNewCard({ ...newCard, expiry: e.target.value })}
                      className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/20 dark:focus:ring-blue-500/20 font-bold dark:text-white"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="w-full py-4 mt-4 bg-primary dark:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-sm hover:shadow-lg transition-all"
                >
                  {isAdding ? 'Guardando...' : 'Guardar Tarjeta'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MyVehicles({ vehicles }: { vehicles: any[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {vehicles.map((v) => (
        <div key={v.id} className="bg-white dark:bg-slate-900/40 rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-100 dark:border-slate-800 group transition-colors">
          <div className="relative h-48">
            <img src={v.image_url} alt={v.model} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-full text-[10px] font-black text-primary dark:text-blue-400">
              {v.status}
            </div>
          </div>
          <div className="p-8">
            <h4 className="font-bold text-xl mb-1 dark:text-white">{v.model}</h4>
            <p className="text-slate-400 text-sm mb-6">Placa: <span className="text-slate-900 dark:text-slate-200 font-bold">{v.plate}</span></p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl">
                <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Kilometraje</p>
                <p className="text-lg font-black dark:text-white">{v.mileage}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl">
                <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Color</p>
                <p className="text-lg font-black dark:text-white">{v.color}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SecuritySettings({ userId, onLogout }: { userId: number, onLogout: () => void }) {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '' });
  const [showPwd, setShowPwd] = useState({ current: false, new: false });
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current || !passwords.new) return alert('Completa todos los campos');
    setIsUpdating(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.new })
      });
      if (res.ok) {
        alert('Contraseña actualizada. Por seguridad vuelve a iniciar sesión.');
        onLogout();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al actualizar');
      }
    } catch (e) { alert('Error de conexión'); } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white dark:bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
        <h3 className="font-headline text-xl font-black mb-6 dark:text-white">Seguridad</h3>
        <div className="space-y-4">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-primary dark:text-blue-400" />
              <span className="font-bold text-sm dark:text-slate-200">Cambiar Contraseña</span>
            </div>
            <ChevronRight size={20} className="text-slate-300 dark:text-slate-600" />
          </button>
          <button
            className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors opacity-60"
          >
            <div className="flex items-center gap-3">
              <Settings size={20} className="text-primary dark:text-blue-400" />
              <span className="font-bold text-sm dark:text-slate-200">Privacidad</span>
            </div>
            <ChevronRight size={20} className="text-slate-300 dark:text-slate-600" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline text-xl font-black text-slate-900 dark:text-white">Cambiar Contraseña</h3>
                <button onClick={() => setShowPasswordModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <X size={20} className="text-slate-600 dark:text-slate-400" />
                </button>
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
                </div>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-lg shadow-primary/20 transition-all"
                >
                  {isUpdating ? 'Actualizando...' : 'Confirmar Cambios'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
