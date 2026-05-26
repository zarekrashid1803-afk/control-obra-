'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { frentes, requisiciones } from '@/lib/api';
import { fmtCOP, fmtRelative } from '@/lib/utils';

export default function PuntoObraPage() {
  const frentesQ = useQuery({ queryKey: ['frentes'], queryFn: () => frentes.list() });
  const reqsQ = useQuery({ queryKey: ['requisiciones-recientes'], queryFn: () => requisiciones.list({ pageSize: 200 }) });

  const data = frentesQ.data || [];

  // Métricas por frente
  function statsFor(frenteId: string) {
    const reqs = (reqsQ.data?.data || []).filter((r: any) => r.frenteId === frenteId);
    const activas = reqs.filter((r: any) => ['pendiente', 'avalada', 'aprobada', 'compras'].includes(r.estado));
    const recibidas = reqs.filter((r: any) => r.estado === 'recibida');
    const ultima = reqs.sort((a: any, b: any) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())[0];
    return { activas: activas.length, recibidas: recibidas.length, total: reqs.length, ultima };
  }

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="mb-4 md:mb-5 flex justify-between items-end gap-3 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 hidden md:flex gap-1.5 mb-1.5">
            <Link href="/dashboard" className="text-navy-700 hover:underline">Inicio</Link>
            <span>›</span><span>Punto de obra</span>
          </div>
          <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight">
            Punto de obra
          </h1>
          <p className="text-[12.5px] md:text-[13px] text-gray-500 mt-1">
            Estado operacional de cada obra activa · presupuesto, actividad y alertas
          </p>
        </div>
        <Link
          href="/admin/frentes?new=1&returnTo=/punto-obra"
          className="btn btn-primary"
        >
          + Nuevo punto de obra
        </Link>
      </div>

      {frentesQ.isLoading && <div className="card p-8 text-center text-gray-500">Cargando puntos de obra…</div>}

      {data.length === 0 && !frentesQ.isLoading && (
        <div className="card p-10 text-center text-gray-500">
          <div className="text-4xl mb-3">🏗️</div>
          No hay puntos de obra registrados. <Link href="/admin/frentes" className="text-navy-700 underline">Crear el primero →</Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {data.map((f: any) => {
          const pct = (Number(f.consumidoCentavos) / Number(f.presupuestoTotalCentavos)) * 100;
          const warn = pct > 85;
          const mid = pct > 70 && !warn;
          const stats = statsFor(f.id);
          const estado = f.estado;
          return (
            <div key={f.id} className="card overflow-hidden">
              {/* Header con color del frente */}
              <div className="px-4 py-3 text-white" style={{ background: f.colorHex || '#000000' }}>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-mono text-[12px] opacity-80">{f.codigo}</div>
                    <div className="text-[16px] font-semibold leading-tight">{f.nombre}</div>
                    {f.tipoObra && (
                      <div className="text-[10px] uppercase tracking-wider opacity-75 mt-0.5">
                        {f.tipoObra.replace(/_/g, ' ')}
                      </div>
                    )}
                    {f.ubicacion && <div className="text-[11px] opacity-75 mt-1">📍 {f.ubicacion}</div>}
                  </div>
                  <span className={`badge ${estado === 'activo' ? 'badge-aprobada' : estado === 'pausado' ? 'badge-pendiente' : 'badge-borrador'}`} style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
                    {estado}
                  </span>
                </div>
              </div>

              {/* Cuerpo: presupuesto */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex justify-between text-[11.5px] text-gray-500 mb-1">
                  <span>Presupuesto</span>
                  <span className={warn ? 'text-st-rechazada font-bold' : 'text-navy-900 font-semibold'}>{pct.toFixed(0)}%{warn ? ' ⚠' : ''}</span>
                </div>
                <div className="text-[13px] tabular-nums mb-1.5">
                  <span className="font-bold text-navy-900">{fmtCOP(f.consumidoCentavos)}</span>
                  <span className="text-gray-500"> / {fmtCOP(f.presupuestoTotalCentavos)}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div
                    className={`h-full rounded ${warn ? 'bg-st-rechazada' : mid ? 'bg-st-pendiente' : 'bg-st-aprobada'}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                {warn && (
                  <div className="text-[11px] text-st-rechazada mt-2 bg-red-50 px-2 py-1 rounded">
                    ⚠ Cerca del límite — próximas compras requieren autorización adicional
                  </div>
                )}
              </div>

              {/* Stats de actividad */}
              <div className="grid grid-cols-3 divide-x divide-gray-200 text-center border-b border-gray-200">
                <div className="p-3">
                  <div className="text-[11px] text-gray-500 uppercase font-semibold">En curso</div>
                  <div className="text-[18px] font-bold text-navy-900 mt-0.5">{stats.activas}</div>
                </div>
                <div className="p-3">
                  <div className="text-[11px] text-gray-500 uppercase font-semibold">Recibidas</div>
                  <div className="text-[18px] font-bold text-st-aprobada mt-0.5">{stats.recibidas}</div>
                </div>
                <div className="p-3">
                  <div className="text-[11px] text-gray-500 uppercase font-semibold">Total</div>
                  <div className="text-[18px] font-bold text-gray-700 mt-0.5">{stats.total}</div>
                </div>
              </div>

              {/* Última actividad */}
              {stats.ultima && (
                <div className="p-3 bg-gray-50 text-[11.5px] text-gray-600">
                  Última actividad: <strong>{fmtRelative(stats.ultima.fechaCreacion)}</strong>
                  <div className="text-[10.5px] text-gray-500 mt-0.5 line-clamp-1">
                    {stats.ultima.codigo} · {stats.ultima.descripcion}
                  </div>
                </div>
              )}

              {/* Responsable + acciones */}
              <div className="p-3 flex items-center justify-between gap-2 border-t border-gray-100">
                <div className="flex items-center gap-2 text-[11.5px]">
                  {f.responsable ? (
                    <>
                      <span className="avatar w-6 h-6 text-[10px]">
                        {(f.responsable.nombres?.[0] || '') + (f.responsable.apellidos?.[0] || '')}
                      </span>
                      <span className="text-gray-700">{f.responsable.nombres}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">Sin responsable asignado</span>
                  )}
                </div>
                <Link href={`/requisiciones?frenteId=${f.id}`} className="btn btn-secondary btn-sm">
                  Ver requisiciones →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
