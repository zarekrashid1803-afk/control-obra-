'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { auth, promoCodes, setToken, setRefreshToken } from '@/lib/api';
import { LogoOrion } from '@/components/logo-orion';

const SOPORTE_WHATSAPP = process.env.NEXT_PUBLIC_SOPORTE_WHATSAPP || '+573000000000';
const SOPORTE_EMAIL = process.env.NEXT_PUBLIC_SOPORTE_EMAIL || 'soporte@control-obra.co';

export default function TrialExpiredPage() {
  const [tenantNombre, setTenantNombre] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  useEffect(() => {
    promoCodes.status().then((s) => {
      setTenantNombre(s.tenantNombre);
      setTrialEndsAt(s.trialEndsAt);
    }).catch(() => {});
  }, []);

  async function cerrarSesion() {
    try { await auth.logout(); } catch {}
    setToken(null);
    setRefreshToken(null);
    window.location.href = '/login';
  }

  const wsMessage = encodeURIComponent(
    `Hola, soy de ${tenantNombre || 'una empresa'}. Mi periodo de prueba de Control de Obra venció y quisiera extender el acceso.`,
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <LogoOrion className="h-12 w-auto text-navy-900" />
        </div>

        <div className="card p-8 text-center">
          <div className="text-5xl mb-3">⏱️</div>
          <h1 className="text-2xl font-bold text-navy-900 mb-2">Periodo de prueba vencido</h1>
          {tenantNombre && <p className="text-[13px] text-gray-500 mb-2">{tenantNombre}</p>}
          {trialEndsAt && (
            <p className="text-[12px] text-gray-500 mb-4">
              Venció el {new Date(trialEndsAt).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
          )}

          <p className="text-[14px] text-gray-700 mb-6 leading-relaxed">
            Tus datos están <strong>seguros</strong>. Las lecturas siguen funcionando,
            pero ninguna operación nueva se puede registrar hasta extender el acceso.
          </p>

          <div className="flex flex-col gap-2.5 mb-6">
            <a
              href={`https://wa.me/${SOPORTE_WHATSAPP.replace(/\D/g, '')}?text=${wsMessage}`}
              target="_blank"
              rel="noopener"
              className="w-full py-3 bg-emerald-600 text-white font-semibold rounded hover:bg-emerald-700 transition"
            >
              💬 Hablar por WhatsApp
            </a>
            <a
              href={`mailto:${SOPORTE_EMAIL}?subject=Extender%20acceso%20Control%20de%20Obra`}
              className="w-full py-3 bg-white border border-gray-300 text-navy-900 font-medium rounded hover:bg-gray-50 transition"
            >
              ✉ {SOPORTE_EMAIL}
            </a>
          </div>

          <div className="text-left bg-gray-50 rounded p-4 text-[12.5px] text-gray-600 mb-4">
            <strong className="text-navy-900 text-[13px]">Qué quedó bloqueado:</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Crear / aprobar requisiciones</li>
              <li>Generar órdenes de compra</li>
              <li>Registrar movimientos de caja menor</li>
              <li>Entradas y salidas de bodega</li>
              <li>Subir documentos soporte y fotos</li>
            </ul>
            <div className="mt-3 text-[12px] text-gray-500">
              ✓ Consultar dashboards, reportes y datos históricos sigue activo.
            </div>
          </div>

          <button
            onClick={cerrarSesion}
            className="text-[12.5px] text-gray-500 underline hover:text-navy-900"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="mt-6 text-center text-[11px] text-gray-400 tracking-[2px] uppercase">
          Project by Orion
        </div>
        <div className="mt-2 text-center text-[11px] text-gray-400">
          <Link href="/privacy" className="hover:underline">Privacidad</Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="hover:underline">Términos</Link>
        </div>
      </div>
    </div>
  );
}
