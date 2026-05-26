'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { bodega, ordenesCompra } from '@/lib/api';
import { fmtCOP, fmtDate, fmtRelative } from '@/lib/utils';

export default function BodegaPage() {
  const entradasQ = useQuery({
    queryKey: ['bodega-entradas'],
    queryFn: () => bodega.listEntradas({ pageSize: 50 }),
  });

  const ocPendientes = useQuery({
    queryKey: ['oc-pendientes-recepcion'],
    queryFn: () => ordenesCompra.list({ pageSize: 50, estado: 'enviada' }),
  });

  const enTransito = useQuery({
    queryKey: ['oc-en-transito'],
    queryFn: () => ordenesCompra.list({ pageSize: 50, estado: 'en_transito' }),
  });

  const recibidaParcial = useQuery({
    queryKey: ['oc-recibida-parcial'],
    queryFn: () => ordenesCompra.list({ pageSize: 50, estado: 'recibida_parcial' }),
  });

  const ocPorRecibir = [
    ...(ocPendientes.data?.data || []),
    ...(enTransito.data?.data || []),
    ...(recibidaParcial.data?.data || []),
  ];

  const entradas = entradasQ.data?.data || [];

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 flex gap-1.5 mb-1.5">
            <Link href="/dashboard" className="text-navy-700 hover:underline">Inicio</Link>
            <span>›</span><span>Bodega</span>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900 tracking-tight">Bodega Central</h1>
          <p className="text-[13px] text-gray-500 mt-1">Recepción de material vs OC · despacho a frentes</p>
        </div>
        <div className="flex gap-2">
          <Link href="/bodega/salida/nueva" className="btn btn-secondary">📤 Nueva salida a frente</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-5">
        <KpiCard label="OCs por recibir" value={String(ocPorRecibir.length)} bar="bg-st-compras" />
        <KpiCard label="Entradas registradas" value={String(entradas.length)} bar="bg-st-aprobada" />
        <KpiCard label="Recibidas parcialmente" value={String(recibidaParcial.data?.data?.length || 0)} bar="bg-st-pendiente" />
        <KpiCard label="Total recibido (mes)" value={fmtCOP(0n)} bar="bg-gold-500" />
      </div>

      {/* OCs pendientes de recibir */}
      <div className="card mb-5">
        <div className="p-3.5 border-b border-gray-200">
          <div className="text-[14px] font-semibold text-navy-900">OCs pendientes de recepción</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Selecciona una OC enviada al proveedor para registrar la entrada del material</div>
        </div>
        {ocPendientes.isLoading && <div className="p-8 text-center text-gray-500">Cargando…</div>}
        {ocPorRecibir.length === 0 && !ocPendientes.isLoading && (
          <div className="p-8 text-center text-gray-500">No hay OCs pendientes de recepción.</div>
        )}
        {ocPorRecibir.length > 0 && (
          <table className="tbl min-w-[700px]">
            <thead>
              <tr>
                <th>OC</th>
                <th>Proveedor</th>
                <th>Frente</th>
                <th className="!text-right">Items</th>
                <th className="!text-right">Total</th>
                <th>Entrega prometida</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ocPorRecibir.map((o: any) => (
                <tr key={o.id}>
                  <td className="font-mono text-[11.5px] text-gray-600">{o.codigo}</td>
                  <td>{o.proveedor?.razonSocial}</td>
                  <td><span className="chip">{o.frente?.codigo}</span></td>
                  <td className="text-right tabular-nums">{o._count?.items || 0}</td>
                  <td className="text-right tabular-nums font-medium">{fmtCOP(o.totalCentavos)}</td>
                  <td className="text-[12px] text-gray-600">
                    {o.fechaEntregaPrometida ? fmtDate(o.fechaEntregaPrometida) : '—'}
                  </td>
                  <td>
                    <span className={`badge ${
                      o.estado === 'enviada' ? 'badge-avalada'
                      : o.estado === 'en_transito' ? 'badge-compras'
                      : 'badge-pendiente'
                    }`}>{o.estado.replace('_', ' ')}</span>
                  </td>
                  <td className="text-right">
                    <Link href={`/bodega/recepcion/${o.id}`} className="btn btn-accent btn-sm">
                      📥 Recibir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Historial de entradas */}
      <div className="card">
        <div className="p-3.5 border-b border-gray-200">
          <div className="text-[14px] font-semibold text-navy-900">Historial de entradas a bodega</div>
        </div>
        {entradasQ.isLoading && <div className="p-8 text-center text-gray-500">Cargando…</div>}
        {entradas.length === 0 && !entradasQ.isLoading && (
          <div className="p-8 text-center text-gray-500">Aún no hay entradas registradas.</div>
        )}
        {entradas.length > 0 && (
          <table className="tbl min-w-[700px]">
            <thead>
              <tr>
                <th>Código</th>
                <th>Fecha</th>
                <th>OC vinculada</th>
                <th>Proveedor</th>
                <th className="!text-right">Items</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((e: any) => (
                <tr key={e.id} className="!cursor-default hover:!bg-transparent">
                  <td className="font-mono text-[11.5px]">{e.codigo}</td>
                  <td className="text-[12px]">{fmtRelative(e.createdAt)}</td>
                  <td className="font-mono text-[11.5px]">{e.ordenCompra?.codigo}</td>
                  <td>{e.ordenCompra?.proveedor?.razonSocial}</td>
                  <td className="text-right tabular-nums">{e.items?.length || 0}</td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, bar }: { label: string; value: string; bar: string }) {
  return (
    <div className="kpi">
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${bar}`} />
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}
