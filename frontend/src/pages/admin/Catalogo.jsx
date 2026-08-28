import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, ShoppingBag, Image as ImageIcon, Pencil, PackageX, Eye, EyeOff, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatGs } from '../../constants/pricing';
import PageHeader from '../../components/PageHeader';
import FormModal from '../../components/FormModal';
import FormField from '../../components/FormField';
import EmptyState from '../../components/EmptyState';
import { SkeletonTable } from '../../components/Skeleton';

/**
 * Catálogo del mostrador: lo que el cliente ve en su tienda.
 *
 * Un producto vendible ES un ítem de inventario — el mismo del que se descuenta stock cuando
 * se vende y cuando lo consume un servicio. Acá se le pone la cara comercial: precio, foto,
 * categoría y el interruptor que lo publica. Nada aparece en la tienda hasta marcarlo.
 */

const VACIO = {
  name: '', brand: '', saleCategory: '', salePriceGs: '', currentStock: 0,
  minStockAlert: 5, unit: 'unidad', costPerUnit: 0, imageUrl: '', isForSale: true,
};

export default function Catalogo() {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [soloPublicados, setSoloPublicados] = useState(false);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.get('/inventory', { params: { limit: 200 }, _noCache: true });
      setItems(r.data?.data || []);
    } catch (e) {
      toast.error('No se pudo cargar el catálogo');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return items.filter((i) => {
      if (soloPublicados && !i.isForSale) return false;
      if (!t) return true;
      return [i.name, i.brand, i.saleCategory, i.category].filter(Boolean).some((v) => String(v).toLowerCase().includes(t));
    });
  }, [items, busqueda, soloPublicados]);

  const publicados = items.filter((i) => i.isForSale).length;

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
    } catch (e) {
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
    try {
      if (!item.isForSale && !(item.salePriceGs > 0)) {
        toast.error('Primero cargale un precio de venta');
        return abrirEdicion(item);
      }
      await api.put(`/inventory/${item.id}`, { ...item, isForSale: !item.isForSale, expiresAt: undefined });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isForSale: !i.isForSale } : i)));
      api.invalidate?.('/inventory');
      toast.success(item.isForSale ? 'Sacado de la tienda' : 'Publicado en la tienda');
    } catch (e) {
      toast.error('No se pudo cambiar la publicación');
    }
  };

  return (
    <div>
      <PageHeader
        title="Catálogo de la tienda"
        subtitle={`${publicados} producto${publicados === 1 ? '' : 's'} a la venta · el cliente sólo ve lo publicado`}
        actions={<button className="btn btn-primary" onClick={abrirNuevo}><Plus size={16} /> Nuevo producto</button>}
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: .45 }} />
            <input
              className="input" style={{ paddingLeft: 34 }}
              placeholder="Buscar producto..."
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <button
            className={`btn ${soloPublicados ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSoloPublicados((v) => !v)}
          >
            {soloPublicados ? <Eye size={15} /> : <EyeOff size={15} />} Sólo publicados
          </button>
        </div>
      </div>

      {cargando ? <SkeletonTable rows={6} /> : !visibles.length ? (
        <EmptyState
          icon="🥤"
          title={busqueda ? 'Sin resultados' : 'Todavía no hay productos'}
          message={busqueda ? 'Probá con otro nombre.' : 'Cargá bebidas, snacks o accesorios para que aparezcan en la tienda del cliente.'}
          action={busqueda ? undefined : 'Agregar el primero'}
          onAction={abrirNuevo}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 64 }}>Foto</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th style={{ textAlign: 'right' }}>Precio</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th style={{ textAlign: 'center' }}>En la tienda</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((i) => (
                <tr key={i.id}>
                  <td>
                    <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', background: 'var(--surface-variant, #f1f5f9)', display: 'grid', placeItems: 'center' }}>
                      {i.imageUrl
                        ? <img src={i.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <ImageIcon size={16} style={{ opacity: .3 }} />}
                    </div>
                  </td>
                  <td>
                    <strong>{i.name}</strong>
                    {i.brand && <div className="text-muted" style={{ fontSize: 12 }}>{i.brand}</div>}
                  </td>
                  <td className="text-muted">{i.saleCategory || i.category || '—'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {i.salePriceGs > 0 ? <strong>{formatGs(i.salePriceGs)}</strong> : <span className="text-muted">sin precio</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: i.currentStock <= (i.minStockAlert ?? 0) ? 'var(--danger, #dc2626)' : 'inherit' }}>
                      {i.currentStock}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className={`btn btn-sm ${i.isForSale ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => alternarPublicado(i)}
                      title={i.isForSale ? 'Sacar de la tienda' : 'Publicar en la tienda'}
                    >
                      {i.isForSale ? <><ShoppingBag size={13} /> Publicado</> : <><PackageX size={13} /> Oculto</>}
                    </button>
                  </td>
                  <td>
                    <button className="btn btn-icon" onClick={() => abrirEdicion(i)} aria-label={`Editar ${i.name}`}>
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormModal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editando ? 'Editar producto' : 'Nuevo producto'}
        onSubmit={guardar}
        submitLabel={guardando ? 'Guardando...' : 'Guardar'}
        submitDisabled={guardando}
      >
        <FormField label="Nombre" required>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Coca-Cola 500ml" />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Marca">
            <input className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Coca-Cola" />
          </FormField>
          <FormField label="Categoría">
            <input className="input" value={form.saleCategory} onChange={(e) => setForm({ ...form, saleCategory: e.target.value })} placeholder="Bebidas" />
          </FormField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Precio de venta (₲)" required>
            <input className="input" type="number" min="0" value={form.salePriceGs}
              onChange={(e) => setForm({ ...form, salePriceGs: e.target.value })} placeholder="10000" />
          </FormField>
          <FormField label="Costo (₲)">
            <input className="input" type="number" min="0" value={form.costPerUnit}
              onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })} />
          </FormField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Stock actual">
            <input className="input" type="number" min="0" value={form.currentStock}
              onChange={(e) => setForm({ ...form, currentStock: e.target.value })} />
          </FormField>
          <FormField label="Avisar cuando queden">
            <input className="input" type="number" min="0" value={form.minStockAlert}
              onChange={(e) => setForm({ ...form, minStockAlert: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Foto del producto" hint="Es lo que ve el cliente en la tienda y el operario al cobrar.">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 14, overflow: 'hidden', background: 'var(--surface-variant, #f1f5f9)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              {form.imageUrl
                ? <img src={form.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <ImageIcon size={20} style={{ opacity: .3 }} />}
            </div>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <Upload size={15} /> {subiendo ? 'Subiendo...' : form.imageUrl ? 'Cambiar foto' : 'Subir foto'}
              <input type="file" accept="image/*" hidden onChange={(e) => subirFoto(e.target.files?.[0])} />
            </label>
          </div>
        </FormField>
        <FormField label="">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.isForSale} onChange={(e) => setForm({ ...form, isForSale: e.target.checked })} />
            <span>Publicar en la tienda del cliente</span>
          </label>
        </FormField>
      </FormModal>
    </div>
  );
}
