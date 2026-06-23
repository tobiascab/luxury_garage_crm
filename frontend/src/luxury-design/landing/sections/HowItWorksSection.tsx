import { SectionShell, SectionHeading, cls } from '../ui';
import { StaggerList, StaggerItem } from '../../lib/motion';
import { ClipboardList, CalendarCheck, QrCode, Sparkles } from 'lucide-react';
import { IMG } from '../assets';

const STEPS = [
  {
    n: '01',
    icon: ClipboardList,
    title: 'Elegí tu plan',
    desc: 'Sumate al club con la membresía que mejor se adapte a vos y desbloqueá beneficios exclusivos.',
  },
  {
    n: '02',
    icon: CalendarCheck,
    title: 'Reservá tu turno',
    desc: 'Agendá tu lavado o detailing online en segundos, eligiendo día y horario desde la app.',
  },
  {
    n: '03',
    icon: QrCode,
    title: 'Escaneá tu QR',
    desc: 'Presentá tu pase QR al llegar. Tu vehículo y tu reserva quedan identificados al instante.',
  },
  {
    n: '04',
    icon: Sparkles,
    title: 'Disfrutá tu auto impecable',
    desc: 'Retirá tu auto reluciente y recibí notificaciones en cada paso del proceso.',
  },
];

export default function HowItWorksSection() {
  return (
    <SectionShell id="como-funciona" alt bgImage={IMG.microfiber[1]}>
      <SectionHeading
        eyebrow="Cómo funciona"
        title={<>Tu auto impecable en <span className="text-secondary">4 pasos</span></>}
        subtitle="Una experiencia premium pensada para que cuidar tu vehículo sea simple, rápido y sin complicaciones."
      />

      <div className="relative">
        {/* Línea dorada sutil que conecta los pasos en desktop */}
        <div
          aria-hidden
          className="hidden lg:block absolute top-12 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/25 to-transparent"
        />

        <StaggerList onView className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <StaggerItem key={step.n}>
                <div className={`${cls.card} ${cls.cardHover} group h-full p-7 flex flex-col`}>
                  <div className="flex items-start justify-between">
                    <span className="font-headline font-black text-5xl text-secondary/20 leading-none transition-colors group-hover:text-secondary/40">
                      {step.n}
                    </span>
                    <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-secondary/10 border border-secondary/20 text-secondary">
                      <Icon size={20} />
                    </span>
                  </div>

                  <h3 className="font-headline font-black tracking-tight text-white text-xl mt-6">
                    {step.title}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed mt-2 font-light">
                    {step.desc}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerList>
      </div>
    </SectionShell>
  );
}
