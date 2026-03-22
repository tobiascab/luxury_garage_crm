import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import toast from 'react-hot-toast';

export default function MyWallet() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState('');
  const [showTopup, setShowTopup] = useState(false);

  useEffect(() => { loadWallet(); }, []);

  const loadWallet = async () => {
    try {
      const res = await api.get('/credits');
      setData(res.data.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleTopup = async () => {
    const amount = parseInt(topupAmount);
    if (!amount || amount < 10000) return toast.error('Monto mínimo: ₲10.000');
    try {
      const res = await api.post('/credits/topup', { amount });
      toast.success(res.data.message);
      setTopupAmount('');
      setShowTopup(false);
      loadWallet();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const quickAmounts = [50000, 100000, 200000, 500000];

  return (
    <div className="page-content">
      <PageHeader title="💰 Mi Billetera" subtitle="Cargá saldo para usar en el shop y showroom" />

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <StatCard icon="💰" title="Saldo Total" value={`₲${(data?.totalBalance || 0).toLocaleString()}`} color="#10B981" />
        <StatCard icon="💳" title="Billetera (Shop)" value={`₲${(data?.walletBalance || 0).toLocaleString()}`} color="#1E90FF" />
        <StatCard icon="🎁" title="Créditos (Referidos)" value={`₲${(data?.referralBalance || 0).toLocaleString()}`} color="#F59E0B" />
      </div>

      {/* Top-up section */}
      <motion.div className="card card-glass" style={{ marginBottom: '24px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="card-header">
          <h3>💳 Cargar Saldo</h3>
        </div>
        <div className="card-body">
          <p className="text-muted text-sm" style={{ marginBottom: '16px' }}>
            Cargá saldo para usar en el showroom: bebidas, snacks, productos y más.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {quickAmounts.map(amt => (
              <motion.button
                key={amt}
                className="btn btn-outline"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setTopupAmount(String(amt))}
                style={{ borderColor: topupAmount === String(amt) ? 'var(--blue)' : undefined, color: topupAmount === String(amt) ? 'var(--blue)' : undefined }}
              >
                ₲{amt.toLocaleString()}
              </motion.button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              className="form-input"
              type="number"
              placeholder="Monto personalizado"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleTopup} disabled={!topupAmount}>
              Cargar ₲{topupAmount ? parseInt(topupAmount).toLocaleString() : '0'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Movement history */}
      <motion.div className="card card-glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="card-header">
          <h3>📋 Movimientos</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {data?.movements?.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {data.movements.map(m => (
                  <tr key={m.id}>
                    <td className="text-sm">{new Date(m.createdAt).toLocaleDateString('es-PY')}</td>
                    <td>
                      <span className={`badge ${m.amount > 0 ? 'badge-success' : 'badge-danger'}`}>
                        {m.type === 'WALLET_TOPUP' ? 'Carga' : m.type === 'SHOP_PURCHASE' ? 'Compra Shop' : m.type === 'REFERRAL_REWARD' ? 'Referido' : m.type === 'REDEMPTION' ? 'Canje' : m.type}
                      </span>
                    </td>
                    <td className="text-sm">{m.description}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: m.amount > 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-display)' }}>
                      {m.amount > 0 ? '+' : ''}₲{Math.abs(m.amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state-small" style={{ padding: '32px' }}>
              <p>Sin movimientos todavía</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
