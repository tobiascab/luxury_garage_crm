/**
 * Preguntas frecuentes — acordeón animado (framer-motion) con expand/collapse.
 * Respeta prefers-reduced-motion (sin animar altura cuando el usuario lo pide).
 * Contenido real del negocio: membresía, cancelación, pagos (Bancard 3DS),
 * domicilio (VIP) y cómo se reserva.
 */
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { SectionShell, SectionHeading, cls } from '../ui';
import { motion, AnimatePresence, StaggerList, StaggerItem, useReduce } from '../../lib/motion';

const FAQS = [
  {
    q: '¿Cómo funciona la membresía?',
    a: 'Elegís un plan mensual y, según el que tengas, accedés a lavados y servicios de detailing incluidos o con tarifas preferenciales. Gestionás todo desde la app: tus vehículos, tus reservas y tu historial de servicios.',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: 'Sí. La membresía es flexible y la cancelás en cualquier momento desde tu cuenta, sin permanencia ni penalidades. Seguís disfrutando los beneficios hasta el final del período ya abonado.',
  },
  {
    q: '¿Qué métodos de pago aceptan?',
    a: 'Los pagos se procesan con Bancard, de forma 100% segura. Podés abonar con tarjeta de crédito o débito y cada operación está protegida con autenticación 3D Secure (3DS). No guardamos los datos de tu tarjeta.',
  },
  {
    q: '¿Atienden a domicilio?',
    a: 'El servicio a domicilio está disponible para el plan VIP, sujeto a zona de cobertura y disponibilidad de agenda. Coordinás el día y horario directamente desde la app al reservar.',
  },
  {
    q: '¿Cómo reservo mi turno?',
    a: 'Desde la app elegís el servicio, el día y el horario disponible, y confirmás en segundos. Al llegar al local mostrás tu pase QR para acreditar la reserva, sin llamadas ni esperas.',
  },
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReduce();

  return (
    <SectionShell alt>
      <SectionHeading
        eyebrow="Preguntas frecuentes"
        title="Todo lo que necesitás saber"
        subtitle="Resolvemos las dudas más comunes antes de que te sumes al club."
      />

      <StaggerList onView className="max-w-3xl mx-auto space-y-3">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <StaggerItem key={item.q}>
              <div className={`${cls.card} overflow-hidden transition-colors ${isOpen ? 'border-secondary/40' : 'hover:border-white/25'}`}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="font-headline font-black tracking-tight text-white text-base sm:text-lg">
                    {item.q}
                  </span>
                  <motion.span
                    aria-hidden
                    animate={reduce ? undefined : { rotate: isOpen ? 45 : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                    className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                      isOpen
                        ? 'bg-secondary/15 border-secondary/40 text-secondary'
                        : 'bg-white/5 border-white/15 text-slate-300'
                    }`}
                  >
                    <Plus size={16} />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-6 text-slate-400 text-sm leading-relaxed font-light">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerList>
    </SectionShell>
  );
}
