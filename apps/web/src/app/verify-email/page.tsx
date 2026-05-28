'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { auth, getApiErrorMessage } from '@/lib/api';
import { LogoOrion } from '@/components/logo-orion';

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'notoken'>('loading');
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // evitar doble llamada en StrictMode
    ran.current = true;
    if (!token) {
      setState('notoken');
      return;
    }
    auth
      .verifyEmail(token)
      .then(() => setState('ok'))
      .catch((e) => {
        setError(getApiErrorMessage(e, 'No se pudo verificar el correo'));
        setState('error');
      });
  }, [token]);

  if (state === 'loading') return <div className="text-sm text-gray-500">Verificando…</div>;

  if (state === 'ok')
    return (
      <div>
        <h2 className="text-2xl font-bold text-navy-900 mb-1">Correo verificado ✓</h2>
        <p className="text-sm text-gray-500 mb-6">Tu correo quedó confirmado. Ya puedes usar todas las funciones.</p>
        <a href="/dashboard" className="text-[13px] text-navy-700 underline font-medium">Ir al inicio →</a>
      </div>
    );

  if (state === 'notoken')
    return (
      <div>
        <h2 className="text-2xl font-bold text-navy-900 mb-1">Enlace inválido</h2>
        <p className="text-sm text-gray-500 mb-6">Falta el token de verificación.</p>
        <a href="/dashboard" className="text-[13px] text-navy-700 underline font-medium">Ir al inicio</a>
      </div>
    );

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy-900 mb-1">No se pudo verificar</h2>
      <p className="text-sm text-red-700 mb-6">{error}</p>
      <p className="text-[12.5px] text-gray-500 mb-4">El enlace pudo expirar (dura 24h) o ya fue usado. Pide uno nuevo desde el aviso en la app.</p>
      <a href="/dashboard" className="text-[13px] text-navy-700 underline font-medium">Ir al inicio</a>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-start">
          <LogoOrion className="h-16 w-auto text-navy-900" />
        </div>
        <Suspense fallback={<div className="text-gray-500 text-sm">Cargando…</div>}>
          <VerifyEmailInner />
        </Suspense>
      </div>
      <div className="absolute bottom-6 left-0 right-0 text-center text-[11px] text-gray-400 tracking-[2px] uppercase">
        Project by Orion
      </div>
    </div>
  );
}
