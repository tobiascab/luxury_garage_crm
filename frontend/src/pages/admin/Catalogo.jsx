import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  Plus, Search, ShoppingBag, Image as ImageIcon, Pencil, Eye, EyeOff,
  Upload, PackageSearch, AlertTriangle, X, Trash2, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatGs } from '../../constants/pricing';
import FormModal from '../../components/FormModal';
import FormField from '../../components/FormField';
import { SkeletonTable } from '../../components/Skeleton';

/**
 * Catálogo de la tienda: lo que el cliente ve al comprar en el mostrador.
 *
 * Un producto vendible ES un ítem de inventario —el mismo del que se descuenta stock— así que
 * esta pantalla y el inventario miran la misma tabla. La diferencia está en QUÉ muestran: acá
 * se entra a ver la tienda, no el depósito, así que arranca filtrado por lo que se vende. Los
 * insumos del lavadero (shampoo, cera, microfibra) viven en Inventario y sólo aparecen si se
 * pide expresamente, para poder publicar alguno.
 */

const VACIO = {
  name: '', brand: '', saleCategory: '', salePriceGs: '', currentStock: 0,
  minStockAlert: 5, unit: 'unidad', costPerUnit: 0, imageUrl: '', isForSale: true,
};

export default function Catalogo() {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState('tienda'); // tienda | inventario
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.get('/inventory', { params: { limit: 200 }, _noCache: true });
      setItems(r.data?.data || []);
    } catch {
      toast.error('No se pudo cargar el catálogo');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const enTienda = useMemo(() => items.filter((i) => i.isForSale), [items]);

  const visibles = useMemo(() => {
    const base = vista === 'tienda' ? enTienda : items.filter((i) => !i.isForSale);
    const t = busqueda.trim().toLowerCase();
    if (!t) return base;
    return base.filter((i) => [i.name, i.brand, i.saleCategory, i.category]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(t)));
  }, [items, enTienda, vista, busqueda]);

  // Categorías ya usadas: se ofrecen como atajo para no escribir "Bebidas" cada vez.
  const categorias = useMemo(
    () => [...new Set(items.map((i) => i.saleCategory).filter(Boolean))].sort(),
    [items],
  );

  // Margen por unidad, para que el precio no se cargue a ciegas.
  const margen = useMemo(() => {
    const p = Number(form.salePriceGs), c = Number(form.costPerUnit);
    return Number.isFinite(p) && p > 0 && Number.isFinite(c) && c > 0 ? p - c : null;
  }, [form.salePriceGs, form.costPerUnit]);

  const abrirNuevo = () => { setEditando(null); setForm(VACIO); setModal(true); };
  const abrirEdicion = (item) => {
    setEditando(item);
    setForm({
      name: item.name || '', brand: item.brand || '',
      saleCategory: item.saleCategory || '', salePriceGs: item.salePriceGs ?? '',
      currentStock: item.currentStock ?? 0, minStockAlert: item.minStockAlert ?? 5,
      unit: item.unit || 'unidad', costPerUnit: item.costPerUnit ?? 0,
      imageUrl: item.imageUrl || '', isForSale: !!item.isForSale,
    });
    setModal(true);
  };

  const subirFoto = async (archivo) => {
    if (!archivo) return;
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('file', archivo);
      const r = await api.post('/uploads?type=productos', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = r.data?.data?.url;
      if (!url) throw new Error('sin url');
      setForm((f) => ({ ...f, imageUrl: url }));
      toast.success('Foto cargada');
    } catch {
      toast.error('No se pudo subir la foto');
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async (e) => {
    e?.preventDefault?.();
    if (!form.name.trim()) return toast.error('Poné un nombre');
    if (form.isForSale && !(Number(form.salePriceGs) > 0)) return toast.error('Un producto publicado necesita precio');

    const cuerpo = {
      name: form.name.trim(),
      brand: form.brand?.trim() || undefined,
      category: form.saleCategory?.trim() || 'GENERAL',
      unit: form.unit || 'unidad',
      currentStock: Number(form.currentStock) || 0,
      minStockAlert: Number(form.minStockAlert) || 0,
      costPerUnit: Number(form.costPerUnit) || 0,
      isForSale: !!form.isForSale,
      salePriceGs: form.salePriceGs === '' ? null : Number(form.salePriceGs),
      imageUrl: form.imageUrl || null,
      saleCategory: form.saleCategory?.trim() || null,
    };

    setGuardando(true);
    try {
      if (editando) await api.put(`/inventory/${editando.id}`, cuerpo);
      else await api.post('/inventory', cuerpo);
      toast.success(editando ? 'Producto actualizado' : 'Producto agregado');
      setModal(false);
      api.invalidate?.('/inventory');
      cargar();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const alternarPublicado = async (item) => {
    if (!item.isForSale && !(item.salePriceGs > 0)) {
      toast('Cargale primero un precio de venta');
      return abrirEdicion(item);
    }
    // Optimista: el interruptor tiene que responder al toque, no esperar al servidor.
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isForSale: !i.isForSale } : i)));
    try {
      await api.put(`/inventory/${item.id}`, {
        name: item.name, category: item.category || 'GENERAL', unit: item.unit || 'unidad',
        currentStock: item.currentStock, minStockAlert: item.minStockAlert,
        costPerUnit: item.costPerUnit || 0, isForSale: !item.isForSale,
        salePriceGs: item.salePriceGs ?? null, imageUrl: item.imageUrl || null,
        saleCategory: item.saleCategory || null,
      });
      api.invalidate?.('/inventory');
      toast.success(item.isForSale ? 'Sacado de la tienda' : 'Publicado en la tienda');
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isForSale: item.isForSale } : i)));
      toast.error('No se pudo cambiar la publicación');
    }
  };

  return (
    // `page-content` es el contenedor estándar del admin: ancho máximo, centrado y con el
    // padding que hace que el título no quede pegado al borde de la pantalla.
    <div className="page-content space-y-5 pb-16">
      {/* Encabezado */}
      <div className="admin-page-header">
        <div className="min-w-0">
          <h1>Catálogo de la tienda</h1>
          <p>
            {enTienda.length === 0
              ? 'Todavía no hay nada publicado — el cliente ve la tienda vacía'
              : `${enTienda.length} producto${enTienda.length === 1 ? '' : 's'} a la venta · el cliente sólo ve lo publicado`}
          </p>
        </div>
        <button
          onClick={abrirNuevo}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary dark:bg-blue-600 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-shadow shrink-0"
        >
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      {/* Pestañas + buscador */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-white/5 shrink-0">
          {[
            { id: 'tienda', label: `En la tienda (${enTienda.length})` },
            { id: 'inventario', label: 'Insumos del taller' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setVista(t.id)}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${vista === t.id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} aria-label="Borrar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {vista === 'inventario' && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Estos son los insumos del lavadero, no productos de venta. Publicá uno sólo si de verdad se lo vendés al cliente.
          </p>
        </div>
      )}

      {/* Grilla */}
      {cargando ? <SkeletonTable rows={5} /> : !visibles.length ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
            <PackageSearch size={26} className="text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {busqueda ? 'Sin resultados'
              : vista === 'tienda' ? 'La tienda todavía está vacía'
                : 'No hay insumos sin publicar'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {busqueda ? 'Probá con otro nombre.'
              : vista === 'tienda' ? 'Cargá bebidas, snacks o accesorios con su precio y su foto para que aparezcan en la app del cliente.'
                : 'Todo el inventario ya está publicado en la tienda.'}
          </p>
          {!busqueda && vista === 'tienda' && (
            <button onClick={abrirNuevo} className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary dark:bg-blue-600 text-white text-sm font-semibold">
              <Plus size={16} /> Cargar el primero
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibles.map((i) => (
            <Motion.div
              key={i.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] bg-slate-50 dark:bg-white/5 relative">
                {i.imageUrl
                  ? <img src={i.imageUrl} alt={i.name} loading="lazy" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={26} className="text-slate-300 dark:text-slate-700" /></div>}
                <button
                  onClick={() => abrirEdicion(i)}
                  aria-label={`Editar ${i.name}`}
                  className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm hover:text-primary"
                >
                  <Pencil size={14} />
                </button>
                {i.currentStock <= (i.minStockAlert ?? 0) && (
                  <span className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-red-500 text-white text-[10px] font-bold uppercase tracking-wide">
                    Quedan {i.currentStock}
                  </span>
                )}
              </div>

              <div className="p-4 flex flex-col flex-1">
                <p className="font-semibold text-sm text-slate-900 dark:text-white leading-tight line-clamp-2">{i.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{i.saleCategory || i.category || 'Sin categoría'}{i.brand ? ` · ${i.brand}` : ''}</p>

                <div className="flex items-baseline justify-between mt-3">
                  {i.salePriceGs > 0
                    ? <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{formatGs(i.salePriceGs)}</span>
                    : <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Sin precio</span>}
                  <span className="text-xs text-slate-400 tabular-nums">{i.currentStock} {i.unit}</span>
                </div>

                <button
                  onClick={() => alternarPublicado(i)}
                  className={`mt-3 w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-colors ${i.isForSale
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-transparent'}`}
                >
                  {i.isForSale ? <><Eye size={13} /> En la tienda</> : <><EyeOff size={13} /> Oculto</>}
                </button>
              </div>
            </Motion.div>
          ))}
        </div>
      )}

      <FormModal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editando ? 'Editar producto' : 'Nuevo producto'}
        onSubmit={guardar}
        submitLabel={guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar producto'}
        submitDisabled={guardando || subiendo}
      >
        <div className="space-y-6">
          {/* ── Qué es ── */}
          <section className="space-y-4">
            <FormField
              label="Nombre" name="name" required autoFocus
              placeholder="Coca-Cola 500 ml"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Marca" name="brand" placeholder="Coca-Cola"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
              <div>
                <FormField
                  label="Categoría" name="saleCategory" placeholder="Bebidas"
                  value={form.saleCategory}
                  onChange={(e) => setForm({ ...form, saleCategory: e.target.value })}
                />
                {categorias.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {categorias.map((c) => (
                      <button
                        key={c} type="button"
                        onClick={() => setForm({ ...form, saleCategory: c })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${form.saleCategory === c
                          ? 'bg-primary text-white dark:bg-blue-600'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Cuánto cuesta ── */}
          <section className="pt-5 border-t border-slate-100 dark:border-white/5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Precio y stock</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Precio de venta" name="salePriceGs" type="number" min="0" required prefix="₲"
                placeholder="10000"
                hint={margen != null ? `Ganás ₲${margen.toLocaleString('es-PY')} por unidad` : 'Lo que paga el cliente'}
                value={form.salePriceGs}
                onChange={(e) => setForm({ ...form, salePriceGs: e.target.value })}
              />
              <FormField
                label="Costo" name="costPerUnit" type="number" min="0" prefix="₲"
                placeholder="0" hint="Lo que te cuesta a vos"
                value={form.costPerUnit}
                onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Stock actual" name="currentStock" type="number" min="0"
                hint={editando ? 'Para corregirlo mejor usá Inventario' : 'Cuántos tenés hoy'}
                value={form.currentStock}
                onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
              />
              <FormField
                label="Avisarme cuando queden" name="minStockAlert" type="number" min="0"
                hint="Para reponer a tiempo"
                value={form.minStockAlert}
                onChange={(e) => setForm({ ...form, minStockAlert: e.target.value })}
              />
            </div>
          </section>

          {/* ── Cómo se ve ── */}
          <section className="pt-5 border-t border-slate-100 dark:border-white/5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Foto</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Es lo que ve el cliente en la tienda y el operario al cobrar.
            </p>

            {form.imageUrl ? (
              <div className="flex items-center gap-4">
                <img src={form.imageUrl} alt="" className="w-28 h-28 rounded-xl object-cover border border-slate-200 dark:border-white/10" />
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5">
                    <Upload size={15} /> Cambiar
                    <input type="file" accept="image/*" hidden onChange={(e) => subirFoto(e.target.files?.[0])} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, imageUrl: '' })}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <Trash2 size={15} /> Quitar
                  </button>
                </div>
              </div>
            ) : (
              /* Zona de carga: se puede arrastrar la foto encima o tocar para elegirla. */
              <label
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastrando(false); subirFoto(e.dataTransfer.files?.[0]); }}
                className={`flex flex-col items-center justify-center gap-2 w-full py-8 px-4 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${arrastrando
                  ? 'border-primary bg-primary/5 dark:border-blue-500 dark:bg-blue-500/10'
                  : 'border-slate-200 dark:border-white/10 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}
              >
                <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                  {subiendo ? <Loader2 size={20} className="animate-spin text-primary" /> : <ImageIcon size={20} className="text-slate-400" />}
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {subiendo ? 'Subiendo...' : 'Arrastrá la foto o tocá para elegirla'}
                </p>
                <p className="text-xs text-slate-400">JPG, PNG o WEBP · hasta 5 MB</p>
                <input type="file" accept="image/*" hidden onChange={(e) => subirFoto(e.target.files?.[0])} />
              </label>
            )}
          </section>

          {/* ── Publicación ── */}
          <section className="pt-5 border-t border-slate-100 dark:border-white/5">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox" className="w-4 h-4 mt-0.5 accent-blue-600"
                checked={form.isForSale}
                onChange={(e) => setForm({ ...form, isForSale: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">Publicar en la tienda del cliente</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Si lo dejás sin marcar, queda cargado pero nadie lo ve todavía.
                </span>
              </span>
            </label>
          </section>
        </div>
      </FormModal>
    </div>
  );
}
