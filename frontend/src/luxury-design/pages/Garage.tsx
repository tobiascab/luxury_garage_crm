import React from 'react';
import {
  motion,
  Reveal,
  StaggerList,
  StaggerItem,
  AnimatedNumber,
  Pressable,
  scaleIn,
  popIn,
  useVariants,
  useInteraction,
  hoverable,
} from '../lib/motion';
import { PlusCircle, MoreVertical, Gauge, Zap, ArrowRight, Droplets } from 'lucide-react';

export default function Garage() {
  // Variante resuelta acá: useVariants es un hook y dentro del JSX condicional su cantidad
  // cambia entre renders, lo que hace que React descarte la pantalla.
  const v_popIn = useVariants(popIn);
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      className="space-y-4 pb-24"
    >
      {/* Header */}
      <Reveal className="flex items-end justify-between px-1 pt-2">
        <div>
          <div className="inline-block px-3 py-1 bg-primary/10 dark:bg-blue-500/10 text-primary dark:text-blue-400 rounded-full text-[10px] font-black tracking-widest uppercase mb-3 border border-primary/20 dark:border-blue-500/30 transition-colors">
            GESTIÓN DE GARAJE
          </div>
          <h1 className="font-headline text-3xl font-black tracking-tighter text-slate-900 dark:text-white transition-colors uppercase italic">
            Tu <span className="text-primary dark:text-blue-400">Lavadero Digital</span>
          </h1>
        </div>
        <div className="text-right pb-1">
          <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 dark:text-slate-500 uppercase">Flota</p>
          <AnimatedNumber
            value={2}
            prefix="0"
            duration={0.7}
            className="text-3xl font-headline font-black text-primary dark:text-blue-400 italic"
          />
        </div>
      </Reveal>

      {/* Featured Car Card */}
      <Reveal variant={scaleIn} {...useInteraction(hoverable)} className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-400 opacity-20 blur-xl group-hover:opacity-30 rounded-[2.5rem] transition"></div>
        <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 shadow-2xl h-72 border border-white/5 group">
          <img
            src="https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?auto=format&fit=crop&q=80&w=1000"
            alt="Audi RS6"
            className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:scale-110 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

          <div className="absolute top-6 left-6 flex gap-2">
            <motion.span
              variants={v_popIn}
              initial="hidden"
              animate="show"
              className="bg-primary/80 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border border-white/10 shadow-lg"
            >
              LISTO
            </motion.span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-between items-end">
            <div>
              <p className="text-white/40 font-black text-[9px] tracking-[0.3em] uppercase mb-1.5 italic">2024 Performance Edition</p>
              <h2 className="text-white font-headline text-3xl font-black tracking-tighter italic uppercase">Audi RS6 Avant</h2>
            </div>
            <div className="flex items-center gap-5 text-white/90">
              <div className="flex flex-col items-center">
                <Gauge size={20} className="text-secondary mb-1" />
                <span className="text-[9px] font-black tracking-widest uppercase">305 KM/H</span>
              </div>
              <div className="flex flex-col items-center">
                <Zap size={20} className="text-secondary mb-1" />
                <span className="text-[9px] font-black tracking-widest uppercase">621 HP</span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Stats Quick Bar */}
      <Reveal onView className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:bg-white dark:hover:bg-slate-900/60">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <p className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase italic">Próximo Lavado</p>
            <p className="font-headline font-black text-lg mt-1 text-slate-900 dark:text-white tracking-tighter">
              <AnimatedNumber value={1250} currency suffix=" KM" className="inline" />
            </p>
          </div>
          <div className="h-10 w-px bg-slate-100 dark:bg-slate-800 mx-4" />
          <div className="flex-1">
            <p className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase italic">Neumáticos</p>
            <p className="font-headline font-black text-lg mt-1 text-emerald-600 dark:text-emerald-400 tracking-tighter">ÓPTIMA</p>
          </div>
          <Pressable className="flex items-center gap-2 bg-primary dark:bg-blue-600 px-6 py-3.5 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 dark:shadow-blue-500/20">
            DETALLES <ArrowRight size={14} />
          </Pressable>
        </div>
      </Reveal>

      {/* Secondary Vehicle */}
      <Reveal onView className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm transition-all">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center border border-secondary/20">
              <Droplets size={20} className="text-secondary" />
            </div>
            <span className="text-[10px] font-black tracking-[0.2em] text-secondary uppercase italic">REQUIERE ATENCIÓN</span>
          </div>
          <motion.button {...useInteraction(hoverable)} className="text-slate-300 dark:text-slate-600 hover:text-primary transition-colors">
            <MoreVertical size={22} />
          </motion.button>
        </div>

        <div className="flex items-center gap-5 mb-6 px-1">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-800 shadow-lg shrink-0">
            <img
              src="https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&q=80&w=1000"
              alt="Porsche 911 GT3"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-slate-400 dark:text-slate-500 font-bold text-[10px] tracking-widest uppercase mb-1">992 Generation</p>
            <h2 className="text-slate-900 dark:text-white font-headline text-2xl font-black tracking-tighter uppercase italic">Porsche 911 GT3</h2>
          </div>
        </div>

        <StaggerList onView className="grid grid-cols-2 gap-3 mb-6">
          <StaggerItem className="p-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Combustible</p>
            <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1 uppercase">
              <AnimatedNumber value={420} currency suffix=" KM" className="inline" /> <span className="text-[10px] text-slate-400 ml-1">Límite</span>
            </p>
          </StaggerItem>
          <StaggerItem className="p-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Motor</p>
            <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1 uppercase">
              <AnimatedNumber value={95} suffix="°C" className="inline" /> <span className="text-[10px] text-emerald-500 ml-1">Estable</span>
            </p>
          </StaggerItem>
        </StaggerList>

        <Pressable className="w-full py-5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black rounded-2xl text-[11px] uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 italic">
          <Droplets size={16} />
          PROGRAMAR LAVADO PREMIUM
        </Pressable>
      </Reveal>

      {/* Add Vehicle Form */}
      <Reveal onView className="bg-white/50 dark:bg-slate-900/30 rounded-[3rem] p-8 border-2 border-dashed border-slate-100 dark:border-slate-800 transition-all hover:border-primary/20 group">
        <div className="mb-8 text-center">
          <h3 className="font-headline text-2xl font-black mb-1 text-slate-900 dark:text-white transition-colors uppercase italic tracking-tighter">Amplía tu Flota</h3>
          <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Garaje de lujo ilimitado</p>
        </div>
        <form className="space-y-4">
          <StaggerList onView className="grid grid-cols-2 gap-4">
            {[
              { label: 'Marca', placeholder: 'LAMBORGHINI' },
              { label: 'Modelo', placeholder: 'HURACÁN' },
              { label: 'Año', placeholder: '2024' },
              { label: 'Placa', placeholder: 'LUX-001' },
            ].map(({ label, placeholder }) => (
              <StaggerItem key={label}>
                <label className="block text-[9px] font-black tracking-[0.3em] text-primary dark:text-blue-400 uppercase mb-2 px-1">{label}</label>
                <input
                  type="text"
                  placeholder={placeholder}
                  className="w-full bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50 rounded-2xl px-5 py-4 text-xs font-black dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-primary/20 transition-all uppercase tracking-widest"
                />
              </StaggerItem>
            ))}
          </StaggerList>
          <Pressable
            type="button"
            className="w-full py-5 mt-4 bg-primary dark:bg-blue-600 text-white rounded-2xl font-black tracking-[0.3em] uppercase text-[10px] shadow-2xl flex items-center justify-center gap-3 overflow-hidden relative group"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <PlusCircle size={18} />
            REGISTRAR MÁQUINA
          </Pressable>
        </form>
      </Reveal>
    </motion.div>
  );
}
