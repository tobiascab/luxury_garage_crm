import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export default function StatCard({ icon, title, value, color }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-md p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5 flex flex-col justify-between h-32 transition-shadow hover:shadow-md group"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors`} style={{ backgroundColor: `${color}10`, borderColor: `${color}20`, color: color }}>
        <span className="text-xl group-hover:scale-110 transition-transform">{icon}</span>
      </div>
      <div>
        <span className="text-2xl font-headline font-black text-slate-900 dark:text-white block leading-tight tracking-tighter">
          {value}
        </span>
        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 uppercase">{title}</p>
      </div>
    </motion.div>
  );
}
