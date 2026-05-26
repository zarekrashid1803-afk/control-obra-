'use client';
import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export default function DetalleOCPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['oc', id],
    queryFn: () => ordenesCompra.get(id),
  });

  const enviar = useMutation({
    mutationFn: () => ordenesCompra.enviar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['oc', id] }),
  });

  const anular = useMutation({
    mutationFn: (motivo: string) => ordenesCompra.anular(id, motivo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['oc', id] }),
  });

  if (q.isLoading) return <div className="p-8 text-gray-500">Cargando…</div>;
  if (q.isError || !q.data) return <div className="p-8 text-red-700">No se pudo cargar la OC</div>;
  const o = q.data;

  const canEnviar = o.estado === 'borrador';
  const canAnular = ['borrador', 'enviada', 'en_transito'].includes(o.estado);

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 flex gap-1.5 mb-1.5">
            <Link href="/ordenes-compra" className="text-navy-700 hover:underline">Órdenes de Compra</Link>
            <span>›</span><span>{o.codigo}</span>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900 tracking-tight font-mono">{o.codigo}</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Generada por <strong>{o.generadaPor?.nombres} {o.generadaPor?.apellidos}</strong>
            {o.requisicion && (
              <> · desde requisición <Link href={`/requisiciones/${o.requisicion.id}`} className="font-mono text-navy-700 hover:underline">{o.requisicion.codigo}</Link></>
            )}
          </p>
        </div>
        <button onClick={() => router.back()} className="btn btn-secondary">← Volver</button>
      </div>

      <div className="card mb-4 p-5">
        <div className="flex gap-2.5 items-center flex-wrap">
          <span className={`badge ${ESTADO_STYLES[o.estado]}`}>{ESTADO_LABEL[o.estado]}</span>
          <span className="chip">{o.frente?.codigo} {o.frente?.nombre}</span>
          <span className="text-[11px] text-gray-500">Condiciones: <strong>{o.condicionesPago?.replace('_', ' ')}</strong></span>
          {o.fechaEntregaPrometida && <span className="text-[11px] text-gray-500">Entrega: <strong>{fmtDate(o.fechaEntregaPrometida)}</strong></span>}
        </div>
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-4 max-[1000px]:grid-cols-1">
        <div className="space-y-4">
          {/* Proveedor */}
          <div className="card">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Proveedor</div>
            </div>
            <div className="p-4 space-y-2 text-[13px]">
              <div className="font-semibold text-navy-900 text-base">{o.proveedor?.razonSocial}</div>
              <KV k="NIT" v={o.proveedor?.nit || '—'} mono />
              <KV k="Régimen" v={o.proveedor?.regimenIva?.replace('_', ' ') || '—'} />
              <KV k="Ciudad" v={o.proveedor?.ciudad || '—'} />
              <KV k="Teléfono" v={o.proveedor?.telefono || '—'} />
              <KV k="Email" v={o.proveedor?.email || '—'} />
            </div>
          </div>

          {/* Items */}
          <div className="card">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Items · {o.items?.length || 0}</div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th className="!text-right">Cant.</th>
                  <th>Unidad</th>
                  <th className="!text-right">Precio unit.</th>
                  <th className="!text-right">% Desc</th>
                  <th className="!text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {o.items?.map((it: any) => (
                  <tr key={it.id} className="hover:!bg-transparent !cursor-default">
                    <td className="max-w-[260px]">{it.descripcion}</td>
                    <td className="text-right tabular-nums">{Number(it.cantidad)}</td>
                    <td className="text-[12px] text-gray-500">{it.unidad}</td>
                    <td className="text-right tabular-nums">{fmtCOP(it.precioUnitarioCentavos, { full: true })}</td>
                    <td className="text-right text-[12px]">{Number(it.descuentoPct)}%</td>
                    <td className="text-right tabular-nums font-medium">{fmtCOP(it.subtotalCentavos, { full: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {o.notas && (
            <div className="card">
              <div className="p-3.5 border-b border-gray-200">
                <div className="text-[14px] font-semibold text-navy-900">Notas</div>
              </div>
              <div className="p-4 text-[13px] whitespace-pre-wrap">{o.notas}</div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Resumen económico</div>
            </div>
            <div className="p-4 space-y-2.5 text-[13px]">
              <Row k="Subtotal" v={fmtCOP(o.subtotalCentavos, { full: true })} />
              <Row k="IVA 19%" v={fmtCOP(o.ivaCentavos, { full: true })} />
              {Number(o.retencionFuenteCentavos) > 0 && <Row k="ReteFuente" v={`- ${fmtCOP(o.retencionFuenteCentavos, { full: true })}`} subtle />}
              {Number(o.retencionIvaCentavos) > 0 && <Row k="ReteIVA" v={`- ${fmtCOP(o.retencionIvaCentavos, { full: true })}`} subtle />}
              {Number(o.retencionIcaCentavos) > 0 && <Row k="ReteICA" v={`- ${fmtCOP(o.retencionIcaCentavos, { full: true })}`} subtle />}
              <hr className="border-gray-200 my-2" />
              <Row k="TOTAL" v={fmtCOP(o.totalCentavos, { full: true })} bold />
            </div>
          </div>

          {(canEnviar || canAnular) && (
            <div className="card p-4 space-y-2 bg-gold-100 border-gold-500/40">
              <div className="text-[11px] uppercase font-semibold text-gold-700 tracking-wider mb-1">Acciones</div>
              {canEnviar && (
                <button onClick={() => enviar.mutate()} disabled={enviar.isPending} className="btn btn-accent w-full justify-center py-2.5">
                  {enviar.isPending ? 'Enviando…' : '📤 Enviar al proveedor'}
                </button>
              )}
              {canAnular && (
                <button
                  onClick={() => { const m = prompt('Motivo de la anulación:'); if (m) anular.mutate(m); }}
                  disabled={anular.isPending}
                  className="btn btn-secondary w-full justify-center text-st-rechazada border-red-200"
                >
                  ✗ Anular OC
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{k}</span>
      <span className={mono ? 'font-mono text-right' : 'text-right'}>{v}</span>
    </div>
  );
}

function Row({ k, v, bold, subtle }: { k: string; v: string; bold?: boolean; subtle?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-navy-900 text-[15px]' : ''} ${subtle ? 'text-gray-500' : ''}`}>
      <span>{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
