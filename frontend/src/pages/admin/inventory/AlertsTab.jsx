import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Wallet, Boxes, AlertTriangle, CircleSlash, Activity,
  RefreshCcw, Loader2, PackageX, CalendarClock, ShoppingCart,
  CheckCircle2, ArrowUpRight,
} from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import AnimatedNumber from '../../../components/AnimatedNumber';

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

const daysUntil = (d) => {
  if (!d) return null;
  const diff = Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
};

function KpiCard({ icon, title, value, tone = 'indigo' }) {
  return (
    <div
      className={`relative overflow-hidden admin-tint-${tone} bg-white dark:bg-slate-900/50 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 flex flex-col justify-between h-28 transition-all hover:shadow-md`}
    >
      <div className={`admin-itile admin-itile-${tone} w-10 h-10`}>
        <span className="text-white">{icon}</span>
      </div>
      <div>
        <span className="text-xl font-black text-slate-900 dark:text-white block leading-tight tracking-tight">{value}</span>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">{title}</p>
      </div>
    </div>
  );
}

export default function AlertsTab() {
  const reduceMotion = useReducedMotion();
  const tapSmall = reduceMotion ? undefined : { scale: 0.9 };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    setError(false);
    try {
      const res = await api.get('/inventory/summary', { _noCache: true });
      setData(res.data.data || null);
    } catch (e) {
      setError(true);
      toast.error(e.response?.data?.message || 'No se pudo cargar el resumen del inventario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const refresh = () => { setLoading(true); loadData(); };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-10 text-center text-sm text-slate-400">
        <Loader2 size={20} className="animate-spin inline mr-2" /> Cargando resumen…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-12 text-center">
        <p className="text-3xl mb-2">⚠️</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Error al cargar</p>
        <p className="text-xs text-slate-400 mt-1">No se pudo obtener el resumen del inventario.</p>
        <motion.button onClick={refresh} whileTap={tapSmall} className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 transition-colors">
          Reintentar
        </motion.button>
      </div>
    );
  }

  const {
    totalItems = 0,
    inventoryValueGs = 0,
    lowStock = 0,
    outOfStock = 0,
    consumedThisMonth = 0,
    lowStockItems = [],
    expiringSoon = [],
  } = data;

  const noAlerts = (lowStockItems?.length || 0) === 0 && (expiringSoon?.length || 0) === 0;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Resumen del inventario</h2>
        <motion.button
          onClick={refresh}
          whileTap={tapSmall}
          title="Actualizar"
          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors"
        >
          <RefreshCcw size={16} />
        </motion.button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard icon={<Wallet size={18} />} title="Valor del inventario" value={<AnimatedNumber value={inventoryValueGs} format="gs" />} tone="emerald" />
        <KpiCard icon={<Boxes size={18} />} title="Total insumos" value={<AnimatedNumber value={totalItems} format="int" />} tone="indigo" />
        <KpiCard icon={<AlertTriangle size={18} />} title="Bajo stock" value={<AnimatedNumber value={lowStock} format="int" />} tone="amber" />
        <KpiCard icon={<CircleSlash size={18} />} title="Sin stock" value={<AnimatedNumber value={outOfStock} format="int" />} tone="rose" />
        <KpiCard icon={<Activity size={18} />} title="Consumos del mes" value={<AnimatedNumber value={consumedThisMonth} format="int" />} tone="sky" />
      </div>

      {noAlerts ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-12 text-center">
          <span className="admin-itile admin-itile-emerald inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-3">
            <CheckCircle2 size={26} className="text-white" />
          </span>
          <p className="text-base font-semibold text-slate-900 dark:text-white">Todo en orden ✓</p>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            No hay insumos por reponer ni productos próximos a vencer. El inventario está saludable.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Reposición necesaria */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 dark:border-white/5">
              <span className="admin-itile admin-itile-amber w-8 h-8">
                <ShoppingCart size={16} className="text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Reposición necesaria</h3>
                <p className="text-xs text-slate-400">Insumos en o bajo el nivel mínimo</p>
              </div>
              <span className="text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-md">
                {lowStockItems.length}
              </span>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Nada por reponer.</div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-white/5">
                {lowStockItems.map((it) => {
                  const isOut = (it.currentStock ?? 0) <= 0;
                  const toBuy = it.maxStock ? Math.max(it.maxStock - (it.currentStock || 0), 0) : null;
                  return (
                    <div key={it.id} className="flex items-center gap-3 px-5 py-3.5">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isOut ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10' : 'bg-amber-50 text-amber-500 dark:bg-amber-500/10'}`}>
                        {isOut ? <PackageX size={16} /> : <AlertTriangle size={16} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{it.name}</p>
                        <p className="text-xs text-slate-400">
                          Stock: <span className={isOut ? 'text-rose-500 font-medium' : 'text-slate-500 dark:text-slate-300 font-medium'}>{it.currentStock} {it.unit}</span>
                          {' · '}mínimo {it.minStockAlert}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${isOut ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                          {isOut ? 'Sin stock' : 'Stock bajo'}
                        </span>
                        {toBuy != null && toBuy > 0 && (
                          <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-end gap-0.5">
                            <ArrowUpRight size={11} /> Comprar {toBuy} {it.unit}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Por vencer */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 dark:border-white/5">
              <span className="admin-itile admin-itile-violet w-8 h-8">
                <CalendarClock size={16} className="text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Por vencer (30 días)</h3>
                <p className="text-xs text-slate-400">Insumos próximos a su fecha de vencimiento</p>
              </div>
              <span className="text-xs font-semibold tabular-nums text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-2 py-0.5 rounded-md">
                {expiringSoon.length}
              </span>
            </div>

            {expiringSoon.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Nada próximo a vencer.</div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-white/5">
                {expiringSoon.map((it) => {
                  const days = daysUntil(it.expiresAt);
                  const overdue = days != null && days < 0;
                  return (
                    <div key={it.id} className="flex items-center gap-3 px-5 py-3.5">
                      <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-50 text-violet-500 dark:bg-violet-500/10 shrink-0">
                        <CalendarClock size={16} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{it.name}</p>
                        <p className="text-xs text-slate-400">Vence: {fmtDate(it.expiresAt)}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium shrink-0 ${overdue ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400'}`}>
                        {days == null ? '—' : overdue ? 'Vencido' : days === 0 ? 'Hoy' : `${days} día${days === 1 ? '' : 's'}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
