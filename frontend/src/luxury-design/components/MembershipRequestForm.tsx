import React, { useEffect, useState } from 'react';
import { User, Phone, Mail, Car, MessageSquare, X, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { motion, AnimatePresence, springSoft, springPop, easeOutFast, useReduce } from '../lib/motion';
import { cls } from '../landing/ui';
import useScrollLock from '../../hooks/useScrollLock';
import api from '../../services/api';

interface Plan {
    id: string;
    name: string;
    slug: string;
    priceGs?: number;
}

interface MembershipRequestFormProps {
    open: boolean;
    onClose: () => void;
    source?: 'landing' | 'login';
    defaultPlan?: string;
}

const VEHICLE_SIZES = ['Chico', 'Mediano', 'Grande', 'SUV', 'Camioneta'] as const;

// Estilo compartido de inputs (focus dorado sobre fondo oscuro translúcido).
const inputCls =
    'w-full rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3.5 text-sm font-medium text-white ' +
    'placeholder:text-slate-500 outline-none transition-colors ' +
    'focus:border-secondary/70 focus:ring-2 focus:ring-secondary/20';

const inputWithIconCls = inputCls.replace('px-4', 'pl-11 pr-4');

const labelCls =
    'text-[10px] font-black uppercase tracking-widest text-secondary/80 px-1';

export default function MembershipRequestForm({
    open,
    onClose,
    source = 'landing',
    defaultPlan,
}: MembershipRequestFormProps) {
    const reduce = useReduce();
    useScrollLock(open);

    // Campos del formulario
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [vehicleInfo, setVehicleInfo] = useState('');
    const [vehicleSize, setVehicleSize] = useState('');
    const [planInterest, setPlanInterest] = useState('');
    const [message, setMessage] = useState('');

    // Planes reales (GET /api/plans)
    const [plans, setPlans] = useState<Plan[]>([]);

    // Estados de envío
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldError, setFieldError] = useState<string | null>(null);

    // Cargar planes reales al abrir (una vez).
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        api
            .get('/plans')
            .then((res) => {
                if (cancelled) return;
                const data = res?.data;
                if (data?.success && Array.isArray(data.data)) {
                    setPlans(data.data);
                }
            })
            .catch(() => {
                /* silencioso: el select cae a "No estoy seguro" */
            });
        return () => {
            cancelled = true;
        };
    }, [open]);

    // Default del plan de interés cuando llegan los planes (o cambia defaultPlan).
    useEffect(() => {
        if (!defaultPlan) return;
        // Aceptamos slug o id que matchee con un plan real.
        const match = plans.find((p) => p.slug === defaultPlan || p.id === defaultPlan);
        if (match) setPlanInterest(match.slug);
    }, [defaultPlan, plans]);

    // Cerrar con Escape.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    // Resetear estado al cerrar (deja el form limpio para la próxima apertura).
    useEffect(() => {
        if (open) return;
        // Pequeño delay no hace falta: el AnimatePresence desmonta el contenido.
        setSubmitting(false);
        setSuccess(false);
        setError(null);
        setFieldError(null);
        setFirstName('');
        setLastName('');
        setPhone('');
        setEmail('');
        setVehicleInfo('');
        setVehicleSize('');
        setPlanInterest('');
        setMessage('');
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFieldError(null);

        // Validación en el front (el backend igual valida).
        if (!firstName.trim()) {
            setFieldError('Por favor ingresá tu nombre.');
            return;
        }
        if (!phone.trim()) {
            setFieldError('Por favor ingresá tu teléfono.');
            return;
        }

        setSubmitting(true);
        try {
            await api.post('/membership-requests', {
                firstName: firstName.trim(),
                lastName: lastName.trim() || undefined,
                phone: phone.trim(),
                email: email.trim() || undefined,
                vehicleInfo: vehicleInfo.trim() || undefined,
                vehicleSize: vehicleSize || undefined,
                planInterest: planInterest || undefined,
                message: message.trim() || undefined,
                source,
            });
            setSuccess(true);
        } catch (err: any) {
            const msg =
                err?.response?.data?.message ||
                'No pudimos enviar tu solicitud. Revisá tu conexión e intentá de nuevo.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const panelAnim = reduce
        ? {
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              exit: { opacity: 0, transition: easeOutFast },
              transition: { duration: 0.18 },
          }
        : {
              initial: { opacity: 0, scale: 0.95, y: 24 },
              animate: { opacity: 1, scale: 1, y: 0 },
              exit: { opacity: 0, scale: 0.96, y: 16, transition: easeOutFast },
              transition: springSoft,
          };

    return (
        <AnimatePresence>
            {open && (
                <div
                    className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-0 sm:p-5"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="membership-request-title"
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: easeOutFast }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />

                    {/* Panel */}
                    <motion.div
                        {...panelAnim}
                        className="relative z-10 w-full max-w-lg sm:max-w-xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0c0c0e] shadow-2xl shadow-black/60 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="relative shrink-0 px-6 pt-6 pb-4 sm:px-8 sm:pt-7 border-b border-white/[0.06]">
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Cerrar"
                                className="absolute right-4 top-4 grid place-items-center w-9 h-9 rounded-full bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X size={18} />
                            </button>
                            <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-secondary/90">
                                <span className="w-6 h-px bg-secondary/50" />
                                Luxury Garage
                            </span>
                            <h3
                                id="membership-request-title"
                                className="mt-3 text-2xl lg:text-3xl font-black italic tracking-tight text-white"
                            >
                                Solicitar Membresía
                            </h3>
                            <p className="mt-1 text-sm text-slate-400 font-light">
                                Dejanos tus datos y te contactamos para sumarte al club.
                            </p>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto overscroll-contain flex-1 px-6 py-5 sm:px-8">
                            {success ? (
                                <div className="flex flex-col items-center text-center py-8">
                                    <motion.div
                                        initial={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                                        animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                                        transition={reduce ? { duration: 0.18 } : springPop}
                                        className="grid place-items-center w-20 h-20 rounded-full bg-secondary/15 border border-secondary/30 text-secondary mb-5"
                                    >
                                        <CheckCircle2 size={44} />
                                    </motion.div>
                                    <h4 className="text-xl font-black text-white">¡Recibimos tu solicitud!</h4>
                                    <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-xs">
                                        Te contactamos a la brevedad 🚗
                                    </p>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className={`${cls.btnGold} mt-7 px-8 py-3.5 text-xs`}
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                                    {/* Nombre + Apellido */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label htmlFor="mr-firstName" className={labelCls}>
                                                Nombre <span className="text-secondary">*</span>
                                            </label>
                                            <div className="relative">
                                                <User
                                                    size={18}
                                                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                                                />
                                                <input
                                                    id="mr-firstName"
                                                    type="text"
                                                    value={firstName}
                                                    onChange={(e) => setFirstName(e.target.value)}
                                                    required
                                                    autoComplete="given-name"
                                                    placeholder="Tu nombre"
                                                    className={inputWithIconCls}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label htmlFor="mr-lastName" className={labelCls}>
                                                Apellido
                                            </label>
                                            <input
                                                id="mr-lastName"
                                                type="text"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                                autoComplete="family-name"
                                                placeholder="Tu apellido"
                                                className={inputCls}
                                            />
                                        </div>
                                    </div>

                                    {/* Teléfono + Email */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label htmlFor="mr-phone" className={labelCls}>
                                            Teléfono <span className="text-secondary">*</span>
                                        </label>
                                        <div className="relative">
                                            <Phone
                                                size={18}
                                                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                                            />
                                            <input
                                                id="mr-phone"
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                required
                                                autoComplete="tel"
                                                placeholder="09xx xxx xxx"
                                                className={inputWithIconCls}
                                            />
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div className="space-y-1.5">
                                        <label htmlFor="mr-email" className={labelCls}>
                                            Email
                                        </label>
                                        <div className="relative">
                                            <Mail
                                                size={18}
                                                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                                            />
                                            <input
                                                id="mr-email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                autoComplete="email"
                                                placeholder="ejemplo@correo.com"
                                                className={inputWithIconCls}
                                            />
                                        </div>
                                    </div>
                                    </div>

                                    {/* Vehículo marca/modelo */}
                                    <div className="space-y-1.5">
                                        <label htmlFor="mr-vehicleInfo" className={labelCls}>
                                            Vehículo (marca / modelo)
                                        </label>
                                        <div className="relative">
                                            <Car
                                                size={18}
                                                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                                            />
                                            <input
                                                id="mr-vehicleInfo"
                                                type="text"
                                                value={vehicleInfo}
                                                onChange={(e) => setVehicleInfo(e.target.value)}
                                                placeholder="Ej. Toyota Hilux"
                                                className={inputWithIconCls}
                                            />
                                        </div>
                                    </div>

                                    {/* Tamaño + Plan de interés */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label htmlFor="mr-vehicleSize" className={labelCls}>
                                            Tamaño del vehículo
                                        </label>
                                        <select
                                            id="mr-vehicleSize"
                                            value={vehicleSize}
                                            onChange={(e) => setVehicleSize(e.target.value)}
                                            className={`${inputCls} appearance-none cursor-pointer`}
                                        >
                                            <option value="" className="bg-[#0c0c0e]">
                                                Seleccionar…
                                            </option>
                                            {VEHICLE_SIZES.map((s) => (
                                                <option key={s} value={s} className="bg-[#0c0c0e]">
                                                    {s}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Plan de interés */}
                                    <div className="space-y-1.5">
                                        <label htmlFor="mr-planInterest" className={labelCls}>
                                            Plan de interés
                                        </label>
                                        <select
                                            id="mr-planInterest"
                                            value={planInterest}
                                            onChange={(e) => setPlanInterest(e.target.value)}
                                            className={`${inputCls} appearance-none cursor-pointer`}
                                        >
                                            <option value="" className="bg-[#0c0c0e]">
                                                No estoy seguro
                                            </option>
                                            {plans.map((p) => (
                                                <option key={p.id} value={p.slug} className="bg-[#0c0c0e]">
                                                    {p.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    </div>

                                    {/* Mensaje */}
                                    <div className="space-y-1.5">
                                        <label htmlFor="mr-message" className={labelCls}>
                                            Mensaje
                                        </label>
                                        <div className="relative">
                                            <MessageSquare
                                                size={18}
                                                className="absolute left-3.5 top-3.5 text-slate-500"
                                            />
                                            <textarea
                                                id="mr-message"
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                rows={3}
                                                placeholder="¿Algo que quieras contarnos? (opcional)"
                                                className={`${inputWithIconCls} resize-none pt-3.5`}
                                            />
                                        </div>
                                    </div>

                                    {/* Errores */}
                                    {(fieldError || error) && (
                                        <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                            <span>{fieldError || error}</span>
                                        </div>
                                    )}

                                    {/* Botón enviar */}
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className={`${cls.btnGold} w-full py-4 text-xs disabled:opacity-70 disabled:cursor-not-allowed`}
                                    >
                                        {submitting ? (
                                            <>
                                                <motion.span
                                                    className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full inline-block"
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                                                />
                                                Enviando…
                                            </>
                                        ) : (
                                            <>
                                                <Send size={16} />
                                                Enviar solicitud
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
