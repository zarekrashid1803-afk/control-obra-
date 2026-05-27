'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, setToken, setRefreshToken, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { LogoOrion } from '@/components/logo-orion';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState('juan.mejia@andina.co');
  const [password, setPassword] = useState('password123');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await auth.login(email, password, mfaCode || undefined);
      setToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setUser(data.user);
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        const code = (err.body as any)?.error;
        if (code === 'MFA_REQUIRED') {
          setMfaRequired(true);
          setError('Ingresa el código de tu app de autenticación');
        } else if (code === 'MFA_INVALID') {
          setMfaRequired(true);
          setError('Código de verificación inválido. Intenta de nuevo.');
        } else {
          setError(err.body?.message || `Error ${err.status}`);
        }
      } else {
        setError('No se pudo conectar al servidor');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative">
      <form className="w-full max-w-sm" onSubmit={onSubmit}>
        <div className="mb-10 flex justify-start">
          <LogoOrion className="h-16 w-auto text-navy-900" />
        </div>

        <h2 className="text-2xl font-bold text-navy-900 mb-1">Iniciar sesión</h2>
        <p className="text-sm text-gray-500 mb-8">Ingresa tus credenciales corporativas.</p>

        {error && (
          <div className="mb-5 px-4 py-3 bg-red-50 text-red-800 text-sm rounded border border-red-200">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">
            Correo institucional
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15"
          />
        </div>

        <div className="mb-6">
          <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15"
          />
        </div>

        {mfaRequired && (
          <div className="mb-6">
            <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">
              Código de verificación (2FA)
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              autoFocus
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded text-lg tracking-[6px] text-center font-mono focus:outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15"
            />
            <p className="text-[11px] text-gray-500 mt-1.5">Abre tu app (Google Authenticator, Authy…) e ingresa el código de 6 dígitos.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-navy-900 text-white font-semibold rounded hover:bg-navy-800 transition disabled:opacity-50"
        >
          {loading ? 'Iniciando sesión…' : mfaRequired ? 'Verificar y entrar →' : 'Iniciar sesión →'}
        </button>

        <div className="mt-5 text-center text-[12.5px] text-gray-500">
          ¿Tienes un código de invitación?{' '}
          <a href="/signup" className="text-navy-900 underline font-medium">Crear cuenta</a>
        </div>

        <div className="mt-6 px-4 py-3 bg-gray-50 rounded text-[12px] leading-relaxed">
          <strong className="text-navy-900">Usuarios de prueba</strong> (pwd: <code className="bg-white px-1.5 py-0.5 rounded font-mono text-[11px] text-navy-700">password123</code>)
          <br />
          Director: <code className="text-navy-700">juan.mejia@andina.co</code>
          <br />
          Residente: <code className="text-navy-700">andres.patino@andina.co</code>
          <br />
          Compras: <code className="text-navy-700">sofia.vargas@andina.co</code>
        </div>
      </form>

      <div className="absolute bottom-6 left-0 right-0 text-center text-[11px] text-gray-400 tracking-[2px] uppercase">
        Project by Orion
      </div>
    </div>
  );
}
