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
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[1fr_1.2fr]">
      {/* Hero panel */}
      <div className="bg-gradient-to-br from-navy-900 to-navy-700 text-white p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gold-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 bg-gold-500 text-navy-900 rounded-lg grid place-items-center font-mono font-bold text-xl">CO</div>
          <div>
            <div className="text-xl font-semibold">Control de Obra</div>
            <div className="text-[10.5px] text-gold-500 tracking-[2px] font-medium">CONSTRUCTORA ANDINA</div>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight mb-4">
            Cada peso, cada material, cada decisión. <span className="text-gold-500">Trazable.</span>
          </h1>
          <p className="text-base text-white/85 leading-relaxed">
            Un sistema único para toda la cadena de abastecimiento de sus proyectos constructivos —
            desde la requisición en el frente hasta el cierre contable.
          </p>
        </div>
        <div className="relative text-[11px] text-white/40">
          © 2026 · Confidencial · Sistema Integral de Gestión y Control de Obra
        </div>
      </div>

      {/* Form */}
      <div className="bg-white grid place-items-center p-12">
        <form className="w-full max-w-sm" onSubmit={onSubmit}>
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
            className="w-full py-3 bg-navy-700 text-white font-semibold rounded hover:bg-navy-800 transition disabled:opacity-50"
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
      </div>
    </div>
  );
}
