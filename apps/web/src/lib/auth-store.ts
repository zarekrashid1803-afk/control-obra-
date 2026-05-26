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
}

interface AuthState {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (u) => set({ user: u }),
      clear: () => set({ user: null }),
    }),
    { name: 'control_obra_user' },
  ),
);
