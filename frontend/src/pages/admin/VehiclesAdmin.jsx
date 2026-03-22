import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';

export default function VehiclesAdmin() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadVehicles(); }, []);

  const loadVehicles = async () => {
    try { const r = await api.get('/vehicles/all'); setVehicles(r.data.data || []); } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  const filtered = search ? vehicles.filter(v =>
    `${v.brand} ${v.model} ${v.licensePlate} ${v.color}`.toLowerCase().includes(search.toLowerCase()) ||
    `${v.user?.firstName} ${v.user?.lastName}`.toLowerCase().includes(search.toLowerCase())
  ) : vehicles;

  return (
    <div className="page-content">
      <PageHeader title="🚗 Vehículos Registrados" subtitle={`${vehicles.length} vehículos en el sistema`} />

      <div className="search-bar" style={{ maxWidth: '400px', marginBottom: '20px' }}>
        <span className="search-bar-icon">🔍</span>
        <input placeholder="Buscar por marca, modelo, placa o dueño..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Vehículo</th><th>Placa</th><th>Año</th><th>Color</th><th>Propietario</th><th>Notas</th></tr></thead>
          <tbody>
            {filtered.map((v, i) => (
              <motion.tr key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                <td><strong>{v.brand} {v.model}</strong></td>
                <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--cyan)', letterSpacing: '1px' }}>{v.licensePlate}</td>
                <td className="text-sm">{v.year}</td>
                <td className="text-sm">{v.color}</td>
                <td className="text-sm">{v.user ? `${v.user.firstName} ${v.user.lastName}` : '—'}</td>
                <td>{v.notes ? <span className="text-xs" style={{ color: 'var(--gold)' }}>📋 {v.notes.slice(0, 40)}{v.notes.length > 40 ? '...' : ''}</span> : <span className="text-muted text-xs">—</span>}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
