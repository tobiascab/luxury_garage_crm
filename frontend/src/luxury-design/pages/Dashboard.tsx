import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  History,
  Gift,
  Headset,
  CheckCircle2,
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

  const nextBooking = user?.bookings?.find((b: any) => b.status === 'Pendiente');

  // Real computed stats from user.bookings
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const washesDone = (user?.bookings ?? []).filter((b: any) => {
    const d = new Date(b.booking_date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear && b.status === 'Completado';
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
                ? new Date(nextBooking.booking_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
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

      {/* Featured Banner */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-[#00d2ff] to-primary rounded-[2.5rem] blur opacity-20 group-hover:opacity-30 transition"></div>
        <div className="relative bg-slate-900 dark:bg-blue-950 rounded-[2.5rem] p-8 text-white text-center shadow-2xl border border-white/5 overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-[80px]" />

          {nextBooking ? (
            <>
              <p className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] mb-2 px-4 py-1.5 bg-white/5 backdrop-blur-md rounded-full inline-block border border-white/10 italic">Turno Confirmado</p>
              <h3 className="text-3xl font-headline font-black tracking-tighter italic uppercase mt-2">
                {new Date(nextBooking.booking_date).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}hs
              </h3>
              <p className="text-white/50 text-xs mt-2 font-medium tracking-wide uppercase">{nextBooking.service_type}</p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-white/10">
                <Calendar size={36} className="text-white/20" />
              </div>
              <p className="text-white/40 text-xs mb-8 font-medium tracking-wide uppercase px-8">No tenés turnos programados esta semana</p>
              <button
                onClick={() => navigate('/booking')}
                className="w-full bg-[#00d2ff] hover:bg-secondary text-slate-900 px-8 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-[#00d2ff]/20 hover:shadow-secondary/20 transition-all active:scale-95"
              >
                Agendar Mi Próximo Lavado
              </button>
            </>
          )}
        </div>
      </div>

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
