'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  iniciales: string;
  roles: string[];
  frentesAsignados?: string[];
  passwordChangeRequired?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  clear: () => void;
}

// Modo revisión interna: NEXT_PUBLIC_ROLES_ENABLED=false → todos los checks de rol pasan.
// Inyectamos todos los roles posibles sobre el usuario para que la UI muestre todo
// sin tocar páginas individuales. El backend hace lo equivalente con ROLES_ENABLED=false.
const ALL_ROLES = ['admin', 'director', 'residente', 'compras', 'caja', 'bodega', 'auditor'];
const rolesEnabled = process.env.NEXT_PUBLIC_ROLES_ENABLED !== 'false';

function maybeExpandRoles(u: AuthUser | null): AuthUser | null {
  if (!u || rolesEnabled) return u;
  return { ...u, roles: ALL_ROLES };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (u) => set({ user: maybeExpandRoles(u) }),
      clear: () => set({ user: null }),
    }),
    {
      name: 'control_obra_user',
      // Cuando rehidratamos desde localStorage, también expandimos los roles
      // por si el flag cambió entre sesiones.
      onRehydrateStorage: () => (state) => {
        if (state?.user) state.user = maybeExpandRoles(state.user);
      },
    },
  ),
);
