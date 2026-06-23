import React, { useState, useEffect } from 'react';
import { History, Calendar, Clock, Car, MapPin } from 'lucide-react';

import api from '../../services/api';
import {
    motion,
    Reveal,
    StaggerList,
    StaggerItem,
    Pressable,
    Skeleton,
    popIn,
    useVariants,
} from '../lib/motion';

export default function HistorialEmpleado({ user }: { user: any }) {
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const popVariants = useVariants(popIn);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await api.get("/luxury/employee/history");
                const data = res.data?.data ?? res.data;
                setHistory(data);
            } catch (e) {
                console.error('Error fetching employee history');
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, [user.id]);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-4 pb-24">
            <Reveal className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-primary/10 dark:bg-blue-500/20 rounded-xl flex items-center justify-center text-primary dark:text-blue-400">
                    <History size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Mi Historial</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Lavados realizados por vos</p>
                </div>
            </Reveal>

            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={i}
                            className="bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 transition-colors"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="w-9 h-9 rounded-full" />
                                    <div className="space-y-2">
                                        <Skeleton className="w-24 h-3.5 rounded-full" />
                                        <Skeleton className="w-32 h-2.5 rounded-full" />
                                    </div>
                                </div>
                                <Skeleton className="w-16 h-5 rounded-full" />
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <Skeleton className="h-12 rounded-2xl" />
                                <Skeleton className="h-12 rounded-2xl" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : history.length === 0 ? (
                <Reveal onView className="p-10 text-center bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 transition-colors">
                    <History size={40} className="text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-500">Aún no registraste lavados.</p>
                </Reveal>
            ) : (
                <StaggerList className="space-y-3">
                    {history.map((h) => (
                        <StaggerItem key={h.id}>
                            <Pressable
                                asDiv
                                tapOnly
                                className="w-full text-left bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm transition-colors hover:shadow-md"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center font-black text-slate-500 dark:text-slate-400 text-sm">
                                            {h.client_name[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900 dark:text-white">{h.client_name}</p>
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                                <Calendar size={10} />
                                                {formatDate(h.booking_date)}
                                                <span className="text-slate-200 dark:text-slate-700">•</span>
                                                <Clock size={10} />
                                                {formatTime(h.booking_date)}
                                            </div>
                                        </div>
                                    </div>
                                    <motion.div
                                        variants={popVariants}
                                        initial="hidden"
                                        animate="show"
                                        className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/10"
                                    >
                                        {h.status}
                                    </motion.div>
                                </div>

                                {/* Client & Car info section */}
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl flex items-center gap-2 border border-slate-100 dark:border-slate-800 transition-colors">
                                        <Car size={14} className="text-primary dark:text-blue-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">Vehículo</p>
                                            <p className="text-[11px] font-black text-slate-900 dark:text-slate-200 truncate">{h.vehicle_model || 'Standard'}</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl flex items-center gap-2 border border-slate-100 dark:border-slate-800 transition-colors">
                                        <MapPin size={14} className="text-primary dark:text-blue-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">Ubicación</p>
                                            <p className="text-[11px] font-black text-slate-900 dark:text-slate-200 truncate">{h.location}</p>
                                        </div>
                                    </div>
                                </div>
                            </Pressable>
                        </StaggerItem>
                    ))}
                </StaggerList>
            )}
        </div>
    );
}
