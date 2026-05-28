'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { auth } from '@/lib/api';

/**
 * Aviso no intrusivo cuando el correo del usuario no está verificado.
 * Consulta el estado fresco del backend (no del store, que podría estar viejo).
 * Permite reenviar el correo de verificación. Si no hay Resend configurado, el
 * backend igual responde ok (el envío se omite del lado servidor).
 */
export function EmailVerifyBanner() {
  const statusQ = useQuery({
    queryKey: ['email-status'],
    queryFn: () => auth.emailStatus(),
    staleTime: 5 * 60 * 1000,
  });
  const [sent, setSent] = useState(false);
  const reenviar = useMutation({
    mutationFn: () => auth.resendVerification(),
    onSuccess: () => setSent(true),
  });

  // No mostrar nada si carga, falla, o el correo ya está verificado.
  if (!statusQ.data || statusQ.data.emailVerificado) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-[12.5px] text-amber-900 flex items-center gap-3 flex-wrap">
      <span>✉️ Verifica tu correo para asegurar tu cuenta.</span>
      {sent ? (
        <span className="font-medium text-amber-800">Correo de verificación enviado.</span>
      ) : (
        <button
          onClick={() => reenviar.mutate()}
          disabled={reenviar.isPending}
          className="font-semibold underline hover:text-amber-700 disabled:opacity-50"
        >
          {reenviar.isPending ? 'Enviando…' : 'Reenviar correo'}
        </button>
      )}
    </div>
  );
}
