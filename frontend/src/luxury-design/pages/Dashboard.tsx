import React, { useState, useMemo, memo } from 'react';
import {
  motion,
  AnimatePresence,
  StaggerList,
  StaggerItem,
  Reveal,
  AnimatedNumber,
  Pressable,
  scaleIn,
  popIn,
  useVariants,
  useInteraction,
  hoverable,
  tapOnly,
} from '../lib/motion';
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
  Zap,
  CreditCard
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import useScrollLock from '../../hooks/useScrollLock';

interface DashboardProps {
  user: any;
}

const Dashboard = memo(function Dashboard({ user }: DashboardProps) {
  const [showQR, setShowQR] = useState(false);
  const navigate = useNavigate();

  // Scroll-lock mientras el modal del QR (Luxury Pass) está abierto.
  useScrollLock(showQR);

  const UPCOMING_STATUSES = ['CONFIRMED', 'PENDING', 'Confirmado', 'Pendiente'];
  const COMPLETED_STATUSES = ['COMPLETED', 'Completado'];

  // Memoizamos cálculos costosos para evitar re-renders innecesarios
  const stats = useMemo(() => {
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

    // Consumo del plan: lo calcula el BACKEND (planUsage) sobre el ciclo de la membresía y
    // con el mismo criterio que usa el cobro al reservar. Antes se contaba acá en el navegador
    // sobre `bookings`, que llega recortado a las últimas 5 reservas → el número quedaba corto.
    const usage = user?.planUsage ?? null;
    const washesDone = usage?.used ?? 0;

    const walletBalance = user?.wallet_balance ?? 0;

    const planName = user?.activeMembership?.plan?.name || null;
    // Tope real del plan = suma de los cupos de sus servicios (∞ si alguno es ilimitado).
    const monthlyLimit = !usage ? '—' : (usage.unlimited ? '∞' : usage.quota);
    // Lavados que le quedan en el ciclo (null = ilimitado).
    const washesLeft = usage && !usage.unlimited ? usage.remaining : null;

    return { nextBooking, washesDone, walletBalance, monthlyLimit, planName, washesLeft, usage };
  }, [user?.bookings, user?.wallet_balance, user?.activeMembership, user?.planUsage]);

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-28 max-w-lg mx-auto lg:max-w-none"
    >
      {/* Welcome Section */}
      <Reveal className="flex justify-between items-center px-1">
        <div>
          <h2 className="font-headline text-3xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-2 uppercase italic">
            <span>👋</span> Hola, {user?.name?.split(' ')[0] || 'Miembro'}!
          </h2>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-1">Estatus de Membresía</p>
        </div>
        <motion.div
          variants={useVariants(popIn)}
          initial="hidden"
          animate="show"
          className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-emerald-500/10 shadow-sm"
        >
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          {user?.membership_status === 'Activa' ? 'ACTIVO' : 'INACTIVO'}
        </motion.div>
      </Reveal>

      {/* KPI Cards Grid */}
      <StaggerList className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tier Card */}
        <StaggerItem
          {...useInteraction(hoverable)}
          className="bg-slate-900 dark:bg-blue-950 text-white p-5 rounded-[2rem] relative overflow-hidden shadow-2xl h-28 flex flex-col justify-between border border-white/5"
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/30 blur-2xl rounded-full" />
          <div className="flex items-center gap-2 relative z-10">
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10">
              <Star size={12} className="text-secondary" fill="currentColor" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Membresía</span>
          </div>
          <div className="relative z-10">
            <p className="text-[24px] font-headline font-black italic tracking-tighter leading-none mb-1 uppercase truncate">
              {stats.planName || 'Sin plan'}
            </p>
            <p className="text-[7px] text-white/40 uppercase tracking-[0.3em]">
              {user?.membership_status === 'Activa' ? 'Membresía activa' : 'Sin membresía activa'}
            </p>
          </div>
        </StaggerItem>

        {/* Next Turn Card */}
        <StaggerItem className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-28 transition-all hover:shadow-md">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-primary dark:text-blue-400 flex items-center justify-center border border-blue-500/5">
            <Calendar size={18} />
          </div>
          <div>
            <span className="text-xl font-headline font-black text-slate-900 dark:text-white block leading-tight tracking-tight">
              {stats.nextBooking
                ? new Date(stats.nextBooking.booking_date ?? stats.nextBooking.startTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                : 'Sin turnos'}
            </span>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Próxima Visita</p>
          </div>
        </StaggerItem>

        {/* Usage Card */}
        <StaggerItem className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-28 transition-all hover:shadow-md">
          <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center border border-slate-100 dark:border-slate-700">
            <Droplets size={18} />
          </div>
          <div>
            <div className="flex items-end gap-1">
              <AnimatedNumber
                value={stats.washesDone}
                className="text-3xl font-headline font-black text-slate-900 dark:text-white tracking-tighter leading-none"
              />
              <span className="text-sm font-black text-slate-300 dark:text-slate-600 mb-1">/{stats.monthlyLimit}</span>
            </div>
            {/* Cuánto le queda del plan en ESTE ciclo. Al agotarse avisamos que el próximo
                turno se cobra aparte, que es exactamente lo que hace el sistema al reservar. */}
            <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${stats.washesLeft === 0
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-400 dark:text-slate-500'}`}>
              {!stats.usage ? 'Lavados del plan'
                : stats.usage.unlimited ? 'Lavados · ilimitado'
                  : stats.washesLeft === 0 ? 'Sin cupo · se cobra aparte'
                    : `Te ${stats.washesLeft === 1 ? 'queda' : 'quedan'} ${stats.washesLeft}`}
            </p>
          </div>
        </StaggerItem>

        {/* Wallet Card */}
        <StaggerItem>
          <Pressable
            onClick={() => navigate('/billetera')}
            className="w-full h-28 bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between hover:border-amber-200 dark:hover:border-amber-500/40 group text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/5 group-hover:scale-110 transition-transform">
              <Wallet size={18} />
            </div>
            <div>
              <AnimatedNumber
                value={stats.walletBalance}
                prefix="₲ "
                currency
                className="text-xl font-headline font-black text-slate-900 dark:text-white block leading-tight tracking-tighter"
              />
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Saldo LUXU</p>
            </div>
          </Pressable>
        </StaggerItem>
      </StaggerList>

      {/* ── Próximo Turno Banner (Premium Light Card) ── */}
      {stats.nextBooking ? (
        <Reveal variant={scaleIn} className="relative overflow-hidden bg-white/90 dark:bg-slate-900/60 backdrop-blur-md rounded-[2.5rem] border border-blue-100 dark:border-blue-900/30 shadow-lg shadow-blue-500/5">
          {/* Top blue gradient line */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-[#00d2ff] to-primary/50 rounded-t-[2.5rem]" />
          {/* Background glow */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/8 rounded-full blur-[50px] pointer-events-none" />

          <div className="flex items-stretch">
            {/* Left – Date column with blue gradient */}
            <div className="flex-shrink-0 bg-gradient-to-b from-primary to-blue-700 dark:from-blue-700 dark:to-blue-900 w-[90px] flex flex-col items-center justify-center py-7 rounded-l-[2.5rem] gap-0.5">
              <AnimatedNumber
                value={new Date(stats.nextBooking.booking_date ?? stats.nextBooking.startTime).getDate()}
                duration={0.7}
                className="text-[46px] font-headline font-black text-white leading-none tracking-tighter"
              />
              <span className="text-[9px] font-black text-blue-200 uppercase tracking-[0.25em]">
                {new Date(stats.nextBooking.booking_date ?? stats.nextBooking.startTime).toLocaleString('es-ES', { month: 'short' })}
              </span>
              <span className="text-[8px] font-bold text-blue-300/50 uppercase tracking-wide mt-0.5">
                {new Date(stats.nextBooking.booking_date ?? stats.nextBooking.startTime).toLocaleString('es-ES', { weekday: 'short' })}
              </span>
            </div>

            {/* Right – Info */}
            <div className="flex-1 px-5 py-5 min-w-0">
              {/* Confirmed badge */}
              <motion.div
                variants={useVariants(popIn)}
                initial="hidden"
                animate="show"
                className="flex items-center gap-1.5 mb-3"
              >
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.3em]">Turno Confirmado</span>
              </motion.div>

              {/* Time */}
              <p className="text-[26px] font-headline font-black text-slate-900 dark:text-white leading-none tracking-tight">
                {new Date(stats.nextBooking.booking_date ?? stats.nextBooking.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                <span className="text-[14px] font-bold text-slate-400 dark:text-slate-500 ml-1">hs</span>
              </p>

              {/* Service pill */}
              {(stats.nextBooking.service_type ?? stats.nextBooking.service?.name) && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 px-2.5 py-1 rounded-full">
                  <Sparkles size={9} className="text-primary dark:text-blue-400 flex-shrink-0" />
                  <span className="text-[9px] font-black text-primary dark:text-blue-400 uppercase tracking-wide truncate max-w-[150px]">
                    {stats.nextBooking.service_type ?? stats.nextBooking.service?.name}
                  </span>
                </div>
              )}

              {/* Link */}
              <motion.button
                {...useInteraction(tapOnly)}
                onClick={() => navigate('/booking')}
                className="mt-3 text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest hover:text-primary dark:hover:text-blue-400 transition-colors"
              >
                Ver todos mis turnos →
              </motion.button>
            </div>
          </div>
        </Reveal>
      ) : (
        <Reveal variant={scaleIn} className="bg-white/90 dark:bg-slate-900/60 backdrop-blur-md rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 text-center shadow-sm">
          <motion.div
            variants={useVariants(popIn)}
            initial="hidden"
            animate="show"
            className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 rounded-[1.2rem] flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-500/10"
          >
            <Calendar size={24} className="text-primary dark:text-blue-400" />
          </motion.div>
          <p className="text-slate-400 dark:text-slate-500 text-[10px] mb-5 font-bold tracking-widest uppercase">Sin turnos esta semana</p>
          <Pressable
            onClick={() => navigate('/booking')}
            className="w-full bg-gradient-to-r from-primary to-[#00d2ff] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 hover:shadow-primary/30"
          >
            Agendar Mi Próximo Lavado
          </Pressable>
        </Reveal>
      )}

      {/* Quick Actions Container */}
      <Reveal className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
        <h3 className="font-headline text-[10px] font-black flex items-center gap-2 mb-5 text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1">
          <Zap size={14} className="text-secondary fill-secondary" /> Operaciones Rápidas
        </h3>
        <StaggerList className="grid grid-cols-3 gap-3">
          <ActionButton icon={<Calendar size={22} className="text-primary dark:text-blue-400" />} label="Reserva" onClick={() => navigate('/booking')} />
          <ActionButton icon={<History size={22} className="text-amber-500" />} label="Historial" onClick={() => navigate('/booking')} />
          <ActionButton icon={<Gift size={22} className="text-rose-500" />} label="Premios" onClick={() => navigate('/referidos')} />
          <ActionButton icon={<Wallet size={22} className="text-emerald-600" />} label="Wallet" onClick={() => navigate('/billetera')} />
          <ActionButton icon={<QrCode size={22} className="text-blue-500" />} label="Pase Digital" onClick={() => navigate('/qr')} />
          <ActionButton icon={<CreditCard size={22} className="text-sky-500" />} label="Tarjetas" onClick={() => navigate('/tarjetas')} />
          <ActionButton icon={<Sparkles size={22} className="text-purple-500" />} label="Premium" onClick={() => navigate('/servicios-extra')} />
        </StaggerList>
      </Reveal>

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
              variants={useVariants(scaleIn)}
              initial="hidden"
              animate="show"
              exit="exit"
              className="relative z-10 w-full max-w-sm"
            >
              <div className="bg-slate-900 dark:bg-black rounded-[3rem] p-10 relative z-10 text-center border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/20 blur-[100px] rounded-full" />

                <motion.button
                  {...useInteraction(tapOnly)}
                  onClick={() => setShowQR(false)}
                  className="absolute top-6 right-6 p-2 text-white/20 hover:text-white hover:bg-white/10 rounded-full transition-all"
                >
                  <X size={20} />
                </motion.button>

                <h3 className="font-headline text-3xl font-black mb-1 text-white italic uppercase tracking-tighter">Luxury Pass</h3>
                <p className="text-white/30 text-[9px] font-black uppercase tracking-[0.3em] mb-8">{user?.name}</p>

                <motion.div
                  variants={useVariants(popIn)}
                  initial="hidden"
                  animate="show"
                  className="bg-white p-5 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,123,255,0.2)] mb-8 inline-block relative group transition-transform hover:scale-105"
                >
                  <QrCode size={180} className="text-slate-900" />
                  <div className="absolute inset-0 border-[3px] border-primary/20 rounded-[2.5rem]" />
                </motion.div>

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
});

// Memoizamos ActionButton para evitar re-renders
const ActionButton = memo(function ActionButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <StaggerItem>
      <Pressable
        onClick={onClick}
        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-primary/20 p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors hover:bg-primary/5 group shadow-sm"
      >
        <div className="group-hover:scale-110 transition-transform duration-200">{icon}</div>
        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-tight text-center">{label}</span>
      </Pressable>
    </StaggerItem>
  );
});

export default Dashboard;
