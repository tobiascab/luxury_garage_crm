import React, { useState, useEffect } from 'react';
import { Mail, ArrowLeft, Send, CheckCircle2, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import api from '../../services/api';
import { motion } from '../lib/motion';
import { useModoClaro } from '../lib/modoClaro';

/**
 * Recuperación de contraseña, en dos pantallas que comparten el mismo marco:
 *
 *   /olvide-contrasena  → pide el correo y dispara el envío del enlace.
 *   /restablecer?token= → valida el enlace y deja crear la contraseña nueva.
 *
 * El backend responde siempre lo mismo exista o no la cuenta, así que acá tampoco
 * se le dice al visitante si ese correo está registrado.
 */

const inputCls =
  'w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 h-13 py-3.5 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none';

function Marco({ children }: { children: React.ReactNode }) {
  useModoClaro();
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-slate-50 dark:bg-slate-950">
      <Toaster position="top-center" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center gap-3 mb-7">
          <img src="/logo.png" alt="Luxury Garage" className="w-14 h-14 rounded-2xl" />
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-100 dark:border-slate-800 shadow-xl p-6 sm:p-7">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

/* ── Paso 1: pedir el enlace ─────────────────────────────────────────────── */
export function OlvidePassword() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const navigate = useNavigate();

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEnviando(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setEnviado(true);
    } catch {
      // El backend nunca revela si la cuenta existe; un fallo acá es de red.
      toast.error('No pudimos procesar el pedido. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <Marco>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 size={26} />
          </div>
          <h1 className="font-headline text-xl font-black text-slate-900 dark:text-white">Revisá tu correo</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Si <strong className="text-slate-700 dark:text-slate-200">{email.trim()}</strong> tiene una cuenta,
            te mandamos un enlace para crear una contraseña nueva. Vence en una hora.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            ¿No te llegó? Fijate en spam o correo no deseado.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full h-12 rounded-2xl bg-primary dark:bg-blue-500 text-white text-sm font-black uppercase tracking-widest active:scale-95 transition-all"
          >
            Volver a entrar
          </button>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <h1 className="font-headline text-xl font-black text-slate-900 dark:text-white mb-1.5">¿Olvidaste tu contraseña?</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
        Poné tu correo y te mandamos un enlace para crear una nueva.
      </p>
      <form onSubmit={enviar} className="space-y-4">
        <div className="relative">
          <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            className={inputCls}
          />
        </div>
        <button
          type="submit"
          disabled={enviando || !email.trim()}
          className="w-full h-12 rounded-2xl bg-primary dark:bg-blue-500 text-white text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
        >
          {enviando ? <><Loader2 size={17} className="animate-spin" /> Enviando…</> : <><Send size={16} /> Enviarme el enlace</>}
        </button>
      </form>
      <button
        onClick={() => navigate('/login')}
        className="mt-5 w-full flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        <ArrowLeft size={14} /> Volver
      </button>
    </Marco>
  );
}

/* ── Paso 2: crear la contraseña nueva ───────────────────────────────────── */
export function RestablecerPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [verificando, setVerificando] = useState(true);
  const [valido, setValido] = useState(false);
  const [errorEnlace, setErrorEnlace] = useState('');
  const [nombre, setNombre] = useState('');

  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [ver, setVer] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!token) { setErrorEnlace('El enlace está incompleto.'); setVerificando(false); return; }
    api.get(`/auth/reset-password/check?token=${encodeURIComponent(token)}`, { _noCache: true } as any)
      .then((r) => { setValido(true); setNombre(r.data?.data?.firstName || ''); })
      .catch((e) => setErrorEnlace(e?.response?.data?.message || 'El enlace no es válido.'))
      .finally(() => setVerificando(false));
  }, [token]);

  // Mismas reglas que valida el backend, para no mandar un pedido que ya sabemos que falla.
  const reglas = [
    { ok: pwd.length >= 8, txt: 'Al menos 8 caracteres' },
    { ok: /[A-Z]/.test(pwd), txt: 'Una mayúscula' },
    { ok: /[0-9]/.test(pwd), txt: 'Un número' },
  ];
  const cumpleTodo = reglas.every((r) => r.ok);
  const coinciden = pwd.length > 0 && pwd === pwd2;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cumpleTodo || !coinciden) return;
    setGuardando(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: pwd });
      setListo(true);
      setTimeout(() => navigate('/login'), 2200);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setGuardando(false);
    }
  };

  if (verificando) {
    return <Marco><div className="py-8 flex justify-center"><Loader2 size={26} className="animate-spin text-primary" /></div></Marco>;
  }

  if (!valido) {
    return (
      <Marco>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle size={26} />
          </div>
          <h1 className="font-headline text-xl font-black text-slate-900 dark:text-white">Este enlace ya no sirve</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{errorEnlace}</p>
          <button
            onClick={() => navigate('/olvide-contrasena')}
            className="w-full h-12 rounded-2xl bg-primary dark:bg-blue-500 text-white text-sm font-black uppercase tracking-widest active:scale-95 transition-all"
          >
            Pedir uno nuevo
          </button>
        </div>
      </Marco>
    );
  }

  if (listo) {
    return (
      <Marco>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 size={26} />
          </div>
          <h1 className="font-headline text-xl font-black text-slate-900 dark:text-white">¡Contraseña cambiada!</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Te llevamos a iniciar sesión…</p>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <h1 className="font-headline text-xl font-black text-slate-900 dark:text-white mb-1.5">
        {nombre ? `Hola ${nombre}` : 'Nueva contraseña'}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">Creá tu contraseña nueva.</p>

      <form onSubmit={guardar} className="space-y-4">
        <div className="relative">
          <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type={ver ? 'text' : 'password'}
            required
            autoFocus
            autoComplete="new-password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Contraseña nueva"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {ver ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="relative">
          <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type={ver ? 'text' : 'password'}
            required
            autoComplete="new-password"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            placeholder="Repetila"
            className={inputCls}
          />
        </div>

        <ul className="space-y-1.5 pt-1">
          {reglas.map((r) => (
            <li key={r.txt} className="flex items-center gap-2 text-xs">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${r.ok ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                <CheckCircle2 size={10} />
              </span>
              <span className={r.ok ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}>{r.txt}</span>
            </li>
          ))}
          {pwd2.length > 0 && (
            <li className="flex items-center gap-2 text-xs">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${coinciden ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                <CheckCircle2 size={10} />
              </span>
              <span className={coinciden ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-500 font-semibold'}>
                {coinciden ? 'Coinciden' : 'No coinciden'}
              </span>
            </li>
          )}
        </ul>

        <button
          type="submit"
          disabled={guardando || !cumpleTodo || !coinciden}
          className="w-full h-12 rounded-2xl bg-primary dark:bg-blue-500 text-white text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
        >
          {guardando ? <><Loader2 size={17} className="animate-spin" /> Guardando…</> : 'Guardar contraseña'}
        </button>
      </form>
    </Marco>
  );
}

/* ── Confirmación del correo ─────────────────────────────────────────────── */
export function VerificarCorreo() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (!token) { setEstado('error'); setMensaje('El enlace está incompleto.'); return; }
    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`, { _noCache: true } as any)
      .then((r) => { setEstado('ok'); setMensaje(r.data?.message || '¡Listo! Tu correo quedó confirmado.'); })
      .catch((e) => { setEstado('error'); setMensaje(e?.response?.data?.message || 'No pudimos confirmar tu correo.'); });
  }, [token]);

  return (
    <Marco>
      <div className="text-center space-y-4">
        {estado === 'cargando' ? (
          <div className="py-6"><Loader2 size={26} className="animate-spin text-primary mx-auto" /></div>
        ) : (
          <>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${estado === 'ok'
              ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
              {estado === 'ok' ? <CheckCircle2 size={26} /> : <AlertCircle size={26} />}
            </div>
            <h1 className="font-headline text-xl font-black text-slate-900 dark:text-white">
              {estado === 'ok' ? 'Correo confirmado' : 'No pudimos confirmarlo'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{mensaje}</p>
            <button
              onClick={() => navigate('/inicio')}
              className="w-full h-12 rounded-2xl bg-primary dark:bg-blue-500 text-white text-sm font-black uppercase tracking-widest active:scale-95 transition-all"
            >
              Ir a mi cuenta
            </button>
          </>
        )}
      </div>
    </Marco>
  );
}
