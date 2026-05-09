import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, Calendar, MapPin, User, ScanLine, Car, ChevronRight, History } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function WashScans() {
    const [scans, setScans] = useState([]);
    const [stats, setStats] = useState({ todayScans: 0, monthScans: 0, totalScans: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Stats
    useEffect(() => {
        api.get('/scans/stats').then(res => {
            setStats(res.data.data);
        }).catch(console.error);
    }, []);

    // Data
    useEffect(() => {
        loadScans(false);
    }, [page, search]);

    const loadScans = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const res = await api.get('/scans', {
                params: { page, limit: 15, search: search.length > 2 ? search : undefined }
            });
            setScans(res.data.data);
            setTotalPages(res.data.pagination.pages);
        } catch (err) {
            toast.error('Error al cargar historial de escaneos');
        }
        setLoading(false);
    };

    return (
        <div className="max-w-7xl mx-auto pb-24">
            {/* Header */}
            <div className="mb-10 p-8 rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <ScanLine className="text-primary" size={24} />
                            <h1 className="font-headline font-black text-3xl tracking-tight">Escaneos de Lavado</h1>
                        </div>
                        <p className="text-slate-400 font-medium">Historial completo de validaciones QR</p>
                    </div>

                    <div className="flex gap-4">
                        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center min-w-[120px]">
                            <p className="text-2xl font-black text-white leading-none">{stats.todayScans}</p>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">Hoy</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center min-w-[120px]">
                            <p className="text-2xl font-black text-primary leading-none">{stats.monthScans}</p>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">Mes</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente o empleado..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold focus:outline-none focus:border-primary transition-colors"
                    />
                </div>
            </div>

            {/* Data */}
            <div className="admin-card !p-0 overflow-hidden shadow-xl">
                <div className="table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th className="pl-10">Fecha / Hora</th>
                                <th>Cliente</th>
                                <th>Vehículo</th>
                                <th>Empleado / Validador</th>
                                <th className="pr-10 text-right">Detalle</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && scans.length === 0 ? (
                                <tr>
                                    <td colSpan="5">
                                        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                            <Loader2 className="animate-spin mb-4" size={32} />
                                            <p className="font-medium text-sm">Cargando escaneos...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : scans.length === 0 ? (
                                <tr>
                                    <td colSpan="5">
                                        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                            <ScanLine size={48} className="text-slate-400 dark:text-slate-600 mb-4" />
                                            <p className="font-bold text-slate-500 dark:text-slate-400">Sin registros</p>
                                            <p className="text-xs mt-1">No se encontraron escaneos de lavados.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                scans.map((scan, i) => (
                                    <tr key={scan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="pl-10">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 dark:text-white">
                                                    {new Date(scan.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                                <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <History size={10} /> {new Date(scan.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-primary text-xs">
                                                    {scan.user?.firstName?.[0]}{scan.user?.lastName?.[0]}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white">{scan.user?.firstName} {scan.user?.lastName}</p>
                                                    <p className="text-[10px] text-slate-500">{scan.user?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {scan.vehicle ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                                        <Car size={14} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{scan.vehicle.model}</p>
                                                        <p className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 inline-block px-1.5 rounded">{scan.vehicle.licensePlate}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Genérico</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <User size={14} className="text-emerald-500" />
                                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                    {scan.serviceRecord?.employee ?
                                                        `${scan.serviceRecord.employee.firstName} ${scan.serviceRecord.employee.lastName}` :
                                                        'Sistema'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="pr-10 text-right">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 text-[10px] font-bold tracking-wider uppercase border border-emerald-100 dark:border-emerald-500/20">
                                                COMPLETADO
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-opacity"
                        >
                            Anterior
                        </button>
                        <p className="text-xs font-bold text-slate-400">Página {page} de {totalPages}</p>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-opacity"
                        >
                            Siguiente
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
