import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mail, Lock, User, Phone, Car, Eye, EyeOff, ArrowRight, ArrowLeft,
  Loader2, Check, Shield,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import api from '../../services/api';
import { motion, AnimatePresence } from '../lib/motion';

/**
 * Alta pública, en pasos.
 *
 * Se pide un dato por vez en lugar de mostrar el formulario entero: en el celular una
 * pantalla con ocho campos se lee como un trámite y la gente la abandona. Cada paso valida
 * lo suyo antes de dejar avanzar, así el error aparece al lado del campo que lo causó y no
 * todo junto al final.
 *
 * Al terminar queda con la sesión iniciada y cae en el alta obligatoria, donde carga la
 * tarjeta, confirma el plan y paga. El plan que venía mirando en la landing (?plan=slug)
 * se arrastra hasta ahí.
 */

const PASOS = ['Tus datos', 'Contacto', 'Contraseña', 'Tu vehículo'] as const;

export default function Registro() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const referralCode = params.get('ref') || '';
  const planPreseleccionado = params.get('plan') || '';

  const [paso, setPaso] = useState(0);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '',
    vehicleBrand: '', vehicleModel: '', vehiclePlate: '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [verPwd, setVerPwd] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const primerCampo = useRef<HTMLInputElement>(null);

  // Al cambiar de paso el foco va al primer campo: en el celular abre el teclado solo.
  useEffect(() => { primerCampo.current?.focus(); }, [paso]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errores[k]) setErrores((x) => ({ ...x, [k]: '' }));
  };

  const reglas = [
    { ok: form.password.length >= 8, txt: '8 caracteres' },
    { ok: /[a-zA-Z]/.test(form.password), txt: 'Una letra' },
    { ok: /[0-9]/.test(form.password), txt: 'Un número' },
  ];

  /** Valida SOLO el paso actual. */
  const validarPaso = () => {
    const e: Record<string, string> = {};
    if (paso === 0) {
      if (!form.firstName.trim()) e.firstName = 'Poné tu nombre';
      if (!form.lastName.trim()) e.lastName = 'Poné tu apellido';
    }
    if (paso === 1) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Revisá el correo';
    }
    if (paso === 2) {
      if (!reglas.every((r) => r.ok)) e.password = 'Falta cumplir los requisitos';
      else if (form.password !== form.confirm) e.confirm = 'No coinciden';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const siguiente = () => {
    if (!validarPaso()) return;
    if (paso < PASOS.length - 1) setPaso((p) => p + 1);
    else crearCuenta();
  };

  const crearCuenta = async () => {
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
        setTimeout(() => {
          window.location.href = planPreseleccionado
            ? `/inicio?plan=${encodeURIComponent(planPreseleccionado)}`
            : '/inicio';
        }, 650);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'No se pudo crear la cuenta. Intentá de nuevo.';
      toast.error(msg);
      // Si el correo ya existe, se vuelve al paso donde se corrige.
      if (err?.response?.status === 409) { setPaso(1); setErrores({ email: 'Ese correo ya tiene cuenta' }); }
      setEnviando(false);
    }
  };

  const atras = () => (paso === 0 ? navigate('/') : setPaso((p) => p - 1));
  const esUltimo = paso === PASOS.length - 1;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Toaster position="top-center" />

      {/* Cabecera fija: marca + avance */}
      <header className="px-5 pt-6 pb-4 shrink-0">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={atras} aria-label="Volver"
              className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0">
              <ArrowLeft size={20} />
            </button>
            <img src="/logo.png" alt="" className="w-8 h-8 object-contain" />
            <span className="brand-wordmark text-sm">LUXURY GARAGE</span>
          </div>

          {/* Avance: tramos, no un porcentaje abstracto */}
          <div className="flex items-center gap-1.5" role="progressbar" aria-valuenow={paso + 1} aria-valuemin={1} aria-valuemax={PASOS.length}>
            {PASOS.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= paso ? 'bg-primary dark:bg-blue-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
            ))}
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-2.5">
            Paso {paso + 1} de {PASOS.length} · {PASOS[paso]}
          </p>
        </div>
      </header>

      {/* Contenido del paso */}
      <main className="flex-1 px-5 pb-6">
        <div className="max-w-md mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); siguiente(); }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={paso}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22 }}
            >
              {paso === 0 && (
                <Paso titulo="¿Cómo te llamás?" bajada="Para dirigirnos a vos como corresponde.">
                  <Campo label="Nombre" icono={<User size={17} />} error={errores.firstName}>
                    <input ref={primerCampo} value={form.firstName} onChange={set('firstName')}
                      placeholder="Juan" autoComplete="given-name" className={inputCls} />
                  </Campo>
                  <Campo label="Apellido" icono={<User size={17} />} error={errores.lastName}>
                    <input value={form.lastName} onChange={set('lastName')}
                      placeholder="Pérez" autoComplete="family-name" className={inputCls} />
                  </Campo>
                </Paso>
              )}

              {paso === 1 && (
                <Paso titulo="¿Dónde te escribimos?" bajada="Con el correo entrás a tu cuenta y recibís los avisos de tus cobros y turnos.">
                  <Campo label="Correo electrónico" icono={<Mail size={17} />} error={errores.email}>
                    <input ref={primerCampo} type="email" inputMode="email" value={form.email} onChange={set('email')}
                      placeholder="tu@correo.com" autoComplete="email" className={inputCls} />
                  </Campo>
                  <Campo label="Teléfono" opcional icono={<Phone size={17} />}>
                    <input type="tel" inputMode="tel" value={form.phone} onChange={set('phone')}
                      placeholder="0981 123 456" autoComplete="tel" className={inputCls} />
                  </Campo>
                </Paso>
              )}

              {paso === 2 && (
                <Paso titulo="Creá tu contraseña" bajada="La vas a usar para entrar a tu cuenta.">
                  <Campo label="Contraseña" icono={<Lock size={17} />} error={errores.password}>
                    <input ref={primerCampo} type={verPwd ? 'text' : 'password'} value={form.password} onChange={set('password')}
                      placeholder="Creá una contraseña" autoComplete="new-password" className={`${inputCls} pr-12`} />
                    <button type="button" onClick={() => setVerPwd((v) => !v)} aria-label={verPwd ? 'Ocultar' : 'Mostrar'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      {verPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </Campo>

                  <div className="flex flex-wrap gap-2 -mt-1">
                    {reglas.map((r) => (
                      <span key={r.txt}
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${r.ok
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                        <Check size={11} /> {r.txt}
                      </span>
                    ))}
                  </div>

                  <Campo label="Repetir contraseña" icono={<Lock size={17} />} error={errores.confirm}>
                    <input type={verPwd ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')}
                      placeholder="Repetila" autoComplete="new-password" className={inputCls} />
                  </Campo>
                </Paso>
              )}

              {paso === 3 && (
                <Paso titulo="¿Qué auto tenés?" bajada="Sirve para tu historial de lavados. Si preferís, lo cargás después.">
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Marca" icono={<Car size={17} />}>
                      <input ref={primerCampo} value={form.vehicleBrand} onChange={set('vehicleBrand')}
                        placeholder="Toyota" className={inputCls} />
                    </Campo>
                    <Campo label="Modelo" icono={<Car size={17} />}>
                      <input value={form.vehicleModel} onChange={set('vehicleModel')}
                        placeholder="Corolla" className={inputCls} />
                    </Campo>
                  </div>
                  <Campo label="Chapa" opcional icono={<Car size={17} />}>
                    <input value={form.vehiclePlate} onChange={set('vehiclePlate')}
                      placeholder="ABC 123" className={inputCls} />
                  </Campo>
                </Paso>
              )}
            </motion.div>
          </AnimatePresence>
          {/* Permite enviar con Enter sin duplicar el botón visible del pie. */}
          <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
          </form>
        </div>
      </main>

      {/* Acción fija abajo: siempre al alcance del pulgar */}
      <footer className="sticky bottom-0 px-5 pb-6 pt-3 bg-gradient-to-t from-slate-50 dark:from-slate-950 via-slate-50/95 dark:via-slate-950/95 to-transparent">
        <div className="max-w-md mx-auto space-y-3">
          <button
            onClick={siguiente}
            disabled={enviando}
            className="w-full h-14 rounded-2xl bg-primary dark:bg-blue-500 text-white text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-60"
          >
            {enviando ? <><Loader2 size={18} className="animate-spin" /> Creando tu cuenta…</>
              : esUltimo ? <>Crear mi cuenta <ArrowRight size={17} /></>
                : <>Continuar <ArrowRight size={17} /></>}
          </button>

          {esUltimo && !enviando && (
            <button onClick={crearCuenta}
              className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-1">
              Cargar mi auto después
            </button>
          )}

          {paso === 0 && (
            <p className="text-center text-xs text-slate-400">
              ¿Ya tenés cuenta?{' '}
              <button onClick={() => navigate('/login')} className="font-bold text-primary dark:text-blue-400 hover:underline">
                Iniciá sesión
              </button>
            </p>
          )}

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-600">
            <Shield size={11} /> Tus datos viajan cifrados
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ── Piezas ── */

const inputCls =
  'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 h-14 text-[16px] font-semibold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:font-normal focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all outline-none';

function Paso({ titulo, bajada, children }: { titulo: string; bajada: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-headline text-[26px] leading-tight font-black text-slate-900 dark:text-white tracking-tight">{titulo}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-7 leading-relaxed">{bajada}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Campo({ label, icono, error, opcional, children }: {
  label: string; icono: React.ReactNode; error?: string; opcional?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 px-1">
        {label}
        {opcional && <span className="ml-1.5 normal-case tracking-normal font-medium text-slate-300 dark:text-slate-600">opcional</span>}
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">{icono}</span>
        {children}
      </div>
      {error && <p className="text-[11px] font-semibold text-rose-500 mt-1.5 px-1">{error}</p>}
    </div>
  );
}
