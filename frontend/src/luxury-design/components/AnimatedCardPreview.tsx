import React, { useMemo } from 'react';
import { Wifi } from 'lucide-react';
import { motion, springSoft, springPop, useReduce } from '../lib/motion';
import { useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

export interface AnimatedCardPreviewProps {
    number: string;
    name: string;
    expiry: string;
    cvv: string;
    focus: 'number' | 'name' | 'expiry' | 'cvv' | null;
    flipped?: boolean;
    /** Override de marca (ej. la que devuelve la pasarela). Si se omite, se detecta del número. */
    brand?: CardBrand;
}

const detectBrand = (digits: string): CardBrand => {
    const n = digits.replace(/\s/g, '');
    if (/^4/.test(n)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(n)) return 'mastercard';
    if (/^3[47]/.test(n)) return 'amex';
    if (/^6(?:011|5)/.test(n)) return 'discover';
    return 'unknown';
};

// Gradientes ricos, oscuros y "metálicos" para un look premium.
const brandStyles: Record<CardBrand, { gradient: string; logo: React.ReactNode }> = {
    visa: {
        gradient: 'from-blue-800 via-indigo-900 to-slate-950',
        logo: <span className="font-black italic text-white text-2xl tracking-tight drop-shadow-lg">VISA</span>,
    },
    mastercard: {
        gradient: 'from-rose-700 via-orange-800 to-slate-950',
        logo: (
            <div className="flex items-center -space-x-3.5">
                <div className="w-8 h-8 rounded-full bg-[#eb001b]" />
                <div className="w-8 h-8 rounded-full bg-[#f79e1b] mix-blend-hard-light" />
            </div>
        ),
    },
    amex: {
        gradient: 'from-sky-700 via-cyan-800 to-slate-950',
        logo: <span className="font-black italic text-white text-sm tracking-[0.15em] drop-shadow">AMEX</span>,
    },
    discover: {
        gradient: 'from-orange-600 via-amber-800 to-slate-950',
        logo: <span className="font-black text-white text-xs tracking-tight drop-shadow">DISCOVER</span>,
    },
    unknown: {
        gradient: 'from-slate-800 via-slate-900 to-black',
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

/** Chip EMV realista. */
function Chip() {
    return (
        <div className="w-12 h-9 rounded-[7px] bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 shadow-md relative overflow-hidden ring-1 ring-amber-700/40">
            <div className="absolute inset-[3px] rounded-[4px] border border-amber-800/30" />
            <div className="absolute left-0 right-0 top-1/3 h-px bg-amber-800/40" />
            <div className="absolute left-0 right-0 top-2/3 h-px bg-amber-800/40" />
            <div className="absolute top-0 bottom-0 left-1/3 w-px bg-amber-800/40" />
            <div className="absolute top-0 bottom-0 left-2/3 w-px bg-amber-800/40" />
            <div className="absolute inset-x-[34%] inset-y-[30%] rounded-[2px] bg-amber-200/70 border border-amber-700/40" />
        </div>
    );
}

export default function AnimatedCardPreview({
    number,
    name,
    expiry,
    cvv,
    focus,
    flipped,
    brand: brandOverride,
}: AnimatedCardPreviewProps) {
    const autoBrand = useMemo(() => detectBrand(number), [number]);
    const brand = brandOverride ?? autoBrand;
    const { gradient, logo } = brandStyles[brand];
    const reduce = useReduce();

    const isFlipped = flipped ?? focus === 'cvv';
    const cvvLength = brand === 'amex' ? 4 : 3;
    const cvvDisplay = (cvv || '').slice(0, cvvLength).padEnd(cvvLength, '•');

    // ── Tilt 3D interactivo (sigue el dedo/mouse) + glare dinámico ──────────
    const rx = useMotionValue(0); // rotación en X (arriba/abajo)
    const ry = useMotionValue(0); // rotación en Y (izq/der)
    const gx = useMotionValue(50); // glare X (%)
    const gy = useMotionValue(50); // glare Y (%)
    const srx = useSpring(rx, { stiffness: 180, damping: 18, mass: 0.4 });
    const sry = useSpring(ry, { stiffness: 180, damping: 18, mass: 0.4 });
    // El reflejo se mueve MUY lento (spring suave y pesado) → parece luz reflejándose al
    // inclinar la tarjeta, no una linterna que persigue el dedo.
    const gxs = useSpring(gx, { stiffness: 16, damping: 24, mass: 1.8 });
    const gys = useSpring(gy, { stiffness: 16, damping: 24, mass: 1.8 });
    // Reflejo GRANDE y difuso: núcleo amplio + caída muy suave (elíptico, como un haz ancho).
    const glare = useMotionTemplate`radial-gradient(120% 90% at ${gxs}% ${gys}%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.12) 38%, rgba(255,255,255,0.03) 62%, transparent 85%)`;

    const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;  // 0..1
        const py = (e.clientY - r.top) / r.height;   // 0..1
        const MAX = 14; // grados máximos de inclinación (bordear, no girar entero)
        ry.set((px - 0.5) * 2 * MAX);
        rx.set(-(py - 0.5) * 2 * MAX);
        gx.set(px * 100);
        gy.set(py * 100);
    };
    const resetTilt = () => { rx.set(0); ry.set(0); gx.set(50); gy.set(50); };

    // Capas premium compartidas por frente y dorso: brillo metálico + textura.
    const premiumLayers = (
        <>
            <div className="absolute -top-24 -right-12 w-72 h-72 bg-white/15 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-12 w-56 h-56 bg-black/30 rounded-full blur-3xl" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30" />
            <div
                className="absolute inset-0 opacity-70 pointer-events-none"
                style={{
                    background:
                        'linear-gradient(115deg, transparent 28%, rgba(255,255,255,0.20) 44%, rgba(255,255,255,0.04) 56%, transparent 72%)',
                }}
            />
            <div
                className="absolute inset-0 opacity-[0.07] mix-blend-overlay pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
                    backgroundSize: '7px 7px',
                }}
            />
            {/* Realismo: luz en el borde superior + sombra interna inferior (profundidad de tarjeta física) */}
            <div className="absolute inset-x-0 top-0 h-px bg-white/40 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none" />
        </>
    );

    return (
        <div
            className="w-full touch-none select-none"
            style={{ perspective: 1400, touchAction: 'none' }}
            onPointerMove={handlePointer}
            onPointerLeave={resetTilt}
            onPointerUp={resetTilt}
            onPointerCancel={resetTilt}
        >
            {/* Capa de TILT (inclinación que sigue el dedo) */}
            <motion.div style={{ rotateX: srx, rotateY: sry, transformStyle: 'preserve-3d' }}>
                {/* Capa de FLIP (gira al CVC) */}
                <motion.div
                    className="relative w-full aspect-[1.586/1] rounded-2xl ring-1 ring-white/15"
                    style={{
                        transformStyle: 'preserve-3d',
                        boxShadow: '0 24px 55px -14px rgba(0,0,0,0.6), 0 6px 16px -8px rgba(0,0,0,0.5)',
                    }}
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 22 }}
                >
                    {/* FRONT */}
                    <div
                        className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} p-5 sm:p-6 text-white overflow-hidden`}
                        style={{ backfaceVisibility: 'hidden' }}
                    >
                        {premiumLayers}
                        {/* Foil holográfico */}
                        <div
                            className="absolute bottom-5 right-5 w-9 h-9 rounded-lg opacity-50 mix-blend-overlay pointer-events-none"
                            style={{ background: 'conic-gradient(from 210deg, #f0abfc, #67e8f9, #fde68a, #f0abfc)' }}
                        />

                        {/* Header: emisor + marca */}
                        <div className="relative z-10 flex items-center justify-between">
                            <span className="text-[10px] font-brand font-semibold tracking-[0.2em] uppercase text-amber-200/90">Luxury Garage</span>
                            <span className="text-[8px] font-bold tracking-[0.2em] uppercase text-white/40">Member</span>
                        </div>

                        {/* Chip + contactless + logo de marca */}
                        <div className="relative z-10 flex items-center gap-3 mt-4">
                            <Chip />
                            <Wifi size={18} className="rotate-90 text-white/80" strokeWidth={2.5} />
                            <div className="ml-auto">
                                <motion.div
                                    key={brand}
                                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotate: -10 }}
                                    animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
                                    transition={reduce ? { duration: 0.2 } : springPop}
                                >
                                    {logo}
                                </motion.div>
                            </div>
                        </div>

                        {/* Number */}
                        <motion.div
                            className="relative z-10 mt-4"
                            animate={reduce ? { scale: 1, y: 0 } : {
                                scale: focus === 'number' ? 1.02 : 1,
                                y: focus === 'number' ? -2 : 0,
                            }}
                            transition={springSoft}
                        >
                            <p
                                className={`font-mono text-xl sm:text-2xl font-bold tracking-[0.16em] tabular-nums transition-all [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] ${focus === 'number'
                                    ? 'drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]'
                                    : ''
                                    }`}
                            >
                                {formatNumberDisplay(number, brand)}
                            </p>
                        </motion.div>

                        {/* Name + Expiry */}
                        <div className="relative z-10 flex items-end justify-between mt-4">
                            <motion.div
                                className="flex-1 min-w-0 mr-4"
                                animate={reduce ? { scale: 1, y: 0 } : {
                                    scale: focus === 'name' ? 1.04 : 1,
                                    y: focus === 'name' ? -2 : 0,
                                }}
                                transition={springSoft}
                            >
                                <p className="text-[8px] font-bold tracking-[0.2em] uppercase opacity-50 mb-1">Titular</p>
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
                                animate={reduce ? { scale: 1, y: 0 } : {
                                    scale: focus === 'expiry' ? 1.05 : 1,
                                    y: focus === 'expiry' ? -2 : 0,
                                }}
                                transition={springSoft}
                            >
                                <p className="text-[8px] font-bold tracking-[0.2em] uppercase opacity-50 mb-1">Vence</p>
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

                        {/* Glare dinámico que sigue el dedo/mouse (reflejo suave) */}
                        <motion.div
                            className="absolute inset-0 pointer-events-none mix-blend-soft-light z-20"
                            style={{ background: glare, filter: 'blur(26px)' }}
                        />
                    </div>

                    {/* BACK */}
                    <div
                        className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} text-white overflow-hidden`}
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                        {premiumLayers}

                        {/* Banda magnética */}
                        <div className="relative z-10 h-12 bg-black/85 mt-6" />

                        <div className="relative z-10 px-5 sm:px-6 pt-5">
                            <p className="text-[8px] font-bold tracking-[0.2em] uppercase opacity-60 mb-2">CVV / CVC</p>
                            <div className="bg-white/95 rounded-md h-10 flex items-center justify-end px-3 relative overflow-hidden">
                                <div
                                    className="absolute inset-0 opacity-30"
                                    style={{
                                        backgroundImage:
                                            'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.06) 4px, rgba(0,0,0,0.06) 8px)',
                                    }}
                                />
                                <motion.p
                                    key={cvvDisplay}
                                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -5 }}
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
            </motion.div>
        </div>
    );
}
