'use client';
import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Error capturado por boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="card p-8 max-w-2xl w-full">
        <div className="text-4xl mb-3">⚠️</div>
        <h1 className="text-xl font-bold text-navy-900 mb-2">Algo falló al cargar esta sección</h1>
        <p className="text-[13px] text-gray-600 mb-4">
          Captamos el error para diagnosticarlo. Mientras tanto, podés intentar recargar o volver al dashboard.
        </p>

        <details className="mb-5 bg-gray-50 p-3 rounded text-[12px]">
          <summary className="cursor-pointer font-semibold text-navy-900">Detalle técnico</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words text-red-700 text-[11px]">
            {error.message}
            {error.stack && (
              <>
                {'\n\n'}
                {error.stack.split('\n').slice(0, 8).join('\n')}
              </>
            )}
            {error.digest && `\n\nDigest: ${error.digest}`}
          </pre>
        </details>

        <div className="flex gap-2">
          <button onClick={reset} className="btn btn-primary">Reintentar</button>
          <Link href="/dashboard" className="btn btn-secondary">Ir al dashboard</Link>
        </div>
      </div>
    </div>
  );
}
