'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ordenesCompra } from '@/lib/api';
import { fmtCOP, fmtDate } from '@/lib/utils';

const ESTADO_STYLES: Record<string, string> = {
  borrador: 'badge-borrador',
  enviada: 'badge-avalada',
  en_transito: 'badge-compras',
  recibida_parcial: 'badge-pendiente',
  recibida_total: 'badge-aprobada',
  anulada: 'badge-rechazada',
};

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  en_transito: 'En tránsito',
  recibida_parcial: 'Recibida parcial',
  recibida_total: 'Recibida total',
  anulada: 'Anulada',
};

export default function OCListPage() {
  const [estado, setEstado] = useState('');

  const q = useQuery({
    queryKey: ['ordenes-compra', { estado }],
    queryFn: () => ordenesCompra.list({ pageSize: 50, ...(estado ? { estado } : {}) }),
  });

  const data = q.data?.data || [];
  const total = q.data?.pagination?.total || 0;
  const enTransito = data.filter((o: any) => o.estado === 'en_transito').length;
  const recibidasTotales = data.filter((o: any) => o.estado === 'recibida_total').length;
  const sumTotal = data.reduce((s: number, o: any) => s + Number(o.totalCentavos), 0);

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 flex gap-1.5 mb-1.5">
            <Link href="/dashboard" className="text-navy-700 hover:underline">Inicio</Link>
            <span>›</span><span>Órdenes de Compra</span>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900 tracking-tight">Órdenes de Compra</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            OCs emitidas a proveedores · trazadas a requisiciones aprobadas
          </p>
        </div>
        <Link href="/requisiciones?estado=aprobada" className="btn btn-primary">
          + Generar OC desde requisición
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-5">
        <KpiCard label="Total OCs" value={String(total)} bar="bg-navy-700" />
        <KpiCard label="En tránsito" value={String(enTransito)} bar="bg-st-compras" />
        <KpiCard label="Recibidas" value={String(recibidasTotales)} bar="bg-st-aprobada" />
        <KpiCard label="Monto total" value={fmtCOP(sumTotal)} bar="bg-gold-500" />
      </div>

      <div className="card">
        <div className="p-3 border-b border-gray-200 flex gap-2.5 flex-wrap items-center">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input" style={{ width: 'auto' }}>
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {q.isLoading && <div className="p-8 text-center text-gray-500">Cargando…</div>}

        {q.data && (
          <table className="tbl min-w-[700px]">
            <thead>
              <tr>
                <th>Código</th>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Frente</th>
                <th className="!text-right">Items</th>
                <th className="!text-right">Total</th>
                <th>Entrega</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((o: any) => (
                <tr key={o.id}>
                  <td className="font-mono text-[11.5px] text-gray-600">{o.codigo}</td>
                  <td className="text-[12px] text-gray-600">{fmtDate(o.fechaEmision || o.createdAt)}</td>
                  <td>{o.proveedor?.razonSocial}</td>
                  <td>{o.frente && <span className="chip">{o.frente.codigo}</span>}</td>
                  <td className="text-right tabular-nums">{o._count?.items || 0}</td>
                  <td className="text-right tabular-nums font-medium">{fmtCOP(o.totalCentavos)}</td>
                  <td className="text-[12px] text-gray-600">{o.fechaEntregaPrometida ? fmtDate(o.fechaEntregaPrometida) : '—'}</td>
                  <td><span className={`badge ${ESTADO_STYLES[o.estado]}`}>{ESTADO_LABEL[o.estado]}</span></td>
                  <td className="text-right">
                    <Link href={`/ordenes-compra/${o.id}`} className="btn btn-secondary btn-sm">Ver</Link>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-gray-500">
                  No hay OCs todavía. <Link href="/requisiciones?estado=aprobada" className="text-navy-700 underline">Genera una desde una requisición aprobada →</Link>
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
