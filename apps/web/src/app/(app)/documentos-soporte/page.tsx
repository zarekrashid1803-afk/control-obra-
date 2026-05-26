'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { documentosSoporte } from '@/lib/api';
import { fmtCOP, fmtDate } from '@/lib/utils';

const ESTADO_STYLES: Record<string, string> = {
  borrador: 'badge-borrador',
  emitido: 'badge-aprobada',
  anulado: 'badge-rechazada',
};

export default function DocumentosSoportePage() {
  const [estado, setEstado] = useState('');
  const [search, setSearch] = useState('');

  const filters: Record<string, any> = { pageSize: 50 };
  if (estado) filters.estado = estado;
  if (search) filters.search = search;

  const q = useQuery({
    queryKey: ['documentos-soporte', filters],
    queryFn: () => documentosSoporte.list(filters),
  });

  const data = q.data?.data || [];
  const total = q.data?.pagination?.total || 0;
  const borradores = data.filter((d: any) => d.estado === 'borrador').length;
  const emitidos = data.filter((d: any) => d.estado === 'emitido').length;
  const totalMonto = data.reduce((s: number, d: any) => s + Number(d.totalCentavos), 0);

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 flex gap-1.5 mb-1.5">
            <Link href="/dashboard" className="text-navy-700 hover:underline">Inicio</Link>
            <span>›</span><span>Documentos Soporte</span>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900 tracking-tight">Documentos Soporte</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            DSNE — Compras a proveedores no obligados a facturar electrónicamente (DIAN Colombia)
          </p>
        </div>
        <Link href="/documentos-soporte/nuevo" className="btn btn-primary">+ Nuevo documento soporte</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-5">
        <KpiCard label="Total" value={String(total)} bar="bg-navy-700" />
        <KpiCard label="Borradores" value={String(borradores)} bar="bg-st-borrador" />
        <KpiCard label="Emitidos" value={String(emitidos)} bar="bg-st-aprobada" />
        <KpiCard label="Monto total" value={fmtCOP(totalMonto)} bar="bg-gold-500" />
      </div>

      <div className="card">
        <div className="p-3 border-b border-gray-200 flex gap-2.5 flex-wrap items-center">
          <div className="flex-1 min-w-[240px] flex items-center gap-1.5 border border-gray-300 rounded px-2.5 bg-white">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Buscar por código, NIT, proveedor o servicio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 outline-none py-2 text-[13px] w-full"
            />
          </div>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="px-3 py-2 border border-gray-300 rounded text-[12.5px] bg-white">
            <option value="">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="emitido">Emitido</option>
            <option value="anulado">Anulado</option>
          </select>
        </div>

        {q.isLoading && <div className="p-8 text-center text-gray-500">Cargando…</div>}
        {q.isError && <div className="p-8 text-center text-red-700 bg-red-50">Error al cargar</div>}

        {q.data && (
          <table className="tbl min-w-[700px]">
            <thead>
              <tr>
                <th>Código</th>
                <th>Fecha</th>
                <th>Documento</th>
                <th>Proveedor</th>
                <th>Servicio</th>
                <th>Frente</th>
                <th className="!text-right">Total</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((d: any) => (
                <tr key={d.id}>
                  <td className="font-mono text-[11.5px] text-gray-600">{d.codigo}</td>
                  <td className="text-[12px] text-gray-600">{fmtDate(d.fechaDocumento)}</td>
                  <td className="text-[12px]">
                    <span className="font-mono">{d.tipoDocumento}</span> {d.numeroDocumento}
                  </td>
                  <td>
                    <div>{d.nombreProveedor}</div>
                    {d.esAdHoc && <span className="text-[10px] text-gray-400">ocasional</span>}
                  </td>
                  <td className="max-w-[280px] truncate" title={d.servicioPrestado}>{d.servicioPrestado}</td>
                  <td>{d.frente && <span className="chip">{d.frente.codigo}</span>}</td>
                  <td className="text-right tabular-nums font-medium">{fmtCOP(d.totalCentavos)}</td>
                  <td><span className={`badge ${ESTADO_STYLES[d.estado] || 'badge-borrador'}`}>{d.estado}</span></td>
                  <td className="text-right">
                    <Link href={`/documentos-soporte/${d.id}`} className="btn btn-secondary btn-sm">Ver</Link>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-gray-500">
                  No hay documentos soporte. <Link href="/documentos-soporte/nuevo" className="text-navy-700 underline">Crear el primero →</Link>
                </td></tr>
              )}
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
