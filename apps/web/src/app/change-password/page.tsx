'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, setToken, setRefreshToken } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { LogoOrion } from '@/components/logo-orion';

export default function ChangePasswordPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }
    if (newPassword.length < 8) {
      setError('La contraseña nueva debe tener al menos 8 caracteres');
      return;
    }
    setLoading(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      // El backend revoca todas las sesiones. Hacemos logout local y mandamos al login con un flash.
      setToken(null);
      setRefreshToken(null);
      setUser(null);
      router.replace('/login?changed=1');
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message || err.message : 'Error');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <form className="w-full max-w-sm" onSubmit={onSubmit}>
        <div className="mb-8 flex justify-start">
          <LogoOrion className="h-12 w-auto text-navy-900" />
        </div>

        <h2 className="text-2xl font-bold text-navy-900 mb-1">Cambiar contraseña</h2>
        <p className="text-sm text-gray-500 mb-6">
          Por seguridad, debes establecer una contraseña personal antes de continuar.
        </p>

        {user && (
          <div className="mb-5 px-3 py-2 bg-gray-50 text-[12.5px] text-gray-700 rounded">
            Sesión: <strong>{user.email}</strong>
          </div>
        )}

        {error && (
          <div className="mb-5 px-4 py-3 bg-red-50 text-red-800 text-sm rounded border border-red-200">{error}</div>
        )}

        <Field label="Contraseña actual">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="input"
          />
        </Field>

        <Field label="Contraseña nueva (mínimo 8 caracteres)">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
          />
        </Field>

        <Field label="Confirmar contraseña nueva">
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
          />
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-4 py-3 bg-navy-900 text-white font-semibold rounded hover:bg-navy-800 transition disabled:opacity-50"
        >
          {loading ? 'Guardando…' : 'Cambiar contraseña →'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
