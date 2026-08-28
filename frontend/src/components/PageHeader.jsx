/**
 * Encabezado de las pantallas del admin.
 *
 * Usa `admin-page-header`, que es el estándar del panel (tamaño de título, color del subtítulo
 * y el aire de abajo). Antes traía clases de legacy.css —una hoja que la app ya no importa— y
 * el título salía como texto plano, pegado al borde y sin separación del subtítulo.
 */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="admin-page-header">
      <div className="min-w-0">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
