/**
 * ============================================================================
 *  Luxury Garage — Sistema de animación compartido (ÚNICA fuente de verdad)
 * ============================================================================
 *
 *  Importa desde:
 *    - Páginas luxury-design  (src/luxury-design/pages/*.tsx) ->  '../lib/motion'
 *    - Páginas admin          (src/pages/admin/*.jsx)          ->  '../../luxury-design/lib/motion'
 *
 *  Estética objetivo: "moderno y vivo" con spring physics, sutil pero
 *  perceptible. Todo respeta `prefers-reduced-motion` automáticamente.
 *
 *  Reglas de duración:
 *    - Entradas/stagger: 0.30–0.45s
 *    - Micro-interacciones (tap/hover): spring, casi instantáneo
 *    - Nada por encima de ~0.6s, sin rebotes exagerados.
 * ============================================================================
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  motion,
  useReducedMotion,
  useInView,
  type Variants,
  type Transition,
  type MotionProps,
  type HTMLMotionProps,
} from 'framer-motion';

/* ============================================================================
 *  1. TRANSICIONES / SPRINGS ESTÁNDAR
 * ========================================================================== */

/** Spring suave: para entradas de página, cards grandes y montos. */
export const springSoft: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 30,
  mass: 0.9,
};

/** Spring rápido y "vivo": para tap/hover y pop-ins de badges. */
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 28,
  mass: 0.6,
};

/** Spring con un poco más de carácter: ideal para pop-in de íconos/badges. */
export const springPop: Transition = {
  type: 'spring',
  stiffness: 600,
  damping: 18,
  mass: 0.7,
};

/** Easing corto sin physics, cuando se necesita determinismo (ej. exits). */
export const easeOutFast: Transition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1], // easeOutQuint suave
};

/** Easing estándar de entrada para fades/slides de secciones. */
export const easeEntrance: Transition = {
  duration: 0.4,
  ease: [0.16, 1, 0.3, 1], // easeOutExpo
};

/* ============================================================================
 *  2. VARIANTS REUTILIZABLES
 * ========================================================================== */

/** Transición de ruta: fade + slide vertical corto. Usado por <PageTransition>. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: easeEntrance },
  exit: { opacity: 0, y: -8, transition: easeOutFast },
};

/** Contenedor que escalona (stagger) a sus hijos al montar. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

/** Item hijo de un staggerContainer: fade + slide-up corto con spring. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: springSoft },
};

/** Fade simple (sin desplazamiento). */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: easeEntrance },
};

/** Slide-up con fade. */
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: springSoft },
};

/** Scale-in con fade: para modales / cards que aparecen. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: springSoft },
  exit: { opacity: 0, scale: 0.96, transition: easeOutFast },
};

/** Pop-in con spring marcado: badges de estado, íconos de éxito, etc. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  show: { opacity: 1, scale: 1, transition: springPop },
  exit: { opacity: 0, scale: 0.4, transition: easeOutFast },
};

/* ============================================================================
 *  3. PRESETS DE INTERACCIÓN (para spread directo en props de motion.*)
 * ========================================================================== */

/** Card/elemento interactivo: hover (scale + sombra) + tap (scale down). */
export const hoverable = {
  whileHover: { scale: 1.025, y: -2 },
  whileTap: { scale: 0.97 },
  transition: springSnappy,
} satisfies Pick<MotionProps, 'whileHover' | 'whileTap' | 'transition'>;

/** Solo feedback al presionar (botones/chips, sin levantarse al hover). */
export const tapOnly = {
  whileTap: { scale: 0.95 },
  transition: springSnappy,
} satisfies Pick<MotionProps, 'whileTap' | 'transition'>;

/* ============================================================================
 *  4. REDUCE-MOTION: hook + helpers
 * ========================================================================== */

/**
 * Envuelve useReducedMotion de framer-motion.
 * @returns true si el usuario pidió menos movimiento.
 */
export function useReduce(): boolean {
  return useReducedMotion() ?? false;
}

/** Variants neutros (sin transform) usados cuando reduce-motion está activo. */
const REDUCED_FADE: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

/**
 * Devuelve los variants pasados, o un fade simple si reduce-motion está activo.
 * Así las páginas no tienen que ramificar a mano.
 *
 * @example const v = useVariants(slideUp); <motion.div variants={v} />
 */
export function useVariants(variants: Variants): Variants {
  const reduce = useReduce();
  return reduce ? REDUCED_FADE : variants;
}

/**
 * Devuelve presets de interacción "vacíos" (sin scale) si reduce-motion activo.
 * @example <motion.button {...useInteraction(hoverable)} />
 */
export function useInteraction<T extends Partial<MotionProps>>(preset: T): Partial<MotionProps> {
  // OJO: a pesar del nombre `use*`, esto NO es un hook. Se invoca dentro de .map()
  // en varias páginas (uno por item) y, si llamara a useReduce()/useReducedMotion(),
  // violaría las reglas de hooks (cantidad de hooks variable entre renders → React #310,
  // sobre todo cuando la página hace un return temprano de <Skeleton> mientras carga).
  // Por eso lee reduce-motion de forma síncrona con matchMedia, sin hooks.
  const reduce =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  return reduce ? {} : preset;
}

/* ============================================================================
 *  5. <AnimatedNumber /> — contador count-up
 * ========================================================================== */

interface AnimatedNumberProps {
  /** Valor final a mostrar. */
  value: number;
  /** Texto antes del número (ej. "₲ "). */
  prefix?: string;
  /** Texto después del número (ej. " km", "%"). */
  suffix?: string;
  /** Decimales a mostrar. Default 0. */
  decimals?: number;
  /**
   * Si true, formatea con separadores de miles es-PY (₲ 1.500.000).
   * Útil para montos en guaraníes. Default false.
   */
  currency?: boolean;
  /** Duración de la animación en segundos. Default 0.9. */
  duration?: number;
  /** className aplicado al <span> contenedor. */
  className?: string;
}

const esPYFormat = (n: number, decimals: number, currency: boolean) =>
  currency
    ? n.toLocaleString('es-PY', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : n.toLocaleString('es-PY', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

/**
 * Contador animado de 0 → value al aparecer (count-up con easing).
 * Respeta reduce-motion (muestra el valor final directo, sin animar).
 *
 * @example <AnimatedNumber value={1500000} prefix="₲ " currency />
 * @example <AnimatedNumber value={4.8} decimals={1} suffix=" ★" />
 */
export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  currency = false,
  duration = 0.9,
  className,
}: AnimatedNumberProps) {
  const reduce = useReduce();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    if (!inView) return;

    let raf = 0;
    const start = performance.now();
    const from = 0;
    const ms = duration * 1000;
    // easeOutExpo para una salida "viva" que frena suave
    const ease = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const tick = (now: number) => {
      const t = Math.min((now - start) / ms, 1);
      setDisplay(from + (value - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {esPYFormat(display, decimals, currency)}
      {suffix}
    </span>
  );
}

/* ============================================================================
 *  6. <Reveal /> / <StaggerList /> / <StaggerItem /> — entradas con stagger
 * ========================================================================== */

interface RevealProps extends Omit<HTMLMotionProps<'div'>, 'variants' | 'initial' | 'animate'> {
  children: React.ReactNode;
  /** Variant de entrada. Default slideUp. */
  variant?: Variants;
  /** Delay extra en segundos. */
  delay?: number;
  /** Si true anima solo al entrar en viewport (en vez de al montar). */
  onView?: boolean;
}

/**
 * Envuelve cualquier bloque para que entre con fade+slide (o el variant dado).
 * Respeta reduce-motion.
 *
 * @example <Reveal><Card /></Reveal>
 * @example <Reveal variant={scaleIn} onView delay={0.1}>...</Reveal>
 */
export function Reveal({ children, variant = slideUp, delay = 0, onView = false, ...rest }: RevealProps) {
  const v = useVariants(variant);
  return (
    <motion.div
      variants={v}
      initial="hidden"
      {...(onView
        ? { whileInView: 'show', viewport: { once: true, margin: '-10% 0px' } }
        : { animate: 'show' })}
      transition={{ delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

interface StaggerListProps extends Omit<HTMLMotionProps<'div'>, 'variants' | 'initial' | 'animate'> {
  children: React.ReactNode;
  /** Si true anima al entrar en viewport en vez de al montar. */
  onView?: boolean;
}

/**
 * Contenedor que escalona la entrada de sus <StaggerItem> hijos.
 *
 * @example
 * <StaggerList className="space-y-3">
 *   {items.map(i => <StaggerItem key={i.id}><Row {...i} /></StaggerItem>)}
 * </StaggerList>
 */
export function StaggerList({ children, onView = false, ...rest }: StaggerListProps) {
  const reduce = useReduce();
  return (
    <motion.div
      variants={reduce ? undefined : staggerContainer}
      initial={reduce ? undefined : 'hidden'}
      {...(reduce
        ? {}
        : onView
          ? { whileInView: 'show', viewport: { once: true, margin: '-8% 0px' } }
          : { animate: 'show' })}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: React.ReactNode;
}

/** Item hijo directo de <StaggerList>. */
export function StaggerItem({ children, ...rest }: StaggerItemProps) {
  const v = useVariants(staggerItem);
  return (
    <motion.div variants={v} {...rest}>
      {children}
    </motion.div>
  );
}

/* ============================================================================
 *  7. <Skeleton /> / <SkeletonText /> — placeholders con shimmer (dark-aware)
 * ========================================================================== */

interface SkeletonProps {
  /** className para tamaño/forma (ej. "w-full h-24 rounded-2xl"). */
  className?: string;
}

/**
 * Placeholder con efecto shimmer. Soporta light/dark.
 * Si reduce-motion está activo cae a un pulse estático (sin barrido).
 *
 * @example <Skeleton className="w-full h-24 rounded-2xl" />
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  const reduce = useReduce();

  if (reduce) {
    return (
      <div
        className={`animate-pulse bg-slate-200 dark:bg-slate-700/60 ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-slate-200 dark:bg-slate-700/60 ${className}`}
      aria-hidden="true"
    >
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10"
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
      />
    </div>
  );
}

interface SkeletonTextProps {
  /** Cantidad de líneas. Default 3. */
  lines?: number;
  /** className extra para el contenedor. */
  className?: string;
}

/**
 * Bloque de líneas de texto "fantasma". La última línea sale más corta.
 *
 * @example <SkeletonText lines={4} />
 */
export function SkeletonText({ lines = 3, className = '' }: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 rounded-full ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

/* ============================================================================
 *  8. <Pressable /> — botón/div con whileTap/whileHover por defecto
 * ========================================================================== */

type PressableProps = HTMLMotionProps<'button'> & {
  /** Renderiza como <div> en vez de <button> (cuando no es semánticamente botón). */
  asDiv?: boolean;
  /** Desactiva el lift al hover (solo tap). */
  tapOnly?: boolean;
};

/**
 * Wrapper interactivo con feedback premium (hover lift + tap squash).
 * Respeta reduce-motion (sin transforms). Pasa el resto de props al elemento.
 *
 * @example <Pressable onClick={pay} className="btn-primary">Pagar</Pressable>
 * @example <Pressable asDiv className="card">...</Pressable>
 */
export function Pressable({ asDiv = false, tapOnly: tapOnlyProp = false, children, ...rest }: PressableProps) {
  const interaction = useInteraction(tapOnlyProp ? tapOnly : hoverable);
  const Comp = asDiv ? motion.div : motion.button;
  // motion.div no acepta `type`; lo descartamos en ese caso.
  const safeRest = asDiv ? (({ type: _t, ...r }) => r)(rest as HTMLMotionProps<'button'>) : rest;
  return (
    <Comp {...interaction} {...(safeRest as HTMLMotionProps<'button'>)}>
      {children}
    </Comp>
  );
}

/* ============================================================================
 *  9. <PageTransition /> — envuelve el contenido de cada página
 * ========================================================================== */

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Envuelve el contenido de una página para la transición de ruta
 * (fade + slide corto). Pensado para ir dentro del <AnimatePresence
 * mode="wait"> del layout, o standalone al inicio de cada página.
 * Respeta reduce-motion.
 *
 * @example
 * export default function MiPagina() {
 *   return <PageTransition>... contenido ...</PageTransition>;
 * }
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const v = useVariants(pageVariants);
  return (
    <motion.div variants={v} initial="initial" animate="animate" exit="exit" className={className}>
      {children}
    </motion.div>
  );
}

/* ============================================================================
 *  Re-exports de conveniencia (para no importar framer-motion en cada página)
 * ========================================================================== */
export { motion, AnimatePresence } from 'framer-motion';
export type { Variants, Transition } from 'framer-motion';
