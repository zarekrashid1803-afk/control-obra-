'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auth, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function SeguridadPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const statusQ = useQuery({ queryKey: ['mfa-status'], queryFn: () => auth.mfaStatus() });

  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const iniciarSetup = useMutation({
    mutationFn: () => auth.mfaSetup(),
    onSuccess: (data) => { setSetup({ qrDataUrl: data.qrDataUrl, secret: data.secret }); setError(null); },
    onError: (e) => setError(e instanceof ApiError ? e.body?.message || e.message : 'Error'),
  });

  const activar = useMutation({
    mutationFn: () => auth.mfaEnable(code),
    onSuccess: () => { setSetup(null); setCode(''); setError(null); qc.invalidateQueries({ queryKey: ['mfa-status'] }); },
    onError: (e) => setError(e instanceof ApiError ? e.body?.message || e.message : 'Código inválido'),
  });

  const desactivar = useMutation({
    mutationFn: () => auth.mfaDisable(code),
    onSuccess: () => { setCode(''); setError(null); qc.invalidateQueries({ queryKey: ['mfa-status'] }); },
    onError: (e) => setError(e instanceof ApiError ? e.body?.message || e.message : 'Código inválido'),
  });

  const enabled = statusQ.data?.mfaEnabled;
  const roles = user?.roles || [];
  const recomendado = roles.some((r) => ['director', 'caja', 'admin'].includes(r));

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8">
      <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight">Seguridad</h1>
      <p className="text-[12.5px] md:text-[13px] text-gray-500 mt-1 mb-6">
        Verificación en dos pasos (2FA) para proteger tu cuenta.
      </p>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 text-red-800 text-sm rounded border border-red-200">{error}</div>
      )}

      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="text-[15px] font-semibold text-navy-900">Autenticación de dos factores (TOTP)</div>
            <div className="text-[12.5px] text-gray-500 mt-1">
              Usa una app como Google Authenticator, Authy o 1Password.
            </div>
          </div>
          <span className={`badge ${enabled ? 'badge-aprobada' : 'badge-borrador'}`}>
            {enabled ? 'Activado' : 'Desactivado'}
          </span>
        </div>

        {recomendado && !enabled && (
          <div className="my-3 px-3 py-2 bg-amber-50 text-amber-800 text-[12.5px] rounded border border-amber-200">
            ⚠ Tu rol maneja dinero o aprobaciones. Se recomienda fuertemente activar 2FA.
          </div>
        )}

        {/* ESTADO: desactivado, sin setup en curso */}
        {!enabled && !setup && (
          <button onClick={() => iniciarSetup.mutate()} disabled={iniciarSetup.isPending} className="btn btn-primary mt-3">
            {iniciarSetup.isPending ? 'Generando…' : 'Activar 2FA'}
          </button>
        )}

        {/* ESTADO: setup en curso → mostrar QR + pedir código */}
        {!enabled && setup && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="text-[13px] font-medium text-navy-900 mb-2">1. Escanea este QR con tu app</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrDataUrl} alt="QR 2FA" className="w-44 h-44 border border-gray-200 rounded" />
            <div className="text-[11px] text-gray-500 mt-2">
              ¿No puedes escanear? Ingresa esta clave manualmente:
              <code className="block mt-1 bg-gray-50 px-2 py-1 rounded font-mono text-[11px] break-all">{setup.secret}</code>
            </div>

            <div className="text-[13px] font-medium text-navy-900 mt-4 mb-2">2. Ingresa el código de 6 dígitos</div>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                className="input font-mono tracking-[4px] text-center !w-40"
              />
              <button onClick={() => activar.mutate()} disabled={activar.isPending || code.length !== 6} className="btn btn-primary">
                {activar.isPending ? 'Verificando…' : 'Confirmar'}
              </button>
              <button onClick={() => { setSetup(null); setCode(''); }} className="btn btn-secondary">Cancelar</button>
            </div>
          </div>
        )}

        {/* ESTADO: activado → permitir desactivar con código */}
        {enabled && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="text-[13px] text-gray-600 mb-2">Para desactivar, ingresa un código actual de tu app:</div>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                className="input font-mono tracking-[4px] text-center !w-40"
              />
              <button onClick={() => desactivar.mutate()} disabled={desactivar.isPending || code.length !== 6} className="btn btn-secondary text-st-rechazada border-red-200">
                {desactivar.isPending ? 'Desactivando…' : 'Desactivar 2FA'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
