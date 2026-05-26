'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, setToken, setRefreshToken, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState('juan.mejia@andina.co');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await auth.login(email, password);
      setToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setUser(data.user);
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.message || `Error ${err.status}`);
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
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 bg-navy-900 text-white rounded-lg grid place-items-center font-mono font-bold text-xl">CO</div>
          <div>
            <div className="text-lg font-semibold text-navy-900">Control de Obra</div>
            <div className="text-[10.5px] text-gray-500 tracking-[2px] font-medium">CONSTRUCTORA ANDINA</div>
          </div>
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

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-navy-900 text-white font-semibold rounded hover:bg-navy-800 transition disabled:opacity-50"
        >
          {loading ? 'Iniciando sesión…' : 'Iniciar sesión →'}
        </button>

        <div className="mt-8 px-4 py-3 bg-gray-50 rounded text-[12px] leading-relaxed">
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
