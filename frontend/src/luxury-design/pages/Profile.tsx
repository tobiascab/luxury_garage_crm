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
  AlertCircle,
  Edit2,
  Star,
  FileText,
  Download,
  Receipt,
  Calendar,
  Clock,
} from 'lucide-react';

import api from '../../services/api';
import { toast as hotToast } from 'react-hot-toast';
import BottomSheet from '../components/BottomSheet';

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
      const res = await fetch(`/api/members/${user.id}`, {
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

function PaymentMethods({ methods, userId, onUpdate, user }: { methods: any[], userId: number, onUpdate: () => void, user: any }) {
  const [subTab, setSubTab] = useState<'tarjetas' | 'facturas'>('tarjetas');
  const [cards, setCards] = useState<any[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [cardRegistration, setCardRegistration] = useState<{ processId: string; jsLibUrl: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('luxury_token');
  const headers: any = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const API = (window as any).__API_URL || '';

  useEffect(() => {
    loadCards();
  }, []);

  useEffect(() => {
    if (subTab === 'facturas') loadInvoices();
  }, [subTab]);

  // Auto-handle Bancard redirect callback: ?cardRegistered=1&status=...&description=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('cardRegistered') !== '1') return;
    const status = params.get('status');
    const description = params.get('description');

    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('cardRegistered');
      url.searchParams.delete('status');
      url.searchParams.delete('description');
      window.history.replaceState({}, '', url.toString());
    };

    (async () => {
      if (status === 'add_new_card_success') {
        try {
          await api.post('/payments/card/sync');
          hotToast.success('¡Tarjeta agregada exitosamente!');
        } catch {
          hotToast.error('Tarjeta agregada en Bancard, pero falló la sincronización local');
        }
        loadCards();
        onUpdate?.();
      } else if (status === 'add_new_card_fail') {
        const isDuplicate = description?.toLowerCase().includes('catastrada');
        if (isDuplicate) {
          try {
            await api.post('/payments/card/sync');
            hotToast.success('Tarjeta sincronizada desde Bancard');
          } catch {
            hotToast.error(description || 'No se pudo agregar la tarjeta');
          }
          loadCards();
        } else {
          hotToast.error(description || 'No se pudo agregar la tarjeta');
        }
      }
      cleanUrl();
    })();
  }, []);

  const loadCards = async () => {
    setLoadingCards(true);
    try {
      const [cardsRes, statusRes] = await Promise.all([
        api.get('/payments/cards'),
        api.get('/payments/status'),
      ]);
      const cardsData = cardsRes.data;
      if (cardsData.success) setCards(cardsData.data || []);

      const statusData = statusRes.data;
      // status check for future use
    } catch { /* silent */ }
    setLoadingCards(false);
  };

  const loadInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const res = await api.get('/appointments');
      const all = Array.isArray(res.data?.data) ? res.data.data : [];
      setInvoices(all);
    } catch { setInvoices([]); }
    finally { setLoadingInvoices(false); }
  };

  const handleAddCard = async () => {
    setRegistering(true);
    try {
      const res = await api.post('/payments/card/register', {
        returnUrl: window.location.origin + '/perfil',
      });
      const { processId, jsLibUrl } = res.data.data;
      setCardRegistration({ processId, jsLibUrl });
    } catch (err: any) {
      hotToast.error(err.response?.data?.message || 'Error al iniciar catastro');
    } finally {
      setRegistering(false);
    }
  };

  useEffect(() => {
    if (!cardRegistration) return;
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.status === 'add_new_card_success') {
        try {
          await api.post('/payments/card/sync');
          hotToast.success('¡Tarjeta agregada!');
          loadCards();
        } catch { hotToast.error('Error al sincronizar tarjeta'); }
        finally { setCardRegistration(null); }
      } else if (event.data?.status === 'add_new_card_fail') {
        hotToast.error(event.data.description || 'No se pudo agregar la tarjeta');
        setCardRegistration(null);
      }
    };
    window.addEventListener('message', handleMessage);
    const script = document.createElement('script');
    script.src = cardRegistration.jsLibUrl;
    script.onload = () => {
      if ((window as any).Bancard) {
        const styles = { 'form-background-color': '#0f172a', 'button-background-color': '#8b5cf6', 'button-text-color': '#ffffff', 'input-background-color': '#1e293b', 'input-text-color': '#f1f5f9' };
        (window as any).Bancard.Cards.createForm('bancard-iframe-container-profile', cardRegistration.processId, styles);
      }
    };
    document.head.appendChild(script);
    return () => {
      window.removeEventListener('message', handleMessage);
      const s = document.querySelector(`script[src="${cardRegistration.jsLibUrl}"]`);
      if (s) document.head.removeChild(s);
    };
  }, [cardRegistration]);

  const syncCards = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/payments/card/sync');
      const data = res.data;
      if (data.success) setCards(data.data || []);
    } catch { /* silent */ }
    setSyncing(false);
  };

  const deleteCard = async (card: any) => {
    setDeleting(true);
    try {
      const res = await api.delete(`/payments/card/${card.id}`);
      const data = res.data;
      if (data.success) {
        setCards(prev => prev.filter(c => c.id !== card.id));
        hotToast.success('Tarjeta eliminada');
      } else {
        hotToast.error(data.message || 'No se pudo eliminar la tarjeta');
      }
    } catch (err: any) {
      hotToast.error(err?.response?.data?.message || 'Error al eliminar la tarjeta');
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const setPrimary = async (cardId: string) => {
    try {
      const res = await api.post('/payments/card/set-primary', { cardId });
      const data = res.data;
      if (data.success) setCards(prev => prev.map(c => ({ ...c, isPrimary: c.id === cardId })));
    } catch { /* silent */ }
  };

  const getBrandGradient = (brand: string) => {
    const b = brand?.toLowerCase() || '';
    // Rich diagonal gradients inspired by premium card designs
    if (b.includes('visa')) return 'from-[#0a1f4d] via-[#1e3a8a] to-[#4c1d95]';
    if (b.includes('master')) return 'from-[#1a0808] via-[#7f1d1d] to-[#431407]';
    if (b.includes('amex')) return 'from-[#0c4a6e] via-[#155e75] to-[#134e4a]';
    if (b.includes('credicard') || b.includes('bancard')) return 'from-[#064e3b] via-[#065f46] to-[#0f172a]';
    return 'from-[#1e293b] via-[#334155] to-[#0f172a]';
  };

  const getBrandLogo = (brand: string) => {
    const b = brand?.toLowerCase() || '';
    if (b.includes('visa')) {
      return <span className="font-headline italic font-black text-white text-2xl tracking-tight drop-shadow-lg">VISA</span>;
    }
    if (b.includes('master')) {
      return (
        <div className="flex items-center -space-x-3">
          <div className="w-7 h-7 rounded-full bg-[#eb001b]" />
          <div className="w-7 h-7 rounded-full bg-[#f79e1b] mix-blend-screen" />
        </div>
      );
    }
    if (b.includes('amex')) {
      return <span className="font-headline italic font-black text-white text-xs tracking-[0.18em] bg-white/10 px-2 py-1 rounded">AMEX</span>;
    }
    return <span className="font-bold text-white/60 text-[10px] tracking-widest uppercase">{brand?.toUpperCase() || 'CARD'}</span>;
  };

  const printInvoice = (inv: any) => {
    const dt = new Date(inv.startTime ?? inv.booking_date);
    const dateStr = dt.toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' });
    const invoiceNum = `LG-${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}-${inv.id?.slice(-4).toUpperCase()}`;
    const precio = inv.service?.basePriceGs
      ? `₲ ${Number(inv.service.basePriceGs).toLocaleString('es-PY')}`
      : 'Incluido en membresía';
    const clientName = user?.name ?? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

    const html = `<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"><title>Factura ${invoiceNum}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Inter, sans-serif; padding: 40px; color: #0f172a; max-width: 680px; margin: 0 auto; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:24px; border-bottom:3px solid #1d4ed8; margin-bottom:32px; }
  .brand { font-size:22px; font-weight:900; letter-spacing:-0.5px; color:#1d4ed8; }
  .brand span { color:#0f172a; }
  .invoice-num { font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:2px; }
  .invoice-num strong { display:block; font-size:20px; font-weight:900; color:#0f172a; letter-spacing:-0.5px; margin-top:4px; }
  .section { margin-bottom:24px; }
  .label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:2px; color:#94a3b8; margin-bottom:4px; }
  .value { font-size:14px; font-weight:600; color:#0f172a; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
  .table { width:100%; border-collapse:collapse; margin:24px 0; }
  .table th { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#64748b; padding:8px 12px; text-align:left; border-bottom:1px solid #e2e8f0; }
  .table td { padding:14px 12px; font-size:14px; font-weight:600; border-bottom:1px solid #f1f5f9; }
  .table td.amount { font-weight:900; font-size:16px; color:#1d4ed8; }
  .total-row { background:#f8fafc; }
  .total-row td { font-weight:900; font-size:16px; }
  .status { display:inline-block; background:#dcfce7; color:#16a34a; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:4px 10px; border-radius:20px; }
  .footer { margin-top:48px; padding-top:24px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; }
  .footer p { font-size:11px; color:#94a3b8; }
  @media print { body { padding: 20px; } }
</style></head>
<body>
  <div class="header">
    <div>
      <div class="brand">LUXURY<span> GARAGE</span></div>
      <p style="font-size:12px;color:#64748b;margin-top:6px;">luxurygarage.arizar-ia.cloud</p>
    </div>
    <div style="text-align:right">
      <div class="invoice-num">Factura<strong>${invoiceNum}</strong></div>
      <p style="font-size:12px;color:#64748b;margin-top:4px;">${dateStr}</p>
    </div>
  </div>
  <div class="grid">
    <div class="section">
      <div class="label">Emitido a</div>
      <div class="value" style="font-weight:700;font-size:16px;">${clientName}</div>
      <div class="value" style="color:#64748b;font-size:13px;">${user?.email ?? ''}</div>
      <div class="value" style="color:#64748b;font-size:13px;">${user?.phone ?? ''}</div>
    </div>
    <div class="section">
      <div class="label">Estado</div>
      <span class="status">${inv.status === 'COMPLETED' ? 'Completado' : inv.status}</span>
    </div>
  </div>
  <table class="table">
    <thead><tr><th>Descripción</th><th>Categoría</th><th>Duración</th><th style="text-align:right">Importe</th></tr></thead>
    <tbody>
      <tr>
        <td>${inv.service?.name ?? 'Servicio'}</td>
        <td>${inv.service?.category ?? '-'}</td>
        <td>${inv.service?.durationMinutes ? inv.service.durationMinutes + ' min' : '-'}</td>
        <td class="amount" style="text-align:right">${precio}</td>
      </tr>
      <tr class="total-row">
        <td colspan="3" style="text-align:right;font-size:12px;color:#64748b;">TOTAL</td>
        <td class="amount" style="text-align:right">${precio}</td>
      </tr>
    </tbody>
  </table>
  ${inv.notes ? `<div class="section"><div class="label">Notas</div><div class="value">${inv.notes}</div></div>` : ''}
  <div class="footer">
    <p>Luxury Garage &copy; 2025 &mdash; Powered by ARIZAR IA</p>
    <p>Generado el ${new Date().toLocaleDateString('es-PY')}</p>
  </div>
</body></html>`;

    const win = window.open('', '_blank', 'width=800,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); };
  };

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab('tarjetas')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all border ${subTab === 'tarjetas'
            ? 'bg-primary dark:bg-blue-500 text-white border-transparent shadow-md shadow-primary/20'
            : 'bg-white dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800'
            }`}
        >
          <CreditCard size={13} /> Mis Tarjetas
        </button>
        <button
          onClick={() => setSubTab('facturas')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all border ${subTab === 'facturas'
            ? 'bg-primary dark:bg-blue-500 text-white border-transparent shadow-md shadow-primary/20'
            : 'bg-white dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800'
            }`}
        >
          <Receipt size={13} /> Mis Facturas
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl p-3 flex items-center gap-2">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-300 font-medium flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400"><X size={14} /></button>
        </div>
      )}

      {subTab === 'tarjetas' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{cards.length} tarjeta{cards.length !== 1 ? 's' : ''} guardada{cards.length !== 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              <button
                onClick={syncCards}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase hover:border-primary/30 active:scale-95 transition-all"
              >
                <svg className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
                Sincronizar
              </button>
              <button
                onClick={handleAddCard}
                disabled={registering}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary dark:bg-blue-500 text-white rounded-xl font-black text-xs shadow-md shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all disabled:opacity-50"
              >
                <Plus size={14} /> Añadir Nueva
              </button>
            </div>
          </div>

          {/* Cards list */}
          {loadingCards ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
          ) : cards.length === 0 ? (
            <div className="text-center py-14 bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800">
              <CreditCard size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-bold text-slate-400">No tenés tarjetas guardadas</p>
              <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">Agregá una tarjeta Bancard para pagar membresías</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {cards.map((card, idx) => {
                const cardholder = (user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`).trim().toUpperCase() || 'TITULAR';
                const last4 = card.maskedNumber?.slice(-4) || '••••';
                const expiry = card.expirationDate || '••/••';
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    whileHover={{ y: -6, scale: 1.01 }}
                    className={`relative aspect-[1.586/1] rounded-[1.75rem] text-white overflow-hidden shadow-2xl bg-gradient-to-br ${getBrandGradient(card.brand)}`}
                  >
                    {/* Subtle diagonal shine */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/30 pointer-events-none" />
                    <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-16 -left-12 w-40 h-40 bg-black/40 rounded-full blur-3xl pointer-events-none" />

                    {/* Content */}
                    <div className="relative h-full flex flex-col justify-between p-6">
                      {/* Top: Principal badge + brand logo + delete */}
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-2">
                          {card.isPrimary && (
                            <div className="flex items-center gap-1 bg-emerald-500/25 backdrop-blur-sm px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-emerald-400/40 text-emerald-200 w-fit">
                              <Star size={8} fill="currentColor" /> Principal
                            </div>
                          )}
                          {/* Chip */}
                          <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 shadow-inner relative overflow-hidden">
                            <div className="absolute inset-0.5 rounded-sm border border-amber-700/40" />
                            <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-px bg-amber-800/40" />
                            <div className="absolute inset-y-1 left-1/2 -translate-x-1/2 w-px bg-amber-800/40" />
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          {getBrandLogo(card.brand)}
                          <button
                            onClick={() => setDeleteTarget(card)}
                            aria-label="Eliminar tarjeta"
                            className="p-2 bg-white/15 hover:bg-red-500 active:bg-red-600 active:scale-90 backdrop-blur-md rounded-xl border border-white/10 transition-all shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Number */}
                      <div className="space-y-1">
                        <p className="font-mono text-xl md:text-2xl font-bold tracking-[0.18em] tabular-nums drop-shadow">
                          •••• •••• •••• <span className="text-white">{last4}</span>
                        </p>
                      </div>

                      {/* Bottom: cardholder + expiry + set primary */}
                      <div className="flex items-end justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] font-bold tracking-[0.2em] uppercase opacity-50 mb-0.5">Titular</p>
                          <p className="font-bold text-sm uppercase tracking-wide truncate">{cardholder}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[8px] font-bold tracking-[0.2em] uppercase opacity-50 mb-0.5">Vence</p>
                          <p className="font-mono font-bold text-sm tabular-nums tracking-wider">{expiry}</p>
                        </div>
                        {!card.isPrimary && (
                          <button
                            onClick={() => setPrimary(card.id)}
                            className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-md text-[8px] font-black uppercase tracking-widest border border-white/10 transition-all shrink-0 self-end"
                          >
                            Hacer principal
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Security note */}
          <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex items-start gap-2">
            <Shield size={14} className="text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
              Tus datos de tarjeta se procesan de forma segura por Bancard. Luxury Garage nunca almacena datos completos de tu tarjeta.
            </p>
          </div>

          {/* Bancard iframe modal */}
          {cardRegistration && (
            <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4">
              <div className="bg-slate-900 rounded-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                  <h3 className="font-bold text-white flex items-center gap-2"><CreditCard size={18} /> Agregar tarjeta</h3>
                  <button onClick={() => setCardRegistration(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                </div>
                <div id="bancard-iframe-container-profile" className="p-4 min-h-[400px]" />
                <p className="text-xs text-slate-500 text-center pb-4">Pago seguro procesado por Bancard</p>
              </div>
            </div>
          )}

          {/* Delete confirmation */}
          <AnimatePresence>
            {deleteTarget && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setDeleteTarget(null)} className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="relative z-10 bg-white dark:bg-slate-900 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl">
                  <div className="text-center mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                      <Trash2 size={24} className="text-red-500" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">¿Eliminar tarjeta?</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {deleteTarget.brand} terminada en {deleteTarget.maskedNumber?.slice(-4)}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setDeleteTarget(null)}
                      className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all">
                      Cancelar
                    </button>
                    <button onClick={() => deleteCard(deleteTarget)} disabled={deleting}
                      className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50">
                      {deleting ? '...' : 'Eliminar'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}

      {subTab === 'facturas' && (
        <div className="space-y-3">
          {/* Banner informativo */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-100 dark:border-blue-500/20">
            <Receipt size={16} className="text-primary dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-primary dark:text-blue-400">Facturación Automática</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">Muy pronto las facturas se generarán automáticamente al completar cada servicio. Por ahora podés descargar las de tus servicios completados.</p>
            </div>
          </div>

          {loadingInvoices ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-14 bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800">
              <FileText size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-bold text-slate-400">No hay facturas disponibles aún</p>
            </div>
          ) : (
            invoices.map((inv, i) => {
              const dt = new Date(inv.startTime ?? inv.booking_date);
              const invoiceNum = `LG-${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}-${inv.id?.slice(-4).toUpperCase()}`;
              const precio = inv.service?.basePriceGs
                ? `₲ ${Number(inv.service.basePriceGs).toLocaleString('es-PY')}`
                : 'Membresía';
              const statusColors: Record<string, string> = {
                COMPLETED: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
                CONFIRMED: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10',
                CANCELLED: 'text-red-500 bg-red-50 dark:bg-red-500/10',
                PENDING: 'text-slate-500 bg-slate-100 dark:bg-slate-800',
              };
              const statusLabel: Record<string, string> = { COMPLETED: 'Completado', CONFIRMED: 'Confirmado', CANCELLED: 'Cancelado', PENDING: 'Pendiente', IN_PROGRESS: 'En Curso' };
              return (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-center gap-4"
                >
                  <div className="w-10 h-10 bg-primary/10 dark:bg-blue-500/20 rounded-2xl flex items-center justify-center text-primary dark:text-blue-400 shrink-0">
                    <FileText size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-sm text-slate-900 dark:text-white truncate">{inv.service?.name ?? 'Servicio'}</p>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${statusColors[inv.status] ?? 'text-slate-500 bg-slate-100'}`}>
                        {statusLabel[inv.status] ?? inv.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 uppercase tracking-widest">{invoiceNum}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 font-bold">
                      <span className="flex items-center gap-1"><Calendar size={10} /> {dt.toLocaleDateString('es-PY', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span className="flex items-center gap-1 text-primary dark:text-blue-400 font-black">{precio}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => printInvoice(inv)}
                    title="Descargar / Imprimir Factura"
                    className="w-10 h-10 rounded-2xl bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-400 flex items-center justify-center hover:bg-primary hover:text-white dark:hover:bg-blue-500 dark:hover:text-white transition-all shrink-0 active:scale-90"
                  >
                    <Download size={16} />
                  </button>
                </motion.div>
              );
            })
          )}
        </div>
      )}
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

  const defaultForm = { brand: '', model: '', year: new Date().getFullYear(), licensePlate: '', color: '', mileage: '', notes: '' };
  const [form, setForm] = useState(defaultForm);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const refresh = async () => {
    const res = await api.get('/vehicles');
    const list = Array.isArray(res.data?.data) ? res.data.data : [];
    setVehicles(list);
    onUpdate();
  };

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

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este vehículo?')) return;
    try {
      await api.delete(`/vehicles/${id}`);
      showToast('Vehículo eliminado');
      await refresh();
    } catch { showToast('Error al eliminar'); }
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
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary dark:bg-blue-500 text-white rounded-xl font-black text-xs shadow-md shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all"
        >
          <Plus size={14} /> Agregar Vehículo
        </button>
      </div>

      {/* Vehicle Cards */}
      {vehicles.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Car size={28} className="text-slate-300 dark:text-slate-600" />
          </div>
          <p className="font-bold text-slate-400 dark:text-slate-500 text-sm">No tenés vehículos registrados</p>
          <button onClick={openAdd} className="mt-4 text-primary dark:text-blue-400 font-black text-xs uppercase tracking-widest hover:underline">
            + Agregar tu primer vehículo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map(v => (
            <motion.div
              key={v.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white dark:bg-slate-900/40 rounded-[1.5rem] border transition-colors overflow-hidden ${v.isPrimary ? 'border-primary/30 dark:border-blue-500/30' : 'border-slate-100 dark:border-slate-800'
                }`}
            >
              {/* Card Header */}
              <div className={`flex items-start gap-4 p-4 ${v.isPrimary ? 'bg-primary/5 dark:bg-blue-500/5' : ''}`}>
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${v.isPrimary ? 'bg-primary dark:bg-blue-500 text-white shadow-lg shadow-primary/25' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}>
                  <Car size={20} />
                </div>
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
              <div className="flex border-t border-slate-50 dark:border-slate-800">
                {!v.isPrimary && (
                  <button
                    onClick={() => handleSetPrimary(v.id)}
                    className="flex-1 py-3 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all"
                  >
                    <Star size={12} /> Marcar principal
                  </button>
                )}
                <button
                  onClick={() => openEdit(v)}
                  className="flex-1 py-3 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all border-l border-slate-50 dark:border-slate-800"
                >
                  <Edit2 size={12} /> Editar
                </button>
                <button
                  onClick={() => handleDelete(v.id)}
                  className="flex-1 py-3 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all border-l border-slate-50 dark:border-slate-800"
                >
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            </motion.div>
          ))}
        </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Marca *</label>
              <input required className={inputCls} placeholder="Toyota" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Modelo *</label>
              <input required className={inputCls} placeholder="Hilux" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
            </div>
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
          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-4 mt-1 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={15} /> {editing ? 'Guardar Cambios' : 'Agregar Vehículo'}</>}
          </button>
        </form>
      </BottomSheet>
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
      const res = await fetch(`/api/users/${userId}/password`, {
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
