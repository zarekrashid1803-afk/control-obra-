'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { inventario, frentes } from '@/lib/api';
import { fmtCOP } from '@/lib/utils';

const ESTADO_COLOR: Record<string, { badge: string; row: string }> = {
  ok:       { badge: 'badge-aprobada',  row: '' },
  bajo:     { badge: 'badge-pendiente', row: 'border-l-4 border-l-st-pendiente' },
  agotado:  { badge: 'badge-rechazada', row: 'border-l-4 border-l-st-rechazada' },
};

const ESTADO_LABEL: Record<string, string> = {
  ok: '✓ OK',
  bajo: '⚠ Bajo',
  agotado: '✗ Agotado',
};

export default function InventarioPage() {
  const [frenteId, setFrenteId] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [search, setSearch] = useState('');

  const frentesQ = useQuery({ queryKey: ['frentes'], queryFn: () => frentes.list() });

  const invQ = useQuery({
    queryKey: ['inventario', frenteId],
    queryFn: () => inventario.existencias(frenteId || undefined),
  });

  const data = (invQ.data as any[]) || [];
  const filtered = data
    .filter((row) => !filtroEstado || row.estado === filtroEstado)
    .filter((row) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return row.sku.toLowerCase().includes(q) || row.descripcion.toLowerCase().includes(q);
    });

  const totalSku = data.length;
  const enAlerta = data.filter((r) => r.estado === 'bajo').length;
  const agotados = data.filter((r) => r.estado === 'agotado').length;
  const valorTotal = data.reduce((s: bigint, r: any) => s + BigInt(r.valorEstimadoCentavos || 0), 0n);

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 flex gap-1.5 mb-1.5">
            <Link href="/dashboard" className="text-navy-700 hover:underline">Inicio</Link>
            <span>›</span><span>Inventario</span>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900 tracking-tight">Inventario en tiempo real</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Existencias por frente · alertas automáticas de stock mínimo
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-5">
        <KpiCard label="Total SKUs" value={String(totalSku)} bar="bg-navy-700" />
        <KpiCard label="En alerta (stock bajo)" value={String(enAlerta)} bar="bg-st-pendiente" warn={enAlerta > 0} />
        <KpiCard label="Agotados" value={String(agotados)} bar="bg-st-rechazada" warn={agotados > 0} />
        <KpiCard label="Valor estimado total" value={fmtCOP(valorTotal)} bar="bg-gold-500" />
      </div>

      <div className="card">
        <div className="p-3 border-b border-gray-200 flex gap-2.5 flex-wrap items-center">
          <div className="flex-1 min-w-[240px] flex items-center gap-1.5 border border-gray-300 rounded px-2.5 bg-white">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Buscar por SKU o descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 outline-none py-2 text-[13px] w-full"
            />
          </div>
          <select value={frenteId} onChange={(e) => setFrenteId(e.target.value)} className="input" style={{ width: 'auto' }}>
            <option value="">Todos los frentes</option>
            {frentesQ.data?.map((f: any) => (
              <option key={f.id} value={f.id}>{f.codigo} {f.nombre}</option>
            ))}
          </select>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="input" style={{ width: 'auto' }}>
            <option value="">Todos los estados</option>
            <option value="ok">✓ OK</option>
            <option value="bajo">⚠ Bajo</option>
            <option value="agotado">✗ Agotado</option>
          </select>
        </div>

        {invQ.isLoading && <div className="p-8 text-center text-gray-500">Cargando inventario…</div>}

        {invQ.data && (
          <table className="tbl min-w-[700px]">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Descripción</th>
                <th>Unidad</th>
                <th className="!text-right">Stock mínimo</th>
                <th className="!text-right">Total existencias</th>
                <th>Por frente</th>
                <th>Estado</th>
                <th className="!text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row: any) => (
                <tr key={row.materialId} className={`${ESTADO_COLOR[row.estado]?.row || ''} !cursor-default hover:!bg-transparent`}>
                  <td className="font-mono text-[11.5px] text-gray-600">{row.sku}</td>
                  <td className="max-w-[260px]">{row.descripcion}</td>
                  <td className="text-[12px] text-gray-500">{row.unidad}</td>
                  <td className="text-right tabular-nums text-gray-500">{Number(row.stockMinimo)}</td>
                  <td className="text-right tabular-nums font-medium">{row.total}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {row.existenciasPorFrente?.map((e: any, i: number) => (
                        <span key={i} className="chip text-[10.5px]">
                          {e.frenteCodigo}: {Number(e.cantidad)}
                        </span>
                      ))}
                      {(!row.existenciasPorFrente || row.existenciasPorFrente.length === 0) && (
                        <span className="text-[11px] text-gray-400">— sin distribuir</span>
                      )}
                    </div>
                  </td>
                  <td><span className={`badge ${ESTADO_COLOR[row.estado]?.badge || 'badge-borrador'}`}>{ESTADO_LABEL[row.estado] || row.estado}</span></td>
                  <td className="text-right tabular-nums text-[12px]">{fmtCOP(row.valorEstimadoCentavos)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-500">No hay items que coincidan con los filtros.</td></tr>
              )}
            </tbody>
          </table>
        )}

        <div className="p-3 text-[11.5px] text-gray-500 border-t border-gray-200">
          {filtered.length} de {totalSku} items mostrados
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, bar, warn }: { label: string; value: string; bar: string; warn?: boolean }) {
  return (
    <div className="kpi">
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${bar}`} />
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${warn ? 'text-st-rechazada' : ''}`}>{value}</div>
    </div>
  );
}
