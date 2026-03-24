import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  History,
  Gift,
  Star,
  QrCode,
  X,
  Droplets,
  Sparkles,
  Wallet,
  Zap
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';

interface DashboardProps {
  user: any;
}

export default function Dashboard({ user }: DashboardProps) {
  const [showQR, setShowQR] = useState(false);
  const navigate = useNavigate();

  const UPCOMING_STATUSES = ['CONFIRMED', 'PENDING', 'Confirmado', 'Pendiente'];
  const COMPLETED_STATUSES = ['COMPLETED', 'Completado'];

  // Next upcoming appointment (future date, confirmed)
  const nextBooking = user?.bookings
    ?.filter((b: any) =>
      UPCOMING_STATUSES.includes(b.status) &&
      new Date(b.booking_date ?? b.startTime) > new Date()
    )
    ?.sort((a: any, b: any) =>
      new Date(a.booking_date ?? a.startTime).getTime() -
      new Date(b.booking_date ?? b.startTime).getTime()
    )?.[0];

  // Washes done this month
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const washesDone = (user?.bookings ?? []).filter((b: any) => {
    const d = new Date(b.booking_date ?? b.startTime);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear &&
      COMPLETED_STATUSES.includes(b.status);
  }).length;

  const walletBalance = user?.wallet_balance ?? 0;
  const isUnlimited = (user?.role ?? '').toLowerCase().includes('platinum') || (user?.role ?? '').toLowerCase().includes('vip') || (user?.role ?? '').toLowerCase().includes('lujo') || (user?.role ?? '').toLowerCase().includes('prima');
  const monthlyLimit = (user?.role ?? '').toLowerCase().includes('basico') ? 4 : isUnlimited ? '∞' : 4;
  const formatGs = (n: number) => `₲ ${n.toLocaleString('es-PY')}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 pb-28 max-w-lg mx-auto"
    >
      {/* Welcome Section */}
      <section className="flex justify-between items-center px-1">
        <div>
          <h2 className="font-headline text-3xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-2 uppercase italic">
            <span>👋</span> Hola, {user?.name?.split(' ')[0] || 'Miembro'}!
          </h2>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-1">Estatus de Membresía</p>
        </div>
        <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-emerald-500/10 shadow-sm">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          {user?.membership_status === 'Activa' ? 'ACTIVO' : 'INACTIVO'}
        </div>
      </section>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Tier Card */}
        <div className="bg-slate-900 dark:bg-blue-950 text-white p-5 rounded-[2rem] relative overflow-hidden shadow-2xl h-28 flex flex-col justify-between border border-white/5 transition-all hover:scale-[1.02]">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/30 blur-2xl rounded-full" />
          <div className="flex items-center gap-2 relative z-10">
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10">
              <Star size={12} className="text-secondary" fill="currentColor" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">{user?.role || 'Premium'}</span>
          </div>
          <div className="relative z-10">
            <p className="text-[32px] font-headline font-black italic tracking-tighter leading-none mb-1 uppercase">TIER 1</p>
            <p className="text-[7px] text-white/40 uppercase tracking-[0.3em]">Exclusive Member</p>
          </div>
        </div>

        {/* Next Turn Card */}
        <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-28 transition-all hover:shadow-md">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-primary dark:text-blue-400 flex items-center justify-center border border-blue-500/5">
            <Calendar size={18} />
          </div>
          <div>
            <span className="text-xl font-headline font-black text-slate-900 dark:text-white block leading-tight tracking-tight">
              {nextBooking
                ? new Date(nextBooking.booking_date ?? nextBooking.startTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                : 'Sin turnos'}
            </span>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Próxima Visita</p>
          </div>
        </div>

        {/* Usage Card */}
        <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-28 transition-all hover:shadow-md">
          <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center border border-slate-100 dark:border-slate-700">
            <Droplets size={18} />
          </div>
          <div>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-headline font-black text-slate-900 dark:text-white tracking-tighter leading-none">{washesDone}</span>
              <span className="text-sm font-black text-slate-300 dark:text-slate-600 mb-1">/{monthlyLimit}</span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Lavados / Mes</p>
          </div>
        </div>

        {/* Wallet Card */}
        <button
          onClick={() => navigate('/billetera')}
          className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-28 active:scale-95 transition-all hover:border-amber-200 dark:hover:border-amber-500/40 group text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/5 group-hover:scale-110 transition-transform">
            <Wallet size={18} />
          </div>
          <div>
            <span className="text-xl font-headline font-black text-slate-900 dark:text-white block leading-tight tracking-tighter">{formatGs(walletBalance)}</span>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Saldo LUXU</p>
          </div>
        </button>
      </div>

      {/* ── Próximo Turno Banner (Premium Light Card) ── */}
      {nextBooking ? (
        <div className="relative overflow-hidden bg-white/90 dark:bg-slate-900/60 backdrop-blur-md rounded-[2.5rem] border border-blue-100 dark:border-blue-900/30 shadow-lg shadow-blue-500/5">
          {/* Top blue gradient line */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-[#00d2ff] to-primary/50 rounded-t-[2.5rem]" />
          {/* Background glow */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/8 rounded-full blur-[50px] pointer-events-none" />

          <div className="flex items-stretch">
            {/* Left – Date column with blue gradient */}
            <div className="flex-shrink-0 bg-gradient-to-b from-primary to-blue-700 dark:from-blue-700 dark:to-blue-900 w-[90px] flex flex-col items-center justify-center py-7 rounded-l-[2.5rem] gap-0.5">
              <span className="text-[46px] font-headline font-black text-white leading-none tracking-tighter">
                {new Date(nextBooking.booking_date ?? nextBooking.startTime).getDate()}
              </span>
              <span className="text-[9px] font-black text-blue-200 uppercase tracking-[0.25em]">
                {new Date(nextBooking.booking_date ?? nextBooking.startTime).toLocaleString('es-ES', { month: 'short' })}
              </span>
              <span className="text-[8px] font-bold text-blue-300/50 uppercase tracking-wide mt-0.5">
                {new Date(nextBooking.booking_date ?? nextBooking.startTime).toLocaleString('es-ES', { weekday: 'short' })}
              </span>
            </div>

            {/* Right – Info */}
            <div className="flex-1 px-5 py-5 min-w-0">
              {/* Confirmed badge */}
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.3em]">Turno Confirmado</span>
              </div>

              {/* Time */}
              <p className="text-[26px] font-headline font-black text-slate-900 dark:text-white leading-none tracking-tight">
                {new Date(nextBooking.booking_date ?? nextBooking.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                <span className="text-[14px] font-bold text-slate-400 dark:text-slate-500 ml-1">hs</span>
              </p>

              {/* Service pill */}
              {(nextBooking.service_type ?? nextBooking.service?.name) && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 px-2.5 py-1 rounded-full">
                  <Sparkles size={9} className="text-primary dark:text-blue-400 flex-shrink-0" />
                  <span className="text-[9px] font-black text-primary dark:text-blue-400 uppercase tracking-wide truncate max-w-[150px]">
                    {nextBooking.service_type ?? nextBooking.service?.name}
                  </span>
                </div>
              )}

              {/* Link */}
              <button
                onClick={() => navigate('/booking')}
                className="mt-3 text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest hover:text-primary dark:hover:text-blue-400 transition-colors"
              >
                Ver todos mis turnos →
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/90 dark:bg-slate-900/60 backdrop-blur-md rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 text-center shadow-sm">
          <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 rounded-[1.2rem] flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-500/10">
            <Calendar size={24} className="text-primary dark:text-blue-400" />
          </div>
          <p className="text-slate-400 dark:text-slate-500 text-[10px] mb-5 font-bold tracking-widest uppercase">Sin turnos esta semana</p>
          <button
            onClick={() => navigate('/booking')}
            className="w-full bg-gradient-to-r from-primary to-[#00d2ff] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95"
          >
            Agendar Mi Próximo Lavado
          </button>
        </div>
      )}

      {/* Quick Actions Container */}
      <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
        <h3 className="font-headline text-[10px] font-black flex items-center gap-2 mb-5 text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1">
          <Zap size={14} className="text-secondary fill-secondary" /> Operaciones Rápidas
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <ActionButton icon={<Calendar size={22} className="text-primary dark:text-blue-400" />} label="Reserva" onClick={() => navigate('/booking')} />
          <ActionButton icon={<History size={22} className="text-amber-500" />} label="Historial" onClick={() => navigate('/booking')} />
          <ActionButton icon={<Gift size={22} className="text-rose-500" />} label="Premios" onClick={() => navigate('/referidos')} />
          <ActionButton icon={<Wallet size={22} className="text-emerald-600" />} label="Wallet" onClick={() => navigate('/billetera')} />
          <ActionButton icon={<QrCode size={22} className="text-blue-500" />} label="Pase Digital" onClick={() => setShowQR(true)} />
          <ActionButton icon={<Sparkles size={22} className="text-purple-500" />} label="Premium" onClick={() => navigate('/servicios-extra')} />
        </div>
      </div>

      {/* VIP QR Modal */}
      <AnimatePresence>
        {showQR && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQR(false)}
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-lg"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative z-10 w-full max-w-sm"
            >
              <div className="bg-slate-900 dark:bg-black rounded-[3rem] p-10 relative z-10 text-center border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/20 blur-[100px] rounded-full" />

                <button onClick={() => setShowQR(false)} className="absolute top-6 right-6 p-2 text-white/20 hover:text-white hover:bg-white/10 rounded-full transition-all">
                  <X size={20} />
                </button>

                <h3 className="font-headline text-3xl font-black mb-1 text-white italic uppercase tracking-tighter">Luxury Pass</h3>
                <p className="text-white/30 text-[9px] font-black uppercase tracking-[0.3em] mb-8">{user?.name}</p>

                <div className="bg-white p-5 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,123,255,0.2)] mb-8 inline-block relative group transition-transform hover:scale-105">
                  <QrCode size={180} className="text-slate-900" />
                  <div className="absolute inset-0 border-[3px] border-primary/20 rounded-[2.5rem]" />
                </div>

                <div className="flex items-center justify-center gap-2 text-primary dark:text-blue-400 font-black bg-white/5 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 text-[10px] uppercase tracking-widest italic shadow-inner">
                  <Sparkles size={14} fill="currentColor" className="text-secondary" />
                  Socio {user?.role}
                </div>

                <p className="text-white/20 text-[9px] font-bold uppercase tracking-[0.2em] mt-6">Presentar en Recepción</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-primary/20 p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all hover:bg-primary/5 active:scale-95 group shadow-sm"
    >
      <div className="group-hover:scale-110 transition-transform duration-200">{icon}</div>
      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-tight text-center">{label}</span>
    </button>
  );
}
