'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import { requisiciones, frentes } from '@/lib/api';
import { EstadoBadge } from '@/components/badge';
import { fmtCOP, fmtRelative } from '@/lib/utils';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const reqsQuery = useQuery({
    queryKey: ['requisiciones', 'dashboard'],
    queryFn: () => requisiciones.list({ pageSize: 20 }),
  });

  const frentesQuery = useQuery({
    queryKey: ['frentes'],
    queryFn: () => frentes.list(),
  });

  const pendientes = reqsQuery.data?.data?.filter((r: any) => ['pendiente', 'avalada'].includes(r.estado)) || [];
  const aprobadasHoy = reqsQuery.data?.data?.filter((r: any) => r.estado === 'aprobada').length || 0;
  const enCompras = reqsQuery.data?.data?.filter((r: any) => r.estado === 'compras').length || 0;
  const sobrePresupuesto = frentesQuery.data?.filter((f: any) => Number(f.consumidoCentavos) / Number(f.presupuestoTotalCentavos) > 0.85)?.length || 0;

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="flex md:items-end justify-between mb-4 md:mb-5 gap-3 flex-col md:flex-row">
        <div>
          <div className="text-[11px] text-gray-500 hidden md:flex gap-1.5 mb-1.5">
            <Link href="/" className="text-navy-700 hover:underline">Inicio</Link>
            <span>›</span><span>Dashboard</span>
          </div>
          <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight">
            Buen día, {user?.nombres?.split(' ')[0]}
          </h1>
          <p className="text-[12.5px] md:text-[13px] text-gray-500 mt-1">
            Tienes <strong className="text-navy-900">{pendientes.length}</strong> requisiciones esperando tu acción
          </p>
        </div>
        <div className="hidden md:flex gap-2">
          <button className="btn btn-secondary">📅 Esta semana</button>
          <button className="btn btn-primary">📥 Reporte ejecutivo</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-5">
        <Kpi label="Pendientes" value={String(pendientes.length)} delta="↑ +2 vs ayer" bar="bg-st-pendiente" />
        <Kpi label="Aprobadas hoy" value={String(aprobadasHoy)} delta="$ 48.2M COP" bar="bg-st-aprobada" />
        <Kpi label="En compra" value={String(enCompras)} delta="OCs activas" bar="bg-st-compras" />
        <Kpi label="Frentes en alerta" value={String(sobrePresupuesto)} delta="Sobre presupuesto" bar="bg-st-rechazada" warn />
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        {/* Pendientes */}
        <div className="card">
          <div className="p-3.5 border-b border-gray-200 flex justify-between items-center">
            <div>
              <div className="text-[14px] font-semibold text-navy-900">Requieren tu atención</div>
              <div className="text-[11px] text-gray-500 mt-0.5 hidden md:block">Top requisiciones esperando aprobación</div>
            </div>
            <Link href="/requisiciones" className="btn btn-secondary btn-sm">Ver todas →</Link>
          </div>

          {reqsQuery.isLoading && <Skeleton rows={4} />}

          {/* PC: tabla */}
          {reqsQuery.data && (
            <div className="hidden md:block">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Frente</th>
                    <th>Descripción</th>
                    <th className="!text-right">Monto</th>
                    <th>Estado</th>
                    <th>Hace</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.slice(0, 6).map((r: any) => (
                    <tr key={r.id}>
                      <td className="font-mono text-[11.5px] text-gray-600">{r.codigo}</td>
                      <td><span className="chip">{r.frente?.codigo}</span></td>
                      <td className="max-w-[280px] truncate">{r.descripcion}</td>
                      <td className="text-right tabular-nums font-medium">{fmtCOP(r.totalCentavos)}</td>
                      <td><EstadoBadge estado={r.estado} /></td>
                      <td className="text-[11.5px] text-gray-500">{fmtRelative(r.fechaCreacion)}</td>
                      <td className="text-right">
                        <Link href={`/requisiciones/${r.id}`} className={`btn ${r.estado === 'avalada' ? 'btn-accent' : 'btn-secondary'} btn-sm`}>
                          {r.estado === 'avalada' ? 'Aprobar' : 'Ver'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {pendientes.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-500">No hay pendientes 🎉</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Móvil: cards */}
          {reqsQuery.data && (
            <div className="md:hidden divide-y divide-gray-100">
              {pendientes.slice(0, 6).map((r: any) => (
                <Link key={r.id} href={`/requisiciones/${r.id}`} className="block p-3.5 active:bg-gray-50">
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <span className="font-mono text-[11px] text-gray-500">{r.codigo}</span>
                    <EstadoBadge estado={r.estado} />
                  </div>
                  <div className="text-[14px] font-medium text-navy-900 line-clamp-1">{r.descripcion}</div>
                  <div className="flex justify-between items-center text-[12px] text-gray-500 mt-1.5">
                    <span className="chip text-[10.5px]">{r.frente?.codigo}</span>
                    <span className="font-semibold text-navy-900 tabular-nums">{fmtCOP(r.totalCentavos)}</span>
                  </div>
                </Link>
              ))}
              {pendientes.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-[13px]">No hay pendientes 🎉</div>
              )}
            </div>
          )}
        </div>

        {/* Frentes */}
        <div className="card">
          <div className="p-3.5 border-b border-gray-200">
            <div className="text-[14px] font-semibold text-navy-900">Consumo presupuestal</div>
          </div>
          <div className="p-4 space-y-4">
            {frentesQuery.isLoading && <Skeleton rows={3} />}
            {frentesQuery.data?.map((f: any) => {
              const pct = (Number(f.consumidoCentavos) / Number(f.presupuestoTotalCentavos)) * 100;
              const warn = pct > 85;
              const mid = pct > 70 && !warn;
              return (
                <div key={f.id}>
                  <div className="flex justify-between text-[12.5px] mb-1">
                    <strong>{f.codigo} {f.nombre}</strong>
                    <span className={warn ? 'text-st-rechazada font-semibold' : 'text-gray-500'}>
                      {pct.toFixed(0)}%{warn ? ' ⚠' : ''}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 mb-1">
                    {fmtCOP(f.consumidoCentavos)} / {fmtCOP(f.presupuestoTotalCentavos)}
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded">
                    <div
                      className={`h-full rounded ${warn ? 'bg-st-rechazada' : mid ? 'bg-st-pendiente' : 'bg-st-aprobada'}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta, bar, warn }: { label: string; value: string; delta: string; bar: string; warn?: boolean }) {
  return (
    <div className="kpi !p-3 md:!p-4">
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${bar}`} />
      <div className="kpi-label !text-[10px] md:!text-[11px]">{label}</div>
      <div className={`kpi-value !text-[18px] md:!text-[26px] ${warn ? 'text-st-rechazada' : ''}`}>{value}</div>
      <div className="text-[10px] md:text-[11px] mt-1 text-gray-500 hidden md:block">{delta}</div>
    </div>
  );
}

function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
      ))}
    </div>
  );
}
