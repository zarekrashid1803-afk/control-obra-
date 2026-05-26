'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Datos considerados frescos por 5 min — no refetch al cambiar de tab
            staleTime: 5 * 60_000,
            // Cache retenido en memoria por 30 min después de quedar sin uso
            gcTime: 30 * 60_000,
            retry: 1,
            // No refetch automático cuando vuelves a montar el componente
            // (cambia el comportamiento default que era refetch agresivo)
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            // Sí refetch al reconectarse si se perdió la red
            refetchOnReconnect: 'always',
          },
          mutations: {
            // Reintentar mutations una sola vez si fallan
            retry: 0,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={qc}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
