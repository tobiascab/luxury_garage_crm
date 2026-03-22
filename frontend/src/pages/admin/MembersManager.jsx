import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import toast from 'react-hot-toast';

export default function MembersManager() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selectedMember, setSelectedMember] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' });

  useEffect(() => { loadMembers(); }, [page, search, filterPlan, filterStatus]);

  const loadMembers = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.set('search', search);
      if (filterPlan) params.set('plan', filterPlan);
      if (filterStatus) params.set('status', filterStatus);
      const res = await api.get(`/members?${params}`);
      setMembers(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const toggleStatus = async (member) => {
    const newStatus = member.isActive ? false : true;
    if (!confirm(newStatus ? '¿Activar este miembro?' : '¿Suspender este miembro?')) return;
    try {
      await api.put(`/members/${member.id}/status`, { isActive: newStatus });
      toast.success(newStatus ? 'Miembro activado' : 'Miembro suspendido');
      loadMembers();
    } catch (err) { toast.error('Error al cambiar estado'); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/members', { ...createForm, role: 'CLIENT' });
      toast.success('Miembro creado');
      setShowCreate(false);
      setCreateForm({ email: '', password: '', firstName: '', lastName: '', phone: '' });
      loadMembers();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

  return (
    <div className="page-content">
      <PageHeader title="👥 Gestión de Miembros" subtitle={`${pagination.total || 0} miembros registrados`}
        actions={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Crear Miembro</button>} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
          <span className="search-bar-icon">🔍</span>
          <input placeholder="Buscar por nombre o email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="form-select" style={{ width: '160px' }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="suspended">Suspendidos</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Miembro</th>
              <th>Email</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>Miembro desde</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient-agua)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'white' }}>
                      {m.firstName?.[0]}{m.lastName?.[0]}
                    </div>
                    <div>
                      <strong>{m.firstName} {m.lastName}</strong>
                      {m.phone && <p className="text-xs text-muted">{m.phone}</p>}
                    </div>
                  </div>
                </td>
                <td className="text-sm">{m.email}</td>
                <td>{m.memberships?.[0]?.plan ? <StatusBadge status={m.memberships[0].plan.name.toUpperCase()} /> : <span className="text-muted text-sm">Sin plan</span>}</td>
                <td>{m.isActive ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="SUSPENDED" />}</td>
                <td className="text-sm text-muted">{new Date(m.createdAt).toLocaleDateString('es-PY')}</td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedMember(m)}>👁️</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(m)} style={{ color: m.isActive ? 'var(--red)' : 'var(--green)' }}>
                      {m.isActive ? '🚫' : '✅'}
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="pagination">
            <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Anterior</button>
            {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`pagination-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="pagination-btn" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Siguiente →</button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!selectedMember} onClose={() => setSelectedMember(null)} title="👤 Detalle del Miembro" size="lg">
        {selectedMember && (
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><p className="text-xs text-muted">Nombre</p><p style={{ fontWeight: 600 }}>{selectedMember.firstName} {selectedMember.lastName}</p></div>
              <div><p className="text-xs text-muted">Email</p><p>{selectedMember.email}</p></div>
              <div><p className="text-xs text-muted">Teléfono</p><p>{selectedMember.phone || '—'}</p></div>
              <div><p className="text-xs text-muted">Rol</p><p>{selectedMember.role}</p></div>
              <div><p className="text-xs text-muted">Registrado</p><p>{new Date(selectedMember.createdAt).toLocaleDateString('es-PY')}</p></div>
              <div><p className="text-xs text-muted">Último login</p><p>{selectedMember.lastLoginAt ? new Date(selectedMember.lastLoginAt).toLocaleDateString('es-PY') : 'Nunca'}</p></div>
            </div>
            {selectedMember.memberships?.[0] && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                <p className="text-xs text-muted" style={{ marginBottom: '8px' }}>Membresía Activa</p>
                <p style={{ fontWeight: 700 }}>{selectedMember.memberships[0].plan?.name} — ₲{selectedMember.memberships[0].plan?.priceGs?.toLocaleString()}/mes</p>
                <p className="text-sm text-muted">Vence: {new Date(selectedMember.memberships[0].endDate).toLocaleDateString('es-PY')}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="+ Crear Miembro">
        <form onSubmit={handleCreate}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" required value={createForm.firstName} onChange={e => setCreateForm({ ...createForm, firstName: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Apellido *</label><input className="form-input" required value={createForm.lastName} onChange={e => setCreateForm({ ...createForm, lastName: e.target.value })} /></div>
          </div>
          <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" required value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Contraseña *</label><input className="form-input" type="password" required minLength={8} value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Crear Miembro</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
