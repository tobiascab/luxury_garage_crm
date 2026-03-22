import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Clock, CheckCircle2, X, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const services = [
    {
        id: 1, icon: '✨', name: 'Tratamiento Cerámico',
        desc: 'Protección de larga duración. Hidrofóbico y brillante.',
        price: 150000, duration: '3 horas', tag: 'Premium',
        tagColor: 'bg-primary dark:bg-blue-600 text-white',
    },
    {
        id: 2, icon: '🧼', name: 'Detailing Interior Completo',
        desc: 'Limpieza profunda de tapizados, plásticos y vidrios interiores.',
        price: 80000, duration: '2 horas', tag: 'Popular',
        tagColor: 'bg-secondary text-slate-900',
    },
    {
        id: 3, icon: '💡', name: 'Pulido de Ópticas',
        desc: 'Recupera la transparencia de tus faros con pulido profesional.',
        price: 45000, duration: '1 hora', tag: null,
        tagColor: '',
    },
    {
        id: 4, icon: '🌿', name: 'Eliminación de Olores',
        desc: 'Ozonización y difusión aromática premium para el habitáculo.',
        price: 35000, duration: '45 min', tag: null,
        tagColor: '',
    },
    {
        id: 5, icon: '🐾', name: 'Limpieza para Mascotas',
        desc: 'Remoción especial de pelos y desinfección pet-friendly.',
        price: 40000, duration: '1 hora', tag: null,
        tagColor: '',
    },
    {
        id: 6, icon: '🔧', name: 'Limpieza de Motor',
        desc: 'Desengrase y limpieza exterior del bloque motor con desengrasante neutro.',
        price: 55000, duration: '1.5 horas', tag: null,
        tagColor: '',
    },
];

export default function ServiciosExtra() {
    const navigate = useNavigate();
    const [selected, setSelected] = useState<typeof services[0] | null>(null);
    const [booked, setBooked] = useState(false);

    const handleBook = () => {
        setBooked(true);
        setTimeout(() => {
            setSelected(null);
            setBooked(false);
            navigate('/booking');
        }, 2000);
    };

    const formatGs = (n: number) => `₲ ${n.toLocaleString('es-PY')}`;

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((service, i) => (
                    <motion.button
                        key={service.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => setSelected(service)}
                        className="bg-white dark:bg-slate-900/40 rounded-[1.5rem] p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:border-primary/20 dark:hover:border-blue-500/20 hover:shadow-md transition-all text-left active:scale-[0.98] group"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{service.icon}</span>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-sm text-slate-900 dark:text-white">{service.name}</p>
                                        {service.tag && (
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${service.tagColor}`}>{service.tag}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <Clock size={10} className="text-slate-400 dark:text-slate-500" />
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{service.duration}</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-primary dark:text-blue-400 font-black text-sm shrink-0">{formatGs(service.price)}</p>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{service.desc}</p>
                        <div className="mt-3 flex justify-end">
                            <span className="text-[10px] font-bold text-primary dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">
                                Reservar →
                            </span>
                        </div>
                    </motion.button>
                ))}
            </div>

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
                                            <span className="text-4xl">{selected.icon}</span>
                                            <div>
                                                <p className="font-headline font-black text-lg text-slate-900 dark:text-white">{selected.name}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <Clock size={11} className="text-slate-400 dark:text-slate-500" />
                                                    <span className="text-[11px] text-slate-400 dark:text-slate-500">{selected.duration}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelected(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                                            <X size={16} className="text-slate-600 dark:text-slate-400" />
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">{selected.desc}</p>
                                    <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl mb-6 border border-slate-100 dark:border-slate-700">
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Precio del servicio</span>
                                        <span className="font-black text-lg text-primary dark:text-blue-400">{formatGs(selected.price)}</span>
                                    </div>
                                    <button
                                        onClick={handleBook}
                                        className="w-full py-4 bg-primary dark:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Calendar size={18} />
                                        Solicitar este Servicio
                                    </button>
                                </>
                            ) : (
                                <div className="text-center py-6">
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle2 size={40} className="text-emerald-600 dark:text-emerald-400" />
                                    </motion.div>
                                    <h3 className="font-headline text-2xl font-black mb-2 dark:text-white">¡Solicitud enviada!</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Te redirigimos a tus reservas para terminar de elegir fecha y hora.</p>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
