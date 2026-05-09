import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Lock, User, Calendar, Shield, X, Check, Loader2, AlertCircle } from 'lucide-react';
import AnimatedCardPreview from './AnimatedCardPreview';

type Focus = 'number' | 'name' | 'expiry' | 'cvv' | null;

export interface CardSubmitPayload {
    number: string;
    name: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    documentNumber: string;
}

export interface AddCardCustomFormProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: CardSubmitPayload) => Promise<void> | void;
    initialDocumentNumber?: string;
    submitting?: boolean;
    errorMessage?: string;
}

const detectBrandLength = (digits: string): number => {
    const n = digits.replace(/\s/g, '');
    if (/^3[47]/.test(n)) return 15;
    return 16;
};

const detectCvvLength = (digits: string): number => {
    const n = digits.replace(/\s/g, '');
    return /^3[47]/.test(n) ? 4 : 3;
};

const formatNumberInput = (raw: string, brand: 'amex' | 'normal') => {
    const digits = raw.replace(/\D/g, '');
    if (brand === 'amex') {
        return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)]
            .filter(Boolean)
            .join(' ');
    }
    return digits.match(/.{1,4}/g)?.join(' ') ?? '';
};

const luhnValid = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 13) return false;
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let n = parseInt(digits[i], 10);
        if (alt) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        sum += n;
        alt = !alt;
    }
    return sum % 10 === 0;
};

export default function AddCardCustomForm({
    open,
    onClose,
    onSubmit,
    initialDocumentNumber = '',
    submitting = false,
    errorMessage,
}: AddCardCustomFormProps) {
    const [number, setNumber] = useState('');
    const [name, setName] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [documentNumber, setDocumentNumber] = useState(initialDocumentNumber);
    const [focus, setFocus] = useState<Focus>(null);
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    const numberRef = useRef<HTMLInputElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const expiryRef = useRef<HTMLInputElement>(null);
    const cvvRef = useRef<HTMLInputElement>(null);

    const isAmex = /^3[47]/.test(number.replace(/\s/g, ''));
    const maxNumberLen = detectBrandLength(number);
    const maxCvvLen = detectCvvLength(number);

    const errors = useMemo(() => {
        const e: Record<string, string> = {};
        const digitsOnly = number.replace(/\s/g, '');
        if (digitsOnly.length < maxNumberLen) e.number = `Número incompleto`;
        else if (!luhnValid(digitsOnly)) e.number = 'Número inválido';
        if (!name.trim() || name.trim().length < 3) e.name = 'Ingresá el nombre completo';
        const [mm, yy] = expiry.split('/');
        if (!mm || mm.length !== 2 || parseInt(mm, 10) < 1 || parseInt(mm, 10) > 12)
            e.expiry = 'Mes inválido';
        else if (!yy || yy.length !== 2) e.expiry = 'Año incompleto';
        else {
            const fullYear = 2000 + parseInt(yy, 10);
            const month = parseInt(mm, 10);
            const exp = new Date(fullYear, month, 0, 23, 59, 59);
            if (exp < new Date()) e.expiry = 'Tarjeta vencida';
        }
        if (cvv.length < maxCvvLen) e.cvv = `CVV de ${maxCvvLen} dígitos`;
        if (!documentNumber.trim() || documentNumber.trim().length < 5) e.documentNumber = 'Cédula requerida';
        return e;
    }, [number, name, expiry, cvv, documentNumber, maxNumberLen, maxCvvLen]);

    const isValid = Object.keys(errors).length === 0;

    const handleNumberChange = (val: string) => {
        const digits = val.replace(/\D/g, '').slice(0, maxNumberLen);
        const formatted = formatNumberInput(digits, isAmex ? 'amex' : 'normal');
        setNumber(formatted);
        const targetLen = isAmex ? 15 : 16;
        if (digits.length === targetLen) nameRef.current?.focus();
    };

    const handleNameChange = (val: string) => {
        const cleaned = val.replace(/[^a-zA-ZÀ-ÿ\s'-]/g, '').slice(0, 30);
        setName(cleaned);
    };

    const handleExpiryChange = (val: string) => {
        const digits = val.replace(/\D/g, '').slice(0, 4);
        let formatted = digits;
        if (digits.length >= 2) {
            formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
        }
        setExpiry(formatted);
        if (digits.length === 4) cvvRef.current?.focus();
    };

    const handleCvvChange = (val: string) => {
        const digits = val.replace(/\D/g, '').slice(0, maxCvvLen);
        setCvv(digits);
    };

    const handleSubmit = async () => {
        setTouched({ number: true, name: true, expiry: true, cvv: true, documentNumber: true });
        if (!isValid) return;
        const [mm, yy] = expiry.split('/');
        await onSubmit({
            number: number.replace(/\s/g, ''),
            name: name.trim(),
            expiryMonth: mm,
            expiryYear: yy,
            cvv,
            documentNumber: documentNumber.trim(),
        });
    };

    const handleClose = () => {
        if (submitting) return;
        setNumber('');
        setName('');
        setExpiry('');
        setCvv('');
        setFocus(null);
        setTouched({});
        onClose();
    };

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center p-0 md:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-slate-950/85 backdrop-blur-xl"
                    />
                    <motion.div
                        initial={{ opacity: 0, y: 60, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 60, scale: 0.96 }}
                        transition={{ type: 'spring', damping: 24, stiffness: 220 }}
                        className="relative z-10 w-full md:max-w-lg bg-white dark:bg-slate-950 rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-[0_0_120px_rgba(0,0,0,0.6)] border border-slate-100 dark:border-slate-800 overflow-hidden max-h-[95vh] overflow-y-auto"
                    >
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500" />

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 pt-6 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
                                    <CreditCard size={20} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-headline font-black text-base text-slate-900 dark:text-white italic uppercase tracking-tight">
                                        Agregar Tarjeta
                                    </h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        Procesado por Bancard
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                disabled={submitting}
                                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all disabled:opacity-40"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Animated card preview */}
                        <div className="px-6 pb-2">
                            <AnimatedCardPreview
                                number={number}
                                name={name}
                                expiry={expiry.replace('/', '')}
                                cvv={cvv}
                                focus={focus}
                            />
                        </div>

                        {/* Form */}
                        <div className="px-6 pt-4 pb-6 space-y-4">
                            {/* Card number */}
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-2 ml-1 flex items-center gap-1.5">
                                    <CreditCard size={11} /> Número de tarjeta
                                </label>
                                <div className="relative">
                                    <input
                                        ref={numberRef}
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="cc-number"
                                        placeholder={isAmex ? '1234 567890 12345' : '1234 5678 9012 3456'}
                                        value={number}
                                        onChange={(e) => handleNumberChange(e.target.value)}
                                        onFocus={() => setFocus('number')}
                                        onBlur={() => { setFocus(null); setTouched(t => ({ ...t, number: true })); }}
                                        className={`w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-2xl border-2 font-mono text-base tracking-wider tabular-nums transition-all focus:outline-none ${touched.number && errors.number
                                                ? 'border-red-300 dark:border-red-500/40 focus:border-red-500'
                                                : 'border-slate-100 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-400'
                                            }`}
                                    />
                                </div>
                                {touched.number && errors.number && (
                                    <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">{errors.number}</p>
                                )}
                            </div>

                            {/* Name */}
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-2 ml-1 flex items-center gap-1.5">
                                    <User size={11} /> Titular
                                </label>
                                <input
                                    ref={nameRef}
                                    type="text"
                                    autoComplete="cc-name"
                                    placeholder="JUAN PEREZ"
                                    value={name}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    onFocus={() => setFocus('name')}
                                    onBlur={() => { setFocus(null); setTouched(t => ({ ...t, name: true })); }}
                                    className={`w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-2xl border-2 font-bold text-base uppercase tracking-wide transition-all focus:outline-none ${touched.name && errors.name
                                            ? 'border-red-300 dark:border-red-500/40'
                                            : 'border-slate-100 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-400'
                                        }`}
                                />
                                {touched.name && errors.name && (
                                    <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">{errors.name}</p>
                                )}
                            </div>

                            {/* Expiry + CVV */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-2 ml-1 flex items-center gap-1.5">
                                        <Calendar size={11} /> Vencimiento
                                    </label>
                                    <input
                                        ref={expiryRef}
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="cc-exp"
                                        placeholder="MM/AA"
                                        value={expiry}
                                        onChange={(e) => handleExpiryChange(e.target.value)}
                                        onFocus={() => setFocus('expiry')}
                                        onBlur={() => { setFocus(null); setTouched(t => ({ ...t, expiry: true })); }}
                                        className={`w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-2xl border-2 font-mono text-base tabular-nums tracking-wider transition-all focus:outline-none ${touched.expiry && errors.expiry
                                                ? 'border-red-300 dark:border-red-500/40'
                                                : 'border-slate-100 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-400'
                                            }`}
                                    />
                                    {touched.expiry && errors.expiry && (
                                        <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">{errors.expiry}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-2 ml-1 flex items-center gap-1.5">
                                        <Lock size={11} /> CVV
                                    </label>
                                    <input
                                        ref={cvvRef}
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="cc-csc"
                                        placeholder={isAmex ? '••••' : '•••'}
                                        value={cvv}
                                        onChange={(e) => handleCvvChange(e.target.value)}
                                        onFocus={() => setFocus('cvv')}
                                        onBlur={() => { setFocus(null); setTouched(t => ({ ...t, cvv: true })); }}
                                        className={`w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-2xl border-2 font-mono text-base tabular-nums tracking-[0.3em] transition-all focus:outline-none ${touched.cvv && errors.cvv
                                                ? 'border-red-300 dark:border-red-500/40'
                                                : 'border-slate-100 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-400'
                                            }`}
                                    />
                                    {touched.cvv && errors.cvv && (
                                        <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">{errors.cvv}</p>
                                    )}
                                </div>
                            </div>

                            {/* Document number */}
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-2 ml-1 flex items-center gap-1.5">
                                    <Shield size={11} /> Cédula de identidad
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="4567890"
                                    value={documentNumber}
                                    onChange={(e) => setDocumentNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    onBlur={() => setTouched(t => ({ ...t, documentNumber: true }))}
                                    className={`w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-2xl border-2 font-bold text-base tabular-nums transition-all focus:outline-none ${touched.documentNumber && errors.documentNumber
                                            ? 'border-red-300 dark:border-red-500/40'
                                            : 'border-slate-100 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-400'
                                        }`}
                                />
                                {touched.documentNumber && errors.documentNumber && (
                                    <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">
                                        {errors.documentNumber}
                                    </p>
                                )}
                            </div>

                            {/* Server error */}
                            <AnimatePresence>
                                {errorMessage && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl p-3"
                                    >
                                        <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-red-700 dark:text-red-300 font-bold leading-snug">
                                            {errorMessage}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Submit */}
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !isValid}
                                className="w-full mt-2 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" /> Procesando…
                                    </>
                                ) : (
                                    <>
                                        <Check size={16} /> Guardar tarjeta
                                    </>
                                )}
                            </button>

                            {/* Trust bar */}
                            <div className="flex items-center justify-center gap-2 pt-2">
                                <Shield size={12} className="text-emerald-500" />
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                                    Pago seguro · Bancard · PCI DSS
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
