import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Trash2, RefreshCcw, Loader2, Wrench, Droplets,
  Info, ChevronDown, Beaker, Car,
} from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

const fmtGs = (n) => '₲ ' + Number(n || 0).toLocaleString('es-PY');

export default function RecipesTab() {
  const [services, setServices] = useState([]);
  const [items, setItems] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [recipesByService, setRecipesByService] = useState({}); // { [serviceId]: line[] }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(null); // serviceId currently open

  // Form state (per service add-line). We keep a single shared draft keyed by serviceId.
  const [draft, setDraft] = useState({}); // { [serviceId]: { itemId, vehicleSize, quantity } }
  const [adding, setAdding] = useState(null); // serviceId being submitted
  const [deletingId, setDeletingId] = useState(null);

  const loadBase = async () => {
    setError(false);
    try {
      const [svcRes, itemsRes, sizesRes] = await Promise.all([
        api.get('/services', { _noCache: true }),
        api.get('/inventory', { params: { limit: 200 }, _noCache: true }),
        api.get('/vehicle-sizes', { _noCache: true }).catch(() => ({ data: { data: [] } })),
      ]);
      const svcList = svcRes.data.data || [];
      setServices(svcList);
      setItems(itemsRes.data.data || []);
      setSizes(sizesRes.data.data || []);
      // Cargar recetas de todos los servicios en paralelo
      const recipeEntries = await Promise.all(
        svcList.map(async (s) => {
          try {
            const r = await api.get('/inventory/recipes', { params: { serviceId: s.id }, _noCache: true });
            return [s.id, r.data.data || []];
          } catch {
            return [s.id, []];
          }
        })
      );
      setRecipesByService(Object.fromEntries(recipeEntries));
      if (svcList.length && expanded === null) setExpanded(svcList[0].id);
    } catch (e) {
      setError(true);
      toast.error(e.response?.data?.message || 'No se pudieron cargar las recetas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBase(); }, []);

  const refresh = () => { setLoading(true); loadBase(); };

  const reloadService = async (serviceId) => {
    try {
      const r = await api.get('/inventory/recipes', { params: { serviceId }, _noCache: true });
      setRecipesByService((prev) => ({ ...prev, [serviceId]: r.data.data || [] }));
    } catch {
      /* ignore */
    }
  };

  const sizeLabel = useMemo(() => {
    const map = {};
    for (const s of sizes) map[s.key] = s.label;
    return map;
  }, [sizes]);

  const getDraft = (serviceId) =>
    draft[serviceId] || { itemId: '', vehicleSize: '', quantity: '' };

  const setDraftField = (serviceId, key, value) =>
    setDraft((prev) => ({
      ...prev,
      [serviceId]: { ...getDraft(serviceId), [key]: value },
    }));

  const handleAdd = async (serviceId) => {
    const d = getDraft(serviceId);
    if (!d.itemId) { toast.error('Elegí un insumo'); return; }
    const qty = Number(d.quantity);
    if (!qty || qty <= 0 || !Number.isInteger(qty)) { toast.error('Cantidad inválida'); return; }
    setAdding(serviceId);
    try {
      await api.post('/inventory/recipes', {
        serviceId,
        itemId: d.itemId,
        // "" (Todos los tamaños) → null
        vehicleSize: d.vehicleSize ? d.vehicleSize : null,
        quantity: qty,
      });
      toast.success('Línea de receta agregada');
      setDraft((prev) => ({ ...prev, [serviceId]: { itemId: '', vehicleSize: '', quantity: '' } }));
      await reloadService(serviceId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo agregar la línea');
    } finally {
      setAdding(null);
    }
  };

  const handleDelete = async (serviceId, recipeId) => {
    setDeletingId(recipeId);
    try {
      await api.delete(`/inventory/recipes/${recipeId}`);
      toast.success('Línea eliminada');
      // Optimista
      setRecipesByService((prev) => ({
        ...prev,
        [serviceId]: (prev[serviceId] || []).filter((r) => r.id !== recipeId),
      }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar');
      reloadService(serviceId);
    } finally {
      setDeletingId(null);
    }
  };

  const selectCls =
    'w-full appearance-none bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl pl-3.5 pr-9 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors cursor-pointer';
  const inputCls =
    'w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors';

  return (
    <div>
      {/* Texto explicativo */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-sky-50 dark:bg-sky-500/5 border border-sky-200 dark:border-sky-500/20 mb-5">
        <Info size={18} className="text-sky-500 shrink-0 mt-0.5" />
        <p className="text-sm text-sky-800 dark:text-sky-300">
          Definí cuánto insumo consume cada servicio. Al completar un servicio, el stock se descuenta automáticamente según esta receta.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recetas por servicio</h2>
        <button
          onClick={refresh}
          title="Actualizar"
          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors"
        >
          <RefreshCcw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-10 text-center text-sm text-slate-400">
          <Loader2 size={20} className="animate-spin inline mr-2" /> Cargando recetas…
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-12 text-center">
          <p className="text-3xl mb-2">⚠️</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Error al cargar</p>
          <button onClick={refresh} className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 transition-colors">
            Reintentar
          </button>
        </div>
      ) : services.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-12 text-center">
          <span className="admin-itile admin-itile-sky inline-flex w-12 h-12 rounded-2xl items-center justify-center mb-3">
            <Wrench size={22} className="text-white" />
          </span>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Sin servicios</p>
          <p className="text-xs text-slate-400 mt-1">Creá servicios primero para poder definir sus recetas de consumo.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((svc) => {
            const lines = recipesByService[svc.id] || [];
            const open = expanded === svc.id;
            const d = getDraft(svc.id);
            return (
              <div
                key={svc.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden"
              >
                {/* Header del servicio */}
                <button
                  onClick={() => setExpanded(open ? null : svc.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors text-left"
                >
                  <span className="admin-itile admin-itile-sky w-9 h-9 shrink-0">
                    <Droplets size={16} className="text-white" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">{svc.name}</p>
                    <p className="text-xs text-slate-400">
                      {lines.length === 0 ? 'Sin insumos definidos' : `${lines.length} insumo${lines.length === 1 ? '' : 's'} en la receta`}
                    </p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>

                  {open && (
                    <div className="overflow-hidden">
                      <div className="px-5 pb-5 border-t border-slate-100 dark:border-white/5 pt-4">
                        {/* Líneas existentes */}
                        {lines.length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-4">
                            Todavía no definiste insumos para este servicio.
                          </p>
                        ) : (
                          <div className="space-y-2 mb-4">
                            {lines.map((line) => (
                              <div
                                key={line.id}
                                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5"
                              >
                                <span className="admin-itile admin-itile-cyan w-8 h-8 shrink-0">
                                  <Beaker size={15} className="text-white" />
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                    {line.item?.name || 'Insumo'}
                                  </p>
                                  <p className="text-xs text-slate-400 flex items-center gap-1">
                                    <Car size={11} />
                                    {line.vehicleSize
                                      ? (sizeLabel[line.vehicleSize] || line.vehicleSize)
                                      : 'Todos los tamaños'}
                                  </p>
                                </div>
                                <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200 shrink-0">
                                  {line.quantity} {line.item?.unit || ''}
                                </span>
                                <button
                                  onClick={() => handleDelete(svc.id, line.id)}
                                  disabled={deletingId === line.id}
                                  title="Eliminar línea"
                                  className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
                                >
                                  {deletingId === line.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Form agregar línea */}
                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end pt-1">
                          <div className="flex-1 min-w-0">
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Insumo</label>
                            <div className="relative">
                              <select
                                value={d.itemId}
                                onChange={(e) => setDraftField(svc.id, 'itemId', e.target.value)}
                                className={selectCls}
                              >
                                <option value="">Elegir insumo…</option>
                                {items.map((it) => (
                                  <option key={it.id} value={it.id}>
                                    {it.name} ({it.unit})
                                  </option>
                                ))}
                              </select>
                              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                          </div>
                          <div className="sm:w-44 shrink-0">
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Tamaño</label>
                            <div className="relative">
                              <select
                                value={d.vehicleSize}
                                onChange={(e) => setDraftField(svc.id, 'vehicleSize', e.target.value)}
                                className={selectCls}
                              >
                                <option value="">Todos los tamaños</option>
                                {sizes.map((s) => (
                                  <option key={s.id || s.key} value={s.key}>{s.label}</option>
                                ))}
                              </select>
                              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                          </div>
                          <div className="sm:w-28 shrink-0">
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Cantidad</label>
                            <input
                              type="number" min={1} value={d.quantity}
                              onChange={(e) => setDraftField(svc.id, 'quantity', e.target.value)}
                              placeholder="0"
                              className={inputCls}
                            />
                          </div>
                          <button
                            onClick={() => handleAdd(svc.id)}
                            disabled={adding === svc.id}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-sm shadow-indigo-600/20 transition-all shrink-0 disabled:opacity-60"
                          >
                            {adding === svc.id ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            Agregar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
