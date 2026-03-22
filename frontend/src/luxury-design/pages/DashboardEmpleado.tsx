import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ScanLine, CheckCircle2, Droplets, Calendar, TrendingUp, Users } from 'lucide-react';
import api from '../../services/api';

interface Stats {
    totalToday: number;
    totalMonth: number;
}


export default function DashboardEmpleado({ user }: { user: any }) {
    const navigate = useNavigate();
    const [stats, setStats] = useState<Stats>({ totalToday: 0, totalMonth: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/luxury/employee/stats');
                setStats(res.data.data);
            } catch (e) {
                console.error('Error fetching employee stats');
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, []);


    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 pb-24 max-w-lg mx-auto"
        >
            {/* Greeting */}
            <div className="flex items-center justify-between px-1 pt-2">
                <div>
                    <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white transition-colors uppercase italic">Hola, {user.name.split(' ')[0]} 👋</h2>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Centro de Operaciones</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-primary dark:text-blue-400 group hover:scale-105 transition-all">
                    <TrendingUp size={28} className="group-hover:translate-y-[-2px] group-hover:translate-x-[2px] transition-transform" />
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <StatCard
                    label="Lavados Hoy"
                    value={stats.totalToday.toString()}
                    icon={<Droplets size={22} />}
                    color="text-blue-600 dark:text-blue-400"
                    bgColor="bg-blue-50/50 dark:bg-blue-500/10"
                    accentColor="bg-blue-600 dark:bg-blue-400"
                />
                <StatCard
                    label="Este Mes"
                    value={stats.totalMonth.toString()}
                    icon={<Calendar size={22} />}
                    color="text-emerald-600 dark:text-emerald-400"
                    bgColor="bg-emerald-50/50 dark:bg-emerald-500/10"
                    accentColor="bg-emerald-600 dark:bg-emerald-400"
                />
            </div>

            {/* Main Action Banner */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-400 dark:from-blue-600 dark:to-cyan-400 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/scan')}
                    className="relative w-full overflow-hidden bg-primary dark:bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl flex flex-col items-center text-center gap-4 group transition-all"
                >
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-1000" />
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-secondary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />

                    <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-[1.75rem] flex items-center justify-center border border-white/30 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <ScanLine size={40} className="text-white animate-pulse" />
                    </div>

                    <div>
                        <h3 className="text-2xl font-black italic tracking-tighter uppercase">Listo para Escanear</h3>
                        <p className="text-white/80 text-xs mt-1.5 font-medium max-w-[200px] mx-auto leading-relaxed">Presioná aquí para iniciar la cámara y registrar un servicio</p>
                    </div>

                    <div className="mt-2 bg-white text-primary dark:text-blue-700 px-6 py-2 rounded-full text-[10px] font-black tracking-[0.2em] shadow-lg group-hover:bg-secondary group-hover:text-slate-900 transition-colors duration-300">
                        NUEVO SERVICIO
                    </div>
                </motion.button>
            </div>

            {/* Workplace Info */}
            <div className="bg-white/80 dark:bg-slate-900/40 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex items-center gap-5 shadow-sm transition-colors">
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
                    <Users size={24} className="text-slate-500 dark:text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">Ubicación Actual</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate mt-0.5">Luxury Garage HQ — Central</p>
                </div>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </div>
        </motion.div>
    );
}

function StatCard({ label, value, icon, color, bgColor, accentColor }: any) {
    return (
        <div className={`p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-lg bg-white dark:bg-slate-900/40 group overflow-hidden relative`}>
            {/* Background design element */}
            <div className={`absolute top-0 right-0 w-12 h-12 ${accentColor} opacity-[0.03] rounded-full blur-xl -translate-y-1/2 translate-x-1/2`} />

            <div className={`w-10 h-10 rounded-[1rem] flex items-center justify-center mb-3 ${color} border border-current/10 ${bgColor} group-hover:scale-110 transition-transform duration-300`}>
                {React.cloneElement(icon as React.ReactElement, { size: 20, strokeWidth: 2.5 })}
            </div>

            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors mb-1">{label}</p>
            <div className="flex items-baseline gap-1">
                <p className={`text-2xl font-black ${color} tracking-tight`}>{value}</p>
                <div className={`w-1 h-1 rounded-full ${accentColor} opacity-40`} />
            </div>
        </div>
    );
}
