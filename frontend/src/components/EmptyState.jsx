export default function EmptyState({ icon = '📭', title, message, action, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      <p className="text-muted">{message}</p>
      {action && <button className="btn btn-primary" onClick={onAction}>{action}</button>}
    </div>
  );
}
