'use client';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('GLOBAL ERROR:', error);
  }, [error]);

  return (
    <html lang="es-CO">
      <body style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#f5f6f7', margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 32, maxWidth: 640, width: '100%' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#000', marginBottom: 8 }}>
            Algo falló al cargar la app
          </h1>
          <p style={{ fontSize: 13, color: '#4a4d4e', marginBottom: 16 }}>
            Detalle técnico capturado abajo. Compartilo para diagnosticar.
          </p>
          <pre style={{ background: '#f5f6f7', padding: 12, borderRadius: 6, fontSize: 11, color: '#b91c1c', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 16, maxHeight: 240, overflow: 'auto' }}>
            {error.message}
            {error.stack && '\n\n' + error.stack.split('\n').slice(0, 10).join('\n')}
            {error.digest && '\n\nDigest: ' + error.digest}
          </pre>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{ background: '#000', color: '#fff', padding: '10px 16px', border: 0, borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
              Reintentar
            </button>
            <a href="/login" style={{ background: '#fff', color: '#000', padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: 6, fontWeight: 500, textDecoration: 'none' }}>
              Volver al login
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
