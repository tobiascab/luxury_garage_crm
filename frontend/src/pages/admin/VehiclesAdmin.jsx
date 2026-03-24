import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Car, Search, Filter,
  User, CreditCard, Hash,
  Palette, Calendar, FileText,
  ChevronRight, ExternalLink,
  MoreVertical, Loader2, ArrowUpRight,
  Info
} from 'lucide-react';
import api from '../../services/api';

export default function VehiclesAdmin() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadVehicles(); }, []);

  const loadVehicles = async () => {
    try {
      const r = await api.get('/vehicles/all');
      setVehicles(r.data.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const filtered = search ? vehicles.filter(v =>
    `${v.brand} ${v.model} ${v.licensePlate} ${v.color}`.toLowerCase().includes(search.toLowerCase()) ||
    `${v.user?.firstName} ${v.user?.lastName}`.toLowerCase().includes(search.toLowerCase())
  ) : vehicles;

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escaneando Parque Automotor...</p>
    </div>
  );

  return (
    <div className="page-content">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-white shadow-xl shadow-slate-900/20">
              <Car size={24} />
            </div>
            Vehículos Registrados
          </h1>
          <p>Base de datos centralizada de flota de clientes</p>
        </div>
      </header>

      {/* Search & Stats Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[20px] font-black italic text-slate-900 dark:text-white leading-none tracking-tighter">{vehicles.length}</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Total Unidades</span>
          </div>
          <div className="w-px h-8 bg-slate-200 dark:bg-white/10" />
          <div className="flex flex-col">
            <span className="text-[20px] font-black italic text-emerald-500 leading-none tracking-tighter">
              {new Set(vehicles.map(v => v.brand)).size}
            </span>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Marcas Únicas</span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="admin-search-wrapper flex-1 md:min-w-[400px]">
            <Search className="admin-search-icon" size={16} />
            <input
              className="admin-search-input"
              placeholder="Buscar por marca, modelo, placa o cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-400 flex items-center justify-center transition-all hover:text-primary shadow-sm">
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="admin-card !p-0 overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none">
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Vehículo</th>
                <th>Chapa / Matrícula</th>
                <th>Año / Modelo</th>
                <th>Color Ext.</th>
                <th>Propietario / Socio</th>
                <th>Estado / Notas</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((v, i) => (
                  <motion.tr
                    key={v.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.01 }}
                    className="group"
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all transform group-hover:scale-110 duration-300">
                          <Car size={18} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 dark:text-white uppercase italic tracking-tight">
                            {v.brand} {v.model}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Luxury Fleet</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="inline-flex items-center px-3 py-1 bg-slate-950 rounded-lg border-x-2 border-indigo-500 shadow-lg">
                        <span className="text-white font-black italic tracking-[0.15em] text-[11px]">
                          {v.licensePlate}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-slate-300" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{v.year || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Palette size={12} className="text-slate-300" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">{v.color || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400">
                          <User size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase letter-spacing-tight leading-none">
                            {v.user ? `${v.user.firstName} ${v.user.lastName}` : 'Anónimo'}
                          </span>
                          <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] mt-1 italic">Cliente VIP</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {v.notes ? (
                        <div className="flex items-start gap-2 max-w-[200px] py-1 px-3 bg-amber-500/5 rounded-xl border border-amber-500/10 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                          <FileText size={10} className="mt-0.5 shrink-0" />
                          <span className="text-[10px] font-bold line-clamp-1 italic">
                            {v.notes}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">—</span>
                      )}
                    </td>
                    <td>
                      <button className="p-2 text-slate-300 hover:text-primary transition-colors">
                        <ExternalLink size={16} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
              <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300">
                <Search size={40} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No se encontraron vehículos vinculados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
