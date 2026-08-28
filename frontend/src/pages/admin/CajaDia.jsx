import { useState, useEffect, useCallback } from 'react';
import { Lock, RefreshCcw, Wallet, CreditCard, Receipt, Ban, TrendingUp, Clock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatGs } from '../../constants/pricing';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { SkeletonStats, SkeletonTable } from '../../components/Skeleton';
import StatCard from '../../components/StatCard';

/**
 * Caja del día: el corte de las ventas de mostrador.
 *
 * Es una sesión que se abre y se cierra con hora y responsable, no un filtro por fecha: una vez
 * cerrada, su total queda congelado y ya nadie lo mueve.
 */

const hora = (d) => (d ? new Date(d).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }) : '—');
const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

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
      setHistorial(hist.data?.data || []);
    } catch (e) {
      toast.error('No se pudo cargar la caja');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // La caja abierta se refresca sola: es una pantalla que se deja puesta en el mostrador.
  useEffect(() => {
    if (!caja || caja.status !== 'OPEN') return;
    const i = setInterval(() => cargar({ silencioso: true }), 30000);
    return () => clearInterval(i);
  }, [caja, cargar]);

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
      setAnulando(null);
      setMotivo('');
      api.invalidate?.('/cash');
      cargar();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'No se pudo anular');
    }
  };

  if (cargando) {
    return <div><PageHeader title="Caja del día" /><SkeletonStats /><SkeletonTable rows={5} /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Caja del día"
        subtitle={caja
          ? `Abierta ${fecha(caja.openedAt)} a las ${hora(caja.openedAt)}${caja.openedBy ? ` por ${caja.openedBy}` : ''}`
          : 'Todavía no hubo ventas de mostrador hoy'}
        actions={caja && caja.status === 'OPEN' ? (
          <>
            <button className="btn btn-secondary" onClick={() => cargar()}><RefreshCcw size={15} /> Actualizar</button>
            <button className="btn btn-primary" onClick={() => setConfirmarCierre(true)}><Lock size={15} /> Cerrar caja</button>
          </>
        ) : null}
      />

      {!caja ? (
        <EmptyState
          icon="🧾"
          title="No hay ninguna caja abierta"
          message="La caja se abre sola con la primera venta del día. Cuando el primer cliente pague en el mostrador, va a aparecer acá."
        />
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <StatCard icon={<TrendingUp size={20} />} title="Vendido" value={formatGs(caja.totalGs)} />
            <StatCard icon={<Receipt size={20} />} title="Ventas" value={String(caja.ordersCount)} />
            <StatCard icon={<Wallet size={20} />} title="Ticket promedio" value={formatGs(caja.ticketPromedioGs)} />
            <StatCard icon={<Ban size={20} />} title="Anuladas" value={String(caja.voidedCount || 0)} />
          </div>

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: 20 }}>
            <div className="card">
              <h3 style={{ fontSize: 14, marginBottom: 12 }}>Cómo pagaron</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Fila icono={<CreditCard size={15} />} label="Tarjeta" valor={formatGs(caja.porMedioDePago?.card || 0)} />
                <Fila icono={<Wallet size={15} />} label="Saldo de billetera" valor={formatGs(caja.porMedioDePago?.wallet || 0)} />
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: 14, marginBottom: 12 }}>Lo más vendido</h3>
              {!caja.topProductos?.length ? <p className="text-muted" style={{ fontSize: 13 }}>Sin ventas todavía</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {caja.topProductos.slice(0, 5).map((p) => (
                    <Fila key={p.name} label={`${p.qty}× ${p.name}`} valor={formatGs(p.totalGs)} />
                  ))}
                </div>
              )}
            </div>

            {caja.porOperario?.length > 0 && (
              <div className="card">
                <h3 style={{ fontSize: 14, marginBottom: 12 }}>Quién cobró</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {caja.porOperario.map((o) => (
                    <Fila key={o.name} icono={<User size={14} />} label={`${o.name} (${o.count})`} valor={formatGs(o.totalGs)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto', marginBottom: 24 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Hora</th><th>Cliente</th><th>Productos</th><th>Pago</th>
                  <th style={{ textAlign: 'right' }}>Total</th><th>Cobró</th><th></th>
                </tr>
              </thead>
              <tbody>
                {!caja.orders?.length ? (
                  <tr><td colSpan={7}><p className="text-muted" style={{ padding: 16, textAlign: 'center' }}>Sin ventas todavía</p></td></tr>
                ) : caja.orders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ whiteSpace: 'nowrap' }}><Clock size={12} style={{ opacity: .4, marginRight: 4 }} />{hora(o.paidAt)}</td>
                    <td><strong>{o.client}</strong></td>
                    <td className="text-muted" style={{ fontSize: 13 }}>
                      {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                    </td>
                    <td>{o.paymentMethod === 'wallet' ? <><Wallet size={13} /> Saldo</> : <><CreditCard size={13} /> Tarjeta</>}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><strong>{formatGs(o.totalGs)}</strong></td>
                    <td className="text-muted" style={{ fontSize: 13 }}>{o.employee || '—'}</td>
                    <td>
                      <button className="btn btn-icon" title="Anular venta" onClick={() => { setAnulando(o); setMotivo(''); }}>
                        <Ban size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {historial.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, margin: '8px 0 12px' }}>Cierres anteriores</h2>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr><th>Día</th><th>Abierta</th><th>Cerrada</th><th>Ventas</th><th style={{ textAlign: 'right' }}>Total</th><th>Cerró</th></tr>
              </thead>
              <tbody>
                {historial.filter((s) => s.status === 'CLOSED').map((s) => (
                  <tr key={s.id}>
                    <td>{fecha(s.openedAt)}</td>
                    <td className="text-muted">{hora(s.openedAt)}</td>
                    <td className="text-muted">{hora(s.closedAt)}</td>
                    <td>{s.ordersCount ?? 0}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><strong>{formatGs(s.totalGs || 0)}</strong></td>
                    <td className="text-muted">{s.closedBy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={confirmarCierre}
        onClose={() => setConfirmarCierre(false)}
        onConfirm={cerrarCaja}
        title="¿Cerrar la caja del día?"
        message={`Se van a congelar ${formatGs(caja?.totalGs || 0)} en ${caja?.ordersCount || 0} venta(s). Después del cierre ese total ya no se puede modificar.`}
        confirmLabel={cerrando ? 'Cerrando...' : 'Cerrar caja'}
      />

      {anulando && (
        <ConfirmDialog
          isOpen={!!anulando}
          onClose={() => setAnulando(null)}
          onConfirm={anularVenta}
          title="Anular esta venta"
          variant="danger"
          confirmLabel="Anular"
          message={
            <div>
              <p style={{ marginBottom: 12 }}>
                {`${anulando.client} · ${formatGs(anulando.totalGs)}`}. Los productos vuelven al stock
                {anulando.paymentMethod === 'wallet'
                  ? ' y el saldo se le devuelve al cliente.'
                  : '. El reembolso a la tarjeta hay que hacerlo desde Bancard.'}
              </p>
              <input className="input" autoFocus placeholder="Motivo de la anulación" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          }
        />
      )}
    </div>
  );
}

function Fila({ icono, label, valor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }} className="text-muted">{icono}{label}</span>
      <strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{valor}</strong>
    </div>
  );
}
