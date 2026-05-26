'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { requisiciones, frentes } from '@/lib/api';
import { EstadoBadge } from '@/components/badge';
import { fmtCOP, fmtRelative, ESTADO_LABEL } from '@/lib/utils';
import { ESTADOS_REQUISICION } from '@control-obra/shared';

export default function BandejaPage() {
  const [estado, setEstado] = useState<string>('');
  const [frenteId, setFrenteId] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const filters = {
    ...(estado ? { estado } : {}),
    ...(frenteId ? { frenteId } : {}),
    ...(search ? { search } : {}),
    pageSize: 50,
  };

  const reqs = useQuery({
    queryKey: ['requisiciones', filters],
    queryFn: () => requisiciones.list(filters),
  });

  const frentesQuery = useQuery({
    queryKey: ['frentes'],
    queryFn: () => frentes.list(),
  });

  const data = reqs.data?.data || [];
  const total = reqs.data?.pagination?.total || 0;
  const pendientes = data.filter((r: any) => ['pendiente', 'avalada'].includes(r.estado));
  const enCompras = data.filter((r: any) => r.estado === 'compras');
  const aprobadas = data.filter((r: any) => r.estado === 'aprobada');

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="flex md:items-end justify-between mb-4 md:mb-5 gap-3 flex-col md:flex-row">
        <div>
          <div className="text-[11px] text-gray-500 hidden md:flex gap-1.5 mb-1.5">
            <Link href="/dashboard" className="text-navy-700 hover:underline">Inicio</Link>
            <span>›</span><span>Requisiciones</span>
          </div>
          <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight">Bandeja de Requisiciones</h1>
          <p className="text-[12.5px] md:text-[13px] text-gray-500 mt-1">Gestión y aprobación de solicitudes</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary hidden md:inline-flex">📥 Exportar</button>
          <Link href="/requisiciones/nueva" className="btn btn-primary flex-1 md:flex-initial justify-center">+ Nueva requisición</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-5">
        <KpiCard label="Pendientes" value={String(pendientes.length)} bar="bg-st-pendiente" />
        <KpiCard label="Aprobadas" value={String(aprobadas.length)} bar="bg-st-aprobada" />
        <KpiCard label="En compras" value={String(enCompras.length)} bar="bg-st-compras" />
        <KpiCard label="Total" value={String(total)} bar="bg-navy-700" />
      </div>

      <div className="card">
        <div className="p-3 border-b border-gray-200 flex gap-2 flex-wrap items-center">
          <div className="flex-1 min-w-[200px] flex items-center gap-1.5 border border-gray-300 rounded px-2.5 bg-white">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 outline-none py-2 text-[13px] w-full"
            />
          </div>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="px-2.5 py-2 border border-gray-300 rounded text-[12.5px] bg-white">
            <option value="">Estado</option>
            {ESTADOS_REQUISICION.map((s) => <option key={s} value={s}>{ESTADO_LABEL[s] || s}</option>)}
          </select>
          <select value={frenteId} onChange={(e) => setFrenteId(e.target.value)} className="px-2.5 py-2 border border-gray-300 rounded text-[12.5px] bg-white">
            <option value="">Frente</option>
            {frentesQuery.data?.map((f: any) => (
              <option key={f.id} value={f.id}>{f.codigo}</option>
            ))}
          </select>
        </div>

        {reqs.isLoading && <div className="p-8 text-center text-gray-500">Cargando…</div>}

        {/* PC: tabla */}
        {reqs.data && data.length > 0 && (
          <div className="hidden md:block">
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Frente</th>
                  <th>Solicitante</th>
                  <th>Descripción</th>
                  <th>Items</th>
                  <th className="!text-right">Monto</th>
                  <th>Estado</th>
                  <th>Antigüedad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((r: any) => (
                  <tr key={r.id}>
                    <td className="font-mono text-[11.5px] text-gray-600">{r.codigo}</td>
                    <td><span className="chip">{r.frente?.codigo}</span></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="avatar w-6 h-6 text-[10px]">{r.solicitante?.iniciales}</span>
                        <span className="text-[12.5px]">{r.solicitante?.nombres}</span>
                      </div>
                    </td>
                    <td className="max-w-[300px] truncate">{r.descripcion} {r.sobrePresupuesto && '⚠'}</td>
                    <td className="text-[11.5px] text-gray-500">{r._count?.items || r.itemCount || 0}</td>
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
              </tbody>
            </table>
          </div>
        )}

        {/* Móvil: cards */}
        {reqs.data && data.length > 0 && (
          <div className="md:hidden divide-y divide-gray-100">
            {data.map((r: any) => (
              <Link key={r.id} href={`/requisiciones/${r.id}`} className="block p-3.5 active:bg-gray-50">
                <div className="flex justify-between items-start gap-2 mb-1.5">
                  <span className="font-mono text-[11px] text-gray-500">{r.codigo}</span>
                  <EstadoBadge estado={r.estado} />
                </div>
                <div className="text-[14px] font-medium text-navy-900 mb-1 line-clamp-2">
                  {r.descripcion}{r.sobrePresupuesto && <span className="ml-1 text-st-rechazada">⚠</span>}
                </div>
                <div className="flex justify-between items-center text-[12px] text-gray-500 mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="chip text-[10.5px]">{r.frente?.codigo}</span>
                    <span>· {r._count?.items || r.itemCount || 0} items</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-navy-900 tabular-nums">{fmtCOP(r.totalCentavos)}</div>
                    <div className="text-[10.5px]">{fmtRelative(r.fechaCreacion)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {reqs.data && data.length === 0 && !reqs.isLoading && (
          <div className="p-10 text-center text-gray-500">
            <div className="text-3xl mb-2">📋</div>
            No hay requisiciones que coincidan.
          </div>
        )}

        <div className="p-3 text-[11.5px] text-gray-500 border-t border-gray-200">
          Mostrando {data.length} de {total}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, bar }: { label: string; value: string; bar: string }) {
  return (
    <div className="kpi !p-3 md:!p-4">
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${bar}`} />
      <div className="kpi-label !text-[10px] md:!text-[11px]">{label}</div>
      <div className="kpi-value !text-[18px] md:!text-[26px]">{value}</div>
    </div>
  );
}
