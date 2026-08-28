/**
 * Estado vacío del admin: cuando una lista no tiene nada que mostrar.
 *
 * Igual que PageHeader, usaba clases de legacy.css (hoja que ya no se carga) y salía sin
 * ningún estilo. Los estilos ahora son propios.
 */
export default function EmptyState({ icon = '📭', title, message, action, onAction }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4 text-2xl">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      {message && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{message}</p>}
      {action && (
        <button
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary dark:bg-blue-600 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-shadow"
        >
          {action}
        </button>
      )}
    </div>
  );
}
