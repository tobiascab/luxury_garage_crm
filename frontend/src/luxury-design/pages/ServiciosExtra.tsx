import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Clock, CheckCircle2, X, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface ServiciosExtraProps {
    user: any;
}

export default function ServiciosExtra({ user }: ServiciosExtraProps) {
    const navigate = useNavigate();
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any>(null);
    const [booking, setBooking] = useState(false);
    const [booked, setBooked] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        api.get('/services')
            .then(res => {
                const list = Array.isArray(res.data?.data) ? res.data.data : [];
                setServices(list);
            })
            .catch(() => setServices([]))
            .finally(() => setLoading(false));
    }, []);

    const formatGs = (n: number) => `₲ ${Number(n).toLocaleString('es-PY')}`;

    const handleBook = async () => {
        if (!selected) return;

        // Validate user has a vehicle
        const vehicleId = user?.vehicles?.[0]?.id;
        if (!vehicleId) {
            setErrorMsg('No tenés un vehículo registrado. Agregá uno desde tu perfil primero.');
            return;
        }

        setBooking(true);
        setErrorMsg('');
        try {
            const now = new Date();
            const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
            const dateOnly = startTime.toISOString().split('T')[0];
            const startTimeStr = `${dateOnly}T09:00:00`;

            await api.post('/appointments', {
                vehicleId,
                serviceId: selected.id,
                date: dateOnly,
                startTime: startTimeStr,
            });

            setBooked(true);
            setTimeout(() => {
                setSelected(null);
                setBooked(false);
                navigate('/booking');
            }, 2000);
        } catch (e: any) {
            setErrorMsg(e?.response?.data?.message || 'Error al crear la reserva. Intentá nuevamente.');
        } finally {
            setBooking(false);
        }
    };

    // Service icon map based on keywords in name
    const getIcon = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('cerám') || n.includes('ceramic')) return '✨';
        if (n.includes('interior') || n.includes('detailing')) return '🧼';
        if (n.includes('óptic') || n.includes('faro') || n.includes('luz')) return '💡';
        if (n.includes('olor') || n.includes('ozon')) return '🌿';
        if (n.includes('mascota') || n.includes('pet')) return '🐾';
        if (n.includes('motor') || n.includes('mecánic')) return '🔧';
        if (n.includes('lavado') || n.includes('wash')) return '💧';
        if (n.includes('pulid') || n.includes('polish')) return '✨';
        return '🚗';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6 pb-24"
        >
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 dark:bg-blue-500/10 text-primary dark:text-blue-400 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3 border border-primary/20 dark:border-blue-500/30">
                    <Sparkles size={12} /> Servicios Exclusivos
                </div>
                <h1 className="font-headline text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white transition-colors">
                    Servicios Extra
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Más allá del lavado. Cuidado premium para tu vehículo.</p>
            </div>

            {/* Services Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-16 gap-3">
                    <Loader2 size={24} className="animate-spin text-primary dark:text-blue-400" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando servicios...</span>
                </div>
            ) : services.length === 0 ? (
                <div className="text-center py-16">
                    <Sparkles size={32} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 dark:text-slate-500 font-bold">No hay servicios disponibles</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {services.map((service, i) => (
                        <motion.button
                            key={service.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => { setSelected(service); setErrorMsg(''); setBooked(false); }}
                            className="bg-white dark:bg-slate-900/40 rounded-[1.5rem] p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:border-primary/20 dark:hover:border-blue-500/20 hover:shadow-md transition-all text-left active:scale-[0.98] group"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{getIcon(service.name)}</span>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white">{service.name}</p>
                                        </div>
                                        {service.durationMinutes && (
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Clock size={10} className="text-slate-400 dark:text-slate-500" />
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500">{service.durationMinutes} min</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {service.price && (
                                    <p className="text-primary dark:text-blue-400 font-black text-sm shrink-0">{formatGs(service.price)}</p>
                                )}
                            </div>
                            {service.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{service.description}</p>
                            )}
                            <div className="mt-3 flex justify-end">
                                <span className="text-[10px] font-bold text-primary dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">
                                    Reservar →
                                </span>
                            </div>
                        </motion.button>
                    ))}
                </div>
            )}

            {/* Service Detail Modal */}
            <AnimatePresence>
                {selected && (
                    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[200] flex items-end md:items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, y: 60 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 60 }}
                            className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 transition-colors"
                        >
                            {!booked ? (
                                <>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-3">
                                            <span className="text-4xl">{getIcon(selected.name)}</span>
                                            <div>
                                                <p className="font-headline font-black text-lg text-slate-900 dark:text-white">{selected.name}</p>
                                                {selected.durationMinutes && (
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <Clock size={11} className="text-slate-400 dark:text-slate-500" />
                                                        <span className="text-[11px] text-slate-400 dark:text-slate-500">{selected.durationMinutes} min</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={() => { setSelected(null); setErrorMsg(''); }} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                                            <X size={16} className="text-slate-600 dark:text-slate-400" />
                                        </button>
                                    </div>

                                    {selected.description && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">{selected.description}</p>
                                    )}

                                    {selected.price && (
                                        <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl mb-4 border border-slate-100 dark:border-slate-700">
                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Precio del servicio</span>
                                            <span className="font-black text-lg text-primary dark:text-blue-400">{formatGs(selected.price)}</span>
                                        </div>
                                    )}

                                    {/* Error message */}
                                    {errorMsg && (
                                        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl mb-4">
                                            <AlertCircle size={16} className="text-red-500 shrink-0" />
                                            <p className="text-xs text-red-700 dark:text-red-300 font-medium">{errorMsg}</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleBook}
                                        disabled={booking}
                                        className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                    >
                                        {booking
                                            ? <><Loader2 size={18} className="animate-spin" /> Agendando...</>
                                            : <><Calendar size={18} /> Solicitar este Servicio</>
                                        }
                                    </button>
                                    <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-3">
                                        Se agendará para mañana a las 9:00hs. Podés ajustar el horario desde Reservas.
                                    </p>
                                </>
                            ) : (
                                <div className="text-center py-6">
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle2 size={40} className="text-emerald-600 dark:text-emerald-400" />
                                    </motion.div>
                                    <h3 className="font-headline text-2xl font-black mb-2 dark:text-white">¡Reserva creada!</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Te redirigimos a tus reservas para ver los detalles.</p>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
