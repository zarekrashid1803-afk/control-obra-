'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { promoCodes, setToken, setRefreshToken, ApiError, type Sector } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { LogoOrion } from '@/components/logo-orion';

export default function SignupPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const submitting = useRef(false);

  const [step, setStep] = useState<'sector' | 'datos'>('sector');
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [sectoresLoading, setSectoresLoading] = useState(true);
  const [form, setForm] = useState({
    codigo: '',
    email: '',
    password: '',
    nombres: '',
    apellidos: '',
    nombreConstructora: '',
    sectorId: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    promoCodes.sectores()
      .then((s) => setSectores(s))
      .catch(() => {})
      .finally(() => setSectoresLoading(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      const data = await promoCodes.signup({
        ...form,
        codigo: form.codigo.toUpperCase().trim(),
        sectorId: form.sectorId || undefined,
      });
      setToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setUser(data.user);
      router.push('/onboarding');
    } catch (err) {
      if (err instanceof ApiError) setError(err.body?.message || `Error ${err.status}`);
      else setError('No se pudo conectar al servidor');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm({ ...form, [k]: v });
  }

  const sectorSeleccionado = sectores.find((s) => s.id === form.sectorId);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex justify-start">
          <LogoOrion className="h-14 w-auto text-navy-900" />
        </div>

        {step === 'sector' && (
          <>
            <h2 className="text-2xl font-bold text-navy-900 mb-1">Elige tu sector</h2>
            <p className="text-sm text-gray-500 mb-6">
              La app se adapta al tipo de obras u operaciones de tu empresa.
            </p>

            {sectoresLoading ? (
              <div className="card p-8 text-center text-gray-500">Cargando sectores…</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {sectores.map((s) => {
                  const active = form.sectorId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setForm({ ...form, sectorId: s.id })}
                      className={`text-left p-4 rounded-lg border-2 transition ${
                        active
                          ? 'border-navy-900 bg-gray-50'
                          : 'border-gray-200 hover:border-navy-500'
                      }`}
                    >
                      <div className="text-2xl mb-2">{s.iconEmoji}</div>
                      <div className="font-semibold text-[13.5px] text-navy-900 leading-tight">{s.nombre}</div>
                      {s.descripcion && (
                        <div className="text-[11px] text-gray-500 mt-1 leading-snug">{s.descripcion}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => setStep('datos')}
              disabled={!form.sectorId}
              className="w-full py-3 bg-navy-900 text-white font-semibold rounded hover:bg-navy-800 disabled:opacity-50"
            >
              Continuar →
            </button>

            <div className="mt-5 text-center text-[12.5px] text-gray-500">
              ¿Ya tienes cuenta? <Link href="/login" className="text-navy-900 underline">Inicia sesión</Link>
            </div>
          </>
        )}

        {step === 'datos' && (
          <form className="w-full max-w-md" onSubmit={onSubmit}>
            <button
              type="button"
              onClick={() => setStep('sector')}
              className="text-[12px] text-gray-500 hover:text-navy-900 mb-4"
            >
              ← Cambiar sector
            </button>

            <h2 className="text-2xl font-bold text-navy-900 mb-1">Crear cuenta</h2>
            <p className="text-sm text-gray-500 mb-5">
              Sector: <strong className="text-navy-900">{sectorSeleccionado?.iconEmoji} {sectorSeleccionado?.nombre}</strong>
            </p>

            {error && (
              <div className="mb-5 px-4 py-3 bg-red-50 text-red-800 text-sm rounded border border-red-200">{error}</div>
            )}

            <Field label="Código de invitación *">
              <input
                value={form.codigo}
                onChange={(e) => set('codigo', e.target.value.toUpperCase())}
                required
                autoComplete="off"
                placeholder="PRE-XXXX"
                className="input font-mono tracking-wider"
              />
            </Field>

            <Field label="Nombre de la empresa *">
              <input value={form.nombreConstructora} onChange={(e) => set('nombreConstructora', e.target.value)} required className="input" placeholder="Tu empresa S.A.S." />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombres *">
                <input value={form.nombres} onChange={(e) => set('nombres', e.target.value)} required className="input" placeholder="Juan" />
              </Field>
              <Field label="Apellidos *">
                <input value={form.apellidos} onChange={(e) => set('apellidos', e.target.value)} required className="input" placeholder="Pérez" />
              </Field>
            </div>

            <Field label="Correo *">
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required autoComplete="email" className="input" placeholder="tu@correo.com" />
            </Field>

            <Field label="Contraseña *">
              <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required autoComplete="new-password" minLength={8} className="input" placeholder="Mínimo 8 caracteres" />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-3 bg-navy-900 text-white font-semibold rounded hover:bg-navy-800 transition disabled:opacity-50"
            >
              {loading ? 'Creando cuenta…' : 'Crear cuenta y activar prueba →'}
            </button>

            <div className="mt-5 text-center text-[12.5px] text-gray-500">
              ¿Ya tienes cuenta? <Link href="/login" className="text-navy-900 underline">Inicia sesión</Link>
            </div>

            <div className="mt-6 px-4 py-3 bg-gray-50 rounded text-[12px] leading-relaxed text-gray-600">
              Al crear la cuenta activas <strong className="text-navy-900">120 horas (5 días)</strong> de
              acceso completo. Después del periodo tus datos quedan guardados.
            </div>
          </form>
        )}

        <div className="absolute bottom-6 left-0 right-0 text-center text-[11px] text-gray-400 tracking-[2px] uppercase">
          Project by Orion
        </div>
      </div>
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
