import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wifi } from 'lucide-react';

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

export interface AnimatedCardPreviewProps {
    number: string;
    name: string;
    expiry: string;
    cvv: string;
    focus: 'number' | 'name' | 'expiry' | 'cvv' | null;
    flipped?: boolean;
}

const detectBrand = (digits: string): CardBrand => {
    const n = digits.replace(/\s/g, '');
    if (/^4/.test(n)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(n)) return 'mastercard';
    if (/^3[47]/.test(n)) return 'amex';
    if (/^6(?:011|5)/.test(n)) return 'discover';
    return 'unknown';
};

const brandStyles: Record<CardBrand, { gradient: string; logo: React.ReactNode }> = {
    visa: {
        gradient: 'from-blue-700 via-blue-800 to-indigo-900',
        logo: <span className="font-black italic text-white text-2xl tracking-tight drop-shadow-lg">VISA</span>,
    },
    mastercard: {
        gradient: 'from-red-600 via-orange-600 to-amber-700',
        logo: (
            <div className="flex items-center -space-x-3">
                <div className="w-7 h-7 rounded-full bg-red-500/90" />
                <div className="w-7 h-7 rounded-full bg-amber-400/90 mix-blend-screen" />
            </div>
        ),
    },
    amex: {
        gradient: 'from-sky-600 via-cyan-700 to-teal-800',
        logo: <span className="font-black italic text-white text-xs tracking-[0.15em]">AMEX</span>,
    },
    discover: {
        gradient: 'from-orange-500 via-orange-600 to-red-700',
        logo: <span className="font-black text-white text-xs tracking-tight">DISCOVER</span>,
    },
    unknown: {
        gradient: 'from-slate-700 via-slate-800 to-slate-900',
        logo: <span className="font-bold text-white/40 text-[10px] tracking-widest uppercase">Card</span>,
    },
};

const formatNumberDisplay = (raw: string, brand: CardBrand) => {
    const digits = raw.replace(/\D/g, '');
    const max = brand === 'amex' ? 15 : 16;
    const padded = digits.padEnd(max, '•').slice(0, max);
    if (brand === 'amex') {
        return `${padded.slice(0, 4)} ${padded.slice(4, 10)} ${padded.slice(10, 15)}`;
    }
    return `${padded.slice(0, 4)} ${padded.slice(4, 8)} ${padded.slice(8, 12)} ${padded.slice(12, 16)}`;
};

const formatExpiryDisplay = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    const mm = digits.slice(0, 2).padEnd(2, '•');
    const yy = digits.slice(2, 4).padEnd(2, '•');
    return `${mm}/${yy}`;
};

export default function AnimatedCardPreview({
    number,
    name,
    expiry,
    cvv,
    focus,
    flipped,
}: AnimatedCardPreviewProps) {
    const brand = useMemo(() => detectBrand(number), [number]);
    const { gradient, logo } = brandStyles[brand];

    const isFlipped = flipped ?? focus === 'cvv';
    const cvvLength = brand === 'amex' ? 4 : 3;
    const cvvDisplay = (cvv || '').slice(0, cvvLength).padEnd(cvvLength, '•');

    return (
        <div className="w-full" style={{ perspective: '1200px' }}>
            <motion.div
                className="relative w-full aspect-[1.586/1] rounded-3xl"
                style={{ transformStyle: 'preserve-3d' }}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            >
                {/* FRONT */}
                <div
                    className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${gradient} p-6 text-white shadow-2xl overflow-hidden`}
                    style={{ backfaceVisibility: 'hidden' }}
                >
                    {/* Decorative shine */}
                    <div className="absolute -top-20 -right-10 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-black/20 rounded-full blur-3xl" />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/20" />

                    {/* Top row: chip + contactless + brand */}
                    <div className="relative z-10 flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            {/* Chip */}
                            <div className="w-12 h-9 rounded-md bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 shadow-inner relative overflow-hidden">
                                <div className="absolute inset-0.5 rounded-sm border border-amber-700/40" />
                                <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-px bg-amber-800/40" />
                                <div className="absolute inset-y-1 left-1/2 -translate-x-1/2 w-px bg-amber-800/40" />
                            </div>
                            <Wifi size={18} className="rotate-90 text-white/80" strokeWidth={2.5} />
                        </div>
                        <motion.div
                            key={brand}
                            initial={{ opacity: 0, scale: 0.6, rotate: -10 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                        >
                            {logo}
                        </motion.div>
                    </div>

                    {/* Number */}
                    <motion.div
                        className="relative z-10 mt-6"
                        animate={{
                            scale: focus === 'number' ? 1.02 : 1,
                            y: focus === 'number' ? -2 : 0,
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    >
                        <p
                            className={`font-mono text-xl md:text-2xl font-bold tracking-[0.18em] tabular-nums transition-all ${focus === 'number'
                                    ? 'drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]'
                                    : ''
                                }`}
                        >
                            {formatNumberDisplay(number, brand)}
                        </p>
                    </motion.div>

                    {/* Name + Expiry */}
                    <div className="relative z-10 flex items-end justify-between mt-5">
                        <motion.div
                            className="flex-1 min-w-0 mr-4"
                            animate={{
                                scale: focus === 'name' ? 1.04 : 1,
                                y: focus === 'name' ? -2 : 0,
                            }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        >
                            <p className="text-[8px] font-bold tracking-[0.2em] uppercase opacity-50 mb-1">
                                Titular
                            </p>
                            <p
                                className={`font-bold text-sm uppercase tracking-wide truncate transition-all ${focus === 'name'
                                        ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                                        : ''
                                    }`}
                            >
                                {name?.trim() ? name.toUpperCase() : 'NOMBRE APELLIDO'}
                            </p>
                        </motion.div>
                        <motion.div
                            className="text-right shrink-0"
                            animate={{
                                scale: focus === 'expiry' ? 1.05 : 1,
                                y: focus === 'expiry' ? -2 : 0,
                            }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        >
                            <p className="text-[8px] font-bold tracking-[0.2em] uppercase opacity-50 mb-1">
                                Vence
                            </p>
                            <p
                                className={`font-mono font-bold text-sm tabular-nums tracking-wider transition-all ${focus === 'expiry'
                                        ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                                        : ''
                                    }`}
                            >
                                {formatExpiryDisplay(expiry)}
                            </p>
                        </motion.div>
                    </div>
                </div>

                {/* BACK */}
                <div
                    className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${gradient} text-white shadow-2xl overflow-hidden`}
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/30" />

                    {/* Magnetic stripe */}
                    <div className="relative z-10 h-12 bg-black/80 mt-6" />

                    <div className="relative z-10 px-6 pt-5">
                        <p className="text-[8px] font-bold tracking-[0.2em] uppercase opacity-60 mb-2">
                            CVV / CVC
                        </p>
                        <div className="bg-white/95 rounded-md h-10 flex items-center px-3 relative overflow-hidden">
                            <div
                                className="absolute inset-0 opacity-30"
                                style={{
                                    backgroundImage:
                                        'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.06) 4px, rgba(0,0,0,0.06) 8px)',
                                }}
                            />
                            <motion.p
                                key={cvvDisplay}
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`relative font-mono font-black text-slate-900 text-base tabular-nums tracking-[0.4em] ${focus === 'cvv'
                                        ? 'drop-shadow-[0_0_4px_rgba(0,0,0,0.2)]'
                                        : ''
                                    }`}
                            >
                                {cvvDisplay}
                            </motion.p>
                        </div>
                        <p className="text-[9px] opacity-50 mt-3 leading-snug">
                            Esta tarjeta es propiedad del banco emisor. Su uso está sujeto a los
                            términos del contrato firmado con el titular.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
