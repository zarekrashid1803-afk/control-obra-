/**
 * Opciones predefinidas de TanStack Query según el tipo de dato.
 *
 * - CATALOGO (frentes, proveedores, materiales): cambian raramente,
 *   staleTime 30 min para que casi nunca se refetcheen al cambiar de pestaña.
 *
 * - LISTAS (requisiciones, OCs, etc.): cambian más seguido pero no en tiempo real,
 *   staleTime 2 min.
 *
 * - DETALLE (una requisición específica): si el usuario acaba de interactuar,
 *   queremos que se refetchee si algo cambió. staleTime 1 min.
 *
 * Para forzar un refetch en cualquier momento usa `queryClient.invalidateQueries({ queryKey: ... })`.
 */

export const queryOptions = {
  catalogo: {
    staleTime: 30 * 60_000,   // 30 min
    gcTime: 60 * 60_000,      // 1 h
    refetchOnMount: false as const,
    refetchOnWindowFocus: false as const,
  },
  lista: {
    staleTime: 2 * 60_000,    // 2 min
    gcTime: 30 * 60_000,
    refetchOnMount: false as const,
  },
  detalle: {
    staleTime: 60_000,        // 1 min
    gcTime: 30 * 60_000,
    refetchOnMount: false as const,
  },
};
