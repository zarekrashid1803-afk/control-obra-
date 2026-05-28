'use client';
import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { auth, ApiError } from '@/lib/api';
import { LogoOrion } from '@/components/logo-orion';

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
    if (password !== confirm) return setError('Las contraseñas no coinciden');
    setLoading(true);
    try {
      await auth.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message || `Error ${err.status}` : 'No se pudo conectar al servidor');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-navy-900 mb-1">Enlace inválido</h2>
        <p className="text-sm text-gray-500 mb-6">Falta el token de recuperación. Solicita un enlace nuevo.</p>
        <a href="/forgot-password" className="text-[13px] text-navy-700 underline font-medium">Solicitar enlace</a>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-navy-900 mb-1">Contraseña actualizada ✓</h2>
        <p className="text-sm text-gray-500 mb-6">Ya puedes iniciar sesión con tu nueva contraseña. Redirigiendo…</p>
        <a href="/login" className="text-[13px] text-navy-700 underline font-medium">Ir a iniciar sesión</a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <h2 className="text-2xl font-bold text-navy-900 mb-1">Nueva contraseña</h2>
      <p className="text-sm text-gray-500 mb-8">Crea una contraseña nueva para tu cuenta.</p>

      {error && (
        <div className="mb-5 px-4 py-3 bg-red-50 text-red-800 text-sm rounded border border-red-200">{error}</div>
      )}

      <div className="mb-4">
        <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">
          Nueva contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          autoFocus
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15"
        />
      </div>

      <div className="mb-6">
        <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">
          Confirmar contraseña
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-navy-900 text-white font-semibold rounded hover:bg-navy-800 transition disabled:opacity-50"
      >
        {loading ? 'Guardando…' : 'Cambiar contraseña →'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-start">
          <LogoOrion className="h-16 w-auto text-navy-900" />
        </div>
        <Suspense fallback={<div className="text-gray-500 text-sm">Cargando…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
      <div className="absolute bottom-6 left-0 right-0 text-center text-[11px] text-gray-400 tracking-[2px] uppercase">
        Project by Orion
      </div>
    </div>
  );
}
