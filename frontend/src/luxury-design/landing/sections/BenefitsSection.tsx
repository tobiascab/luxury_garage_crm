import React from 'react';
import { Car, CalendarCheck, QrCode, Wallet, Gift, BellRing } from 'lucide-react';
import { SectionShell, SectionHeading, Tilt, cls } from '../ui';
import { StaggerList, StaggerItem } from '../../lib/motion';
import { IMG } from '../assets';

const BENEFITS = [
  {
    icon: Car,
    title: 'Garage Digital',
    desc: 'Cargá tus vehículos una sola vez y tené su historial completo de lavados y detailing siempre a mano.',
  },
  {
    icon: CalendarCheck,
    title: 'Reservas en segundos',
    desc: 'Elegí servicio, día y horario desde el celular. Sin llamadas ni esperas: confirmás tu turno al instante.',
  },
  {
    icon: QrCode,
    title: 'Pase QR',
    desc: 'Acreditá tu reserva mostrando tu código QR en el local. Ingreso rápido y sin papeles.',
  },
  {
    icon: Wallet,
    title: 'Pagos seguros con Bancard',
    desc: 'Abonás tus servicios y membresías con tarjeta a través de Bancard, con la seguridad del VPOS.',
  },
  {
    icon: Gift,
    title: 'Programa de referidos',
    desc: 'Invitá a tus conocidos al club y ganá beneficios cuando se suman con tu recomendación.',
  },
  {
    icon: BellRing,
    title: 'Notificaciones en tiempo real',
    desc: 'Recibí avisos push del estado de tu reserva, recordatorios y novedades del club al momento.',
  },
];

export default function BenefitsSection() {
  return (
    <SectionShell alt bgImage={IMG.polishing}>
      <SectionHeading
        eyebrow="Por qué Luxury Garage"
        title="Tu club de detailing, en la palma de tu mano"
        subtitle="Todo lo que necesitás para mantener tu auto impecable, gestionado desde una sola app pensada para vos."
      />

      <StaggerList onView className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {BENEFITS.map(({ icon: Icon, title, desc }) => (
          <StaggerItem key={title}>
            <Tilt className="h-full">
              <div className={`${cls.card} ${cls.cardHover} h-full p-7`}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 border border-secondary/20 text-secondary">
                  <Icon size={24} strokeWidth={1.75} />
                </div>
                <h3 className="font-headline font-black tracking-tight text-white text-xl mt-6">
                  {title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mt-3 font-light">
                  {desc}
                </p>
              </div>
            </Tilt>
          </StaggerItem>
        ))}
      </StaggerList>
    </SectionShell>
  );
}
