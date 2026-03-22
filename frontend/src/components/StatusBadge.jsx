export default function StatusBadge({ status }) {
  const config = {
    ACTIVE: { label: 'Activo', className: 'badge-success' },
    EXPIRED: { label: 'Vencido', className: 'badge-danger' },
    CANCELLED: { label: 'Cancelado', className: 'badge-danger' },
    SUSPENDED: { label: 'Suspendido', className: 'badge-warning' },
    PENDING: { label: 'Pendiente', className: 'badge-warning' },
    CONFIRMED: { label: 'Confirmado', className: 'badge-info' },
    IN_PROGRESS: { label: 'En proceso', className: 'badge-info' },
    COMPLETED: { label: 'Completado', className: 'badge-success' },
    NO_SHOW: { label: 'No asistió', className: 'badge-danger' },
    INVITED: { label: 'Invitado', className: 'badge-default' },
    REGISTERED: { label: 'Registrado', className: 'badge-info' },
    PURCHASED: { label: 'Compró', className: 'badge-success' },
    BASIC: { label: 'Básico', className: 'badge-default' },
    PREMIUM: { label: 'Premium', className: 'badge-premium' },
    VIP: { label: 'VIP', className: 'badge-vip' },
  };

  const c = config[status] || { label: status, className: 'badge-default' };
  return <span className={`badge ${c.className}`}>{c.label}</span>;
}
