/**
 * Testimonios de clientes — prueba social premium.
 * Cards con quote + avatar (inicial) + nombre + vehículo/rol. Borde sutil dorado,
 * entrada con stagger y leve tilt 3D. Sin métricas de negocio inventadas.
 */
import React from 'react';
import { Quote } from 'lucide-react';
import { SectionShell, SectionHeading, Tilt, cls } from '../ui';
import { StaggerList, StaggerItem } from '../../lib/motion';

/* TODO: reemplazar por testimonios reales */
const TESTIMONIOS = [
  {
    quote:
      'Reservar el lavado desde el celu y mostrar el QR al llegar me cambió la rutina. Mi auto siempre impecable y sin perder tiempo.',
    name: 'Rodrigo Benítez',
    role: 'Toyota Corolla Cross',
  },
  {
    quote:
      'El detailing quedó impecable y me encanta tener el historial de cada servicio en la app. Atención de primer nivel.',
    name: 'Camila Giménez',
    role: 'Volkswagen T-Cross',
  },
  {
    quote:
      'La membresía vale cada guaraní. Pago seguro con tarjeta y me avisan cuando el auto está listo. Recomendadísimo.',
    name: 'Marcelo Acuña',
    role: 'Hilux SRV',
  },
];

export default function TestimoniosSection() {
  return (
    <SectionShell>
      <SectionHeading
        eyebrow="Clientes del club"
        title="Lo que dicen quienes ya se sumaron"
        subtitle="Experiencias reales de socios que cuidan su vehículo con Luxury Garage."
      />

      <StaggerList onView className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {TESTIMONIOS.map((t) => (
          <StaggerItem key={t.name}>
            <Tilt className="h-full" max={8}>
              <figure className={`${cls.card} h-full p-7 flex flex-col border-secondary/20 hover:border-secondary/40 transition-colors`}>
                <Quote size={28} className="text-secondary/60 shrink-0" strokeWidth={1.75} />
                <blockquote className="text-slate-300 text-sm sm:text-[15px] leading-relaxed mt-5 flex-1 font-light">
                  “{t.quote}”
                </blockquote>
                <figcaption className="flex items-center gap-3 mt-7 pt-6 border-t border-white/10">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/10 border border-secondary/30 font-headline font-black text-secondary text-lg">
                    {t.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-headline font-black text-white text-sm tracking-tight truncate">
                      {t.name}
                    </span>
                    <span className="block text-slate-500 text-xs truncate">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            </Tilt>
          </StaggerItem>
        ))}
      </StaggerList>
    </SectionShell>
  );
}
