/**
 * Skeleton — placeholders de carga con shimmer para el panel admin.
 *
 * Export por defecto: <Skeleton /> = una barra/bloque genérico.
 * Exports nombrados: SkeletonText, SkeletonCard, SkeletonTable, SkeletonStats
 * para los layouts más comunes del admin.
 *
 * Usar mientras `loading === true`, antes de pintar la tabla/grid real.
 *
 * Uso:
 *  if (loading) return <SkeletonTable rows={6} cols={5} />;
 *  if (loading) return <SkeletonStats count={4} />;
 *  <Skeleton className="h-10 w-40 rounded-xl" />
 */

const shimmer =
  'relative overflow-hidden bg-slate-200/70 dark:bg-white/5 before:absolute before:inset-0 before:-translate-x-full before:animate-[skeleton-shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/40 dark:before:via-white/10 before:to-transparent';

/** Bloque genérico. Pasá tamaño/forma por className (ej: "h-4 w-24 rounded"). */
export default function Skeleton({ className = 'h-4 w-full rounded-lg' }) {
  return (
    <>
      <span className={`block ${shimmer} ${className}`} aria-hidden="true" />
      <style>{`@keyframes skeleton-shimmer { 100% { transform: translateX(100%); } }`}</style>
    </>
  );
}

/** Varias líneas de texto. `lines` = cantidad (default 3). */
export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 rounded ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

/** Tarjeta de carga (avatar opcional + título + texto). */
export function SkeletonCard({ className = '' }) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-5 ${className}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/2 rounded" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

/** Fila de StatCards de carga. `count` = cantidad (default 4). */
export function SkeletonStats({ count = 4, className = '' }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-5 h-28 flex flex-col justify-between"
        >
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-2/3 rounded" />
            <Skeleton className="h-2.5 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tabla de carga. `rows`/`cols` configurables (default 5x4). */
export function SkeletonTable({ rows = 5, cols = 4, className = '' }) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl overflow-hidden ${className}`}
    >
      <div className="flex gap-4 px-5 py-3.5 border-b border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02]">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1 rounded" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-5 py-4 border-b border-slate-50 dark:border-white/5 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-3.5 flex-1 rounded ${c === 0 ? 'max-w-[40%]' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
