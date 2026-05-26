/**
 * Skeleton genérico que se muestra al instante mientras Next.js carga la ruta.
 * Evita que la pantalla quede en blanco entre clicks de navegación.
 */
export default function AppLoading() {
  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8 animate-pulse">
      {/* Page header skeleton */}
      <div className="mb-5">
        <div className="h-3 bg-gray-200 rounded w-24 mb-2 hidden md:block" />
        <div className="h-7 bg-gray-200 rounded w-72 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-96" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card !p-3 md:!p-4">
            <div className="h-2.5 bg-gray-200 rounded w-20 mb-3" />
            <div className="h-7 bg-gray-300 rounded w-16" />
            <div className="h-2 bg-gray-100 rounded w-24 mt-2 hidden md:block" />
          </div>
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="card">
        <div className="p-3.5 border-b border-gray-200">
          <div className="h-4 bg-gray-200 rounded w-48" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
