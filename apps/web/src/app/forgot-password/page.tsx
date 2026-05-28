'use client';
import { useState } from 'react';
import { auth, ApiError } from '@/lib/api';
import { LogoOrion } from '@/components/logo-orion';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await auth.forgotPassword(email);
      // Respuesta siempre ok (no revelamos si el email existe).
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message || `Error ${err.status}` : 'No se pudo conectar al servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-start">
          <LogoOrion className="h-16 w-auto text-navy-900" />
        </div>

        {sent ? (
          <div>
            <h2 className="text-2xl font-bold text-navy-900 mb-1">Revisa tu correo</h2>
            <p className="text-sm text-gray-500 mb-6">
              Si <strong>{email}</strong> está registrado, te enviamos un enlace para restablecer tu contraseña.
              El enlace expira en 1 hora.
            </p>
            <a href="/login" className="text-[13px] text-navy-700 underline font-medium">← Volver a iniciar sesión</a>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <h2 className="text-2xl font-bold text-navy-900 mb-1">Recuperar contraseña</h2>
            <p className="text-sm text-gray-500 mb-8">Te enviaremos un enlace a tu correo para crear una nueva.</p>

            {error && (
              <div className="mb-5 px-4 py-3 bg-red-50 text-red-800 text-sm rounded border border-red-200">{error}</div>
            )}

            <div className="mb-6">
              <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">
                Correo institucional
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-navy-900 text-white font-semibold rounded hover:bg-navy-800 transition disabled:opacity-50"
            >
              {loading ? 'Enviando…' : 'Enviar enlace →'}
            </button>

            <div className="mt-5 text-center text-[12.5px] text-gray-500">
              <a href="/login" className="text-navy-900 underline font-medium">← Volver a iniciar sesión</a>
            </div>
          </form>
        )}
      </div>

      <div className="absolute bottom-6 left-0 right-0 text-center text-[11px] text-gray-400 tracking-[2px] uppercase">
        Project by Orion
      </div>
    </div>
  );
}
