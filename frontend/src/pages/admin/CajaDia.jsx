import { useState, useEffect, useCallback } from 'react';
import { motion as Motion } from 'framer-motion';
import { Lock, RefreshCcw, Wallet, CreditCard, Receipt, Ban, TrendingUp, Clock, User, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatGs } from '../../constants/pricing';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { SkeletonTable } from '../../components/Skeleton';

/**
 * Caja del día: el corte de las ventas de mostrador.
 *
 * Es una sesión que se abre y se cierra con hora y responsable, no un filtro por fecha: una vez
 * cerrada, su total queda congelado y ya nadie lo mueve.
 */

const hora = (d) => (d ? new Date(d).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }) : '—');
const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const CARD = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm';

export default function CajaDia() {
  const [caja, setCaja] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [anulando, setAnulando] = useState(null);
  const [motivo, setMotivo] = useState('');

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCargando(true);
    try {
      const [actual, hist] = await Promise.all([
        api.get('/cash/current', { _noCache: true }),
        api.get('/cash/sessions', { _noCache: true }),
      ]);
      setCaja(actual.data?.data || null);
      setHistorial((hist.data?.data || []).filter((s) => s.status === 'CLOSED'));
    } catch {
      toast.error('No se pudo cargar la caja');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Es una pantalla que se deja puesta en el mostrador: se refresca sola.
  useEffect(() => {
    if (caja?.status !== 'OPEN') return;
    const i = setInterval(() => cargar({ silencioso: true }), 30000);
    return () => clearInterval(i);
  }, [caja?.status, cargar]);

  const cerrarCaja = async () => {
    setCerrando(true);
    try {
      const r = await api.post('/cash/close', {});
      toast.success(`Caja cerrada: ${formatGs(r.data?.data?.totalGs || 0)}`);
      setConfirmarCierre(false);
      api.invalidate?.('/cash');
      cargar();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'No se pudo cerrar la caja');
    } finally {
      setCerrando(false);
    }
  };

  const anularVenta = async () => {
    if (motivo.trim().length < 4) return toast.error('Escribí el motivo');
    try {
      const r = await api.post(`/cash/orders/${anulando.id}/void`, { motivo: motivo.trim() });
      toast.success(r.data?.message || 'Venta anulada');
      setAnulando(null); setMotivo('');
      api.invalidate?.('/cash');
      cargar();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'No se pudo anular');
    }
  };

  if (cargando) {
    return <div className="page-content pb-16"><PageHeader title="Caja del día" /><SkeletonTable rows={5} /></div>;
  }

  return (
    <div className="page-content pb-16">
      <PageHeader
        title="Caja del día"
        subtitle={caja
          ? `Abierta el ${fecha(caja.openedAt)} a las ${hora(caja.openedAt)}${caja.openedBy ? ` por ${caja.openedBy}` : ''}`
          : 'Todavía no hubo ventas de mostrador'}
        actions={caja?.status === 'OPEN' ? (
          <>
            <button onClick={() => cargar()}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5">
              <RefreshCcw size={15} /> Actualizar
            </button>
            <button onClick={() => setConfirmarCierre(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary dark:bg-blue-600 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-shadow">
              <Lock size={15} /> Cerrar caja
            </button>
          </>
        ) : null}
      />

      {!caja ? (
        <EmptyState
          icon="🧾"
          title="No hay ninguna caja abierta"
          message="La caja se abre sola con la primera venta del día. Cuando un cliente pague en el mostrador, vas a ver acá el total, el detalle y quién cobró."
        />
      ) : (
        <>
          {/* Totales */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-5">
            <Tarjeta icono={<TrendingUp size={18} />} color="#0f7a52" label="Vendido" valor={formatGs(caja.totalGs)} destacado />
            <Tarjeta icono={<Receipt size={18} />} color="#0f2b80" label="Ventas" valor={String(caja.ordersCount)} />
            <Tarjeta icono={<Wallet size={18} />} color="#8f6a12" label="Ticket promedio" valor={formatGs(caja.ticketPromedioGs)} />
            <Tarjeta icono={<Ban size={18} />} color="#9c2a20" label="Anuladas" valor={String(caja.voidedCount || 0)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3 mb-5">
            <div className={`${CARD} p-5`}>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Cómo pagaron</h2>
              <div className="space-y-2.5">
                <Fila icono={<CreditCard size={14} />} label="Tarjeta" valor={formatGs(caja.porMedioDePago?.card || 0)} />
                <Fila icono={<Wallet size={14} />} label="Saldo de billetera" valor={formatGs(caja.porMedioDePago?.wallet || 0)} />
              </div>
            </div>

            <div className={`${CARD} p-5`}>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 inline-flex items-center gap-1.5">
                <Trophy size={14} className="text-amber-500" /> Lo más vendido
              </h2>
              {!caja.topProductos?.length
                ? <p className="text-sm text-slate-400">Sin ventas todavía</p>
                : <div className="space-y-2.5">
                  {caja.topProductos.slice(0, 5).map((p) => (
                    <Fila key={p.name} label={`${p.qty}× ${p.name}`} valor={formatGs(p.totalGs)} />
                  ))}
                </div>}
            </div>

            <div className={`${CARD} p-5`}>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Quién cobró</h2>
              {!caja.porOperario?.length
                ? <p className="text-sm text-slate-400">Sin ventas todavía</p>
                : <div className="space-y-2.5">
                  {caja.porOperario.map((o) => (
                    <Fila key={o.name} icono={<User size={14} />} label={`${o.name} (${o.count})`} valor={formatGs(o.totalGs)} />
                  ))}
                </div>}
            </div>
          </div>

          {/* Ventas */}
          <div className={`${CARD} overflow-hidden mb-8`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5 text-left">
                    {['Hora', 'Cliente', 'Productos', 'Pago', 'Total', 'Cobró', ''].map((h, i) => (
                      <th key={h || i} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${h === 'Total' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {!caja.orders?.length ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">Todavía no se vendió nada hoy</td></tr>
                  ) : caja.orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                        <Clock size={12} className="inline mr-1.5 opacity-50" />{hora(o.paidAt)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{o.client}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold ${o.paymentMethod === 'wallet'
                          ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'}`}>
                          {o.paymentMethod === 'wallet' ? <><Wallet size={12} /> Saldo</> : <><CreditCard size={12} /> Tarjeta</>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">{formatGs(o.totalGs)}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{o.employee || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setAnulando(o); setMotivo(''); }} title="Anular venta"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                          <Ban size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {historial.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Cierres anteriores</h2>
          <div className={`${CARD} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5 text-left">
                    {['Día', 'Abierta', 'Cerrada', 'Ventas', 'Total', 'Cerró'].map((h) => (
                      <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${h === 'Total' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {historial.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-slate-900 dark:text-white">{fecha(s.openedAt)}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{hora(s.openedAt)}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{hora(s.closedAt)}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.ordersCount ?? 0}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">{formatGs(s.totalGs || 0)}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.closedBy || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={confirmarCierre}
        onClose={() => setConfirmarCierre(false)}
        onConfirm={cerrarCaja}
        loading={cerrando}
        variant="primary"
        title="¿Cerrar la caja del día?"
        confirmLabel="Cerrar caja"
        message={`Se congelan ${formatGs(caja?.totalGs || 0)} en ${caja?.ordersCount || 0} venta(s). Después del cierre ese total ya no se puede modificar.`}
      />

      {anulando && (
        <ConfirmDialog
          isOpen
          onClose={() => setAnulando(null)}
          onConfirm={anularVenta}
          variant="danger"
          title="Anular esta venta"
          confirmLabel="Anular"
          message={
            <div className="text-left">
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
                {anulando.client} · <strong>{formatGs(anulando.totalGs)}</strong>. Los productos vuelven al stock
                {anulando.paymentMethod === 'wallet'
                  ? ' y el saldo se le devuelve al cliente.'
                  : '. El reembolso a la tarjeta hay que hacerlo desde Bancard.'}
              </p>
              <input
                autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo de la anulación"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          }
        />
      )}
    </div>
  );
}

function Tarjeta({ icono, color, label, valor, destacado }) {
  return (
    <Motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`${CARD} p-4 flex flex-col gap-3`}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center border"
        style={{ backgroundColor: `${color}12`, borderColor: `${color}25`, color }}>
        {icono}
      </div>
      <div>
        <span className={`block font-headline font-black text-slate-900 dark:text-white leading-tight tabular-nums ${destacado ? 'text-2xl' : 'text-xl'}`}>{valor}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      </div>
    </Motion.div>
  );
}

function Fila({ icono, label, valor }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 min-w-0">
        {icono}<span className="truncate">{label}</span>
      </span>
      <strong className="text-sm text-slate-900 dark:text-white tabular-nums shrink-0">{valor}</strong>
    </div>
  );
}
