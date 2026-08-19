import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, Phone, Car, Eye, EyeOff, ArrowRight, Loader2, Check, ArrowLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import api from '../../services/api';
import { motion } from '../lib/motion';

/**
 * Alta pública: cualquiera crea su cuenta desde la web, sin que un administrador
 * intervenga. Al terminar queda con sesión iniciada y cae directo en el alta
 * obligatoria, donde carga la tarjeta, confirma el plan y paga.
 *
 * El plan que venía mirando en la landing llega por `?plan=slug` y se arrastra hasta
 * el pago para que aparezca ya elegido.
 */

const inputCls =
  'w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 h-13 py-3.5 text-[15px] font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none';
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 px-1';

export default function Registro() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const referralCode = params.get('ref') || '';
  const planPreseleccionado = params.get('plan') || '';

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '',
    vehicleBrand: '', vehicleModel: '', vehiclePlate: '',
  });
  const [verPwd, setVerPwd] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Mismas reglas que valida el servidor, para no mandar un pedido que ya sabemos que falla.
  const reglas = [
    { ok: form.password.length >= 8, txt: 'Al menos 8 caracteres' },
    { ok: /[a-zA-Z]/.test(form.password), txt: 'Una letra' },
    { ok: /[0-9]/.test(form.password), txt: 'Un número' },
  ];

  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'Requerido';
    if (!form.lastName.trim()) e.lastName = 'Requerido';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Correo inválido';
    if (!reglas.every((r) => r.ok)) e.password = 'No cumple los requisitos';
    if (form.password !== form.confirm) e.confirm = 'No coinciden';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validar()) return;
    setEnviando(true);
    try {
      const payload: any = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        referralCode: referralCode || undefined,
      };
      if (form.vehicleBrand.trim() && form.vehicleModel.trim()) {
        payload.vehicle = {
          brand: form.vehicleBrand.trim(),
          model: form.vehicleModel.trim(),
          licensePlate: form.vehiclePlate.trim(),
        };
      }
      const res = await api.post('/auth/public-register', payload);
      if (res.data?.success) {
        localStorage.setItem('luxury_token', res.data.data.token);
        localStorage.setItem('luxury_user', JSON.stringify(res.data.data.user));
        toast.success('¡Listo! Ahora activá tu membresía');
        // Al alta: tarjeta, plan y cobro. El plan elegido en la landing va con él.
        setTimeout(() => {
          window.location.href = planPreseleccionado
            ? `/inicio?plan=${encodeURIComponent(planPreseleccionado)}`
            : '/inicio';
        }, 700);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'No se pudo crear la cuenta. Intentá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 sm:py-12">
      <Toaster position="top-center" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
        {/* Marca */}
        <div className="flex flex-col items-center gap-3 mb-7">
          <img src="/logo.png" alt="Luxury Garage" className="w-16 h-16 object-contain" />
          <h1 className="brand-wordmark text-xl">LUXURY GARAGE</h1>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-100 dark:border-slate-800 shadow-xl p-6 sm:p-7">
          <div className="mb-6">
            <h2 className="font-headline text-2xl font-black text-slate-900 dark:text-white tracking-tight">Creá tu cuenta</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Después elegís tu plan y activás la membresía.
            </p>
          </div>

          <form onSubmit={enviar} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nombre</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input required value={form.firstName} onChange={set('firstName')} placeholder="Juan" className={inputCls} autoComplete="given-name" />
                </div>
                {errores.firstName && <p className="text-[11px] text-rose-500 mt-1 px-1">{errores.firstName}</p>}
              </div>
              <div>
                <label className={labelCls}>Apellido</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input required value={form.lastName} onChange={set('lastName')} placeholder="Pérez" className={inputCls} autoComplete="family-name" />
                </div>
                {errores.lastName && <p className="text-[11px] text-rose-500 mt-1 px-1">{errores.lastName}</p>}
              </div>
            </div>

            <div>
              <label className={labelCls}>Correo electrónico</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input required type="email" value={form.email} onChange={set('email')} placeholder="tu@correo.com" className={inputCls} autoComplete="email" inputMode="email" />
              </div>
              {errores.email && <p className="text-[11px] text-rose-500 mt-1 px-1">{errores.email}</p>}
            </div>

            <div>
              <label className={labelCls}>Teléfono <span className="normal-case tracking-normal font-medium text-slate-300 dark:text-slate-600">opcional</span></label>
              <div className="relative">
                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input type="tel" value={form.phone} onChange={set('phone')} placeholder="0981 123 456" className={inputCls} autoComplete="tel" inputMode="tel" />
              </div>
            </div>

            <div>
              <label className={labelCls}>Contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input required type={verPwd ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Creá una contraseña" className={inputCls} autoComplete="new-password" />
                <button type="button" onClick={() => setVerPwd((v) => !v)} aria-label={verPwd ? 'Ocultar' : 'Mostrar'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  {verPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.password.length > 0 && (
                <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-2 px-1">
                  {reglas.map((r) => (
                    <li key={r.txt} className={`flex items-center gap-1 text-[11px] ${r.ok ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                      <Check size={11} /> {r.txt}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className={labelCls}>Repetir contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input required type={verPwd ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')} placeholder="Repetila" className={inputCls} autoComplete="new-password" />
              </div>
              {errores.confirm && <p className="text-[11px] text-rose-500 mt-1 px-1">{errores.confirm}</p>}
            </div>

            {/* Vehículo: opcional, se puede cargar después desde la app. */}
            <details className="group rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <summary className="flex items-center gap-2.5 p-3.5 cursor-pointer select-none list-none">
                <Car size={16} className="text-slate-400 shrink-0" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">Tu vehículo</span>
                <span className="text-[11px] text-slate-400">opcional</span>
              </summary>
              <div className="p-3.5 pt-0 space-y-3 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <input value={form.vehicleBrand} onChange={set('vehicleBrand')} placeholder="Marca" className={inputCls.replace('pl-11', 'pl-4')} />
                  <input value={form.vehicleModel} onChange={set('vehicleModel')} placeholder="Modelo" className={inputCls.replace('pl-11', 'pl-4')} />
                </div>
                <input value={form.vehiclePlate} onChange={set('vehiclePlate')} placeholder="Chapa" className={inputCls.replace('pl-11', 'pl-4')} />
                <p className="text-[11px] text-slate-400 leading-relaxed">Podés cargarlo más adelante desde tu cuenta.</p>
              </div>
            </details>

            <button
              type="submit"
              disabled={enviando}
              className="w-full h-14 rounded-2xl bg-primary dark:bg-blue-500 text-white text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-60 disabled:shadow-none"
            >
              {enviando ? <><Loader2 size={18} className="animate-spin" /> Creando…</> : <>Continuar <ArrowRight size={17} /></>}
            </button>

            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 leading-relaxed">
              En el siguiente paso registrás tu tarjeta y elegís tu plan.
            </p>
          </form>
        </div>

        <div className="flex items-center justify-center gap-4 mt-6">
          <button onClick={() => navigate('/login')} className="text-xs font-bold text-primary dark:text-blue-400 hover:underline">
            Ya tengo cuenta
          </button>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <button onClick={() => navigate('/')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <ArrowLeft size={13} /> Volver
          </button>
        </div>
      </motion.div>
    </div>
  );
}
