/**
 * Franja de confianza sobria: 4 pilares del servicio con íconos lucide-react.
 * Sin números ni métricas inventadas, solo lo que el club realmente ofrece.
 */
import React from 'react';
import { ShieldCheck, CalendarCheck, Car, QrCode } from 'lucide-react';
import { StaggerList, StaggerItem } from '../../lib/motion';

const PILARES = [
  { icon: ShieldCheck, label: 'Pagos seguros con Bancard' },
  { icon: CalendarCheck, label: 'Agenda digital' },
  { icon: Car, label: 'Garage digital' },
  { icon: QrCode, label: 'Carnet QR' },
];

export default function ConfianzaBand() {
  return (
    <section className="border-y border-white/10 py-10 px-5" style={{ backgroundColor: '#0b0b0d' }}>
      <StaggerList onView className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {PILARES.map(({ icon: Icon, label }) => (
          <StaggerItem key={label}>
            <div className="flex flex-col items-center text-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 border border-secondary/20 text-secondary">
                <Icon size={22} strokeWidth={1.75} />
              </span>
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 leading-snug">
                {label}
              </span>
            </div>
          </StaggerItem>
        ))}
      </StaggerList>
    </section>
  );
}
