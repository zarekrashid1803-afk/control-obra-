'use client';
import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentosSoporte } from '@/lib/api';
import { fmtCOP, fmtDate } from '@/lib/utils';

const ESTADO_STYLES: Record<string, string> = {
  borrador: 'badge-borrador',
  emitido: 'badge-aprobada',
  anulado: 'badge-rechazada',
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

export default function DetalleDocSoportePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['documento-soporte', id],
    queryFn: () => documentosSoporte.get(id),
  });

  const emitir = useMutation({
    mutationFn: () => documentosSoporte.emitir(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documento-soporte', id] }),
  });

  const anular = useMutation({
    mutationFn: (motivo: string) => documentosSoporte.anular(id, motivo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documento-soporte', id] }),
  });

  if (q.isLoading) return <div className="p-8 text-gray-500">Cargando…</div>;
  if (q.isError) return <div className="p-8 text-red-700">No se pudo cargar el documento</div>;
  const d = q.data;
  if (!d) return null;

  const adj = (d as any).identificacionAdjunto;
  const adjUrl = adj?.urlS3 ? `${API_BASE}/api/v1${adj.urlS3}` : null;
  const isImage = adj?.mimeType?.startsWith('image/');

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 flex gap-1.5 mb-1.5">
            <Link href="/documentos-soporte" className="text-navy-700 hover:underline">Documentos Soporte</Link>
            <span>›</span><span>{d.codigo}</span>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900 tracking-tight font-mono">{d.codigo}</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Documento Soporte para compra a no obligado a facturar (DSNE)
          </p>
        </div>
        <button onClick={() => router.back()} className="btn btn-secondary">← Volver</button>
      </div>

      <div className="card mb-4 p-5">
        <div className="flex gap-2.5 items-center mb-3 flex-wrap">
          <span className={`badge ${ESTADO_STYLES[d.estado]}`}>{d.estado}</span>
          {d.cuds && <span className="chip font-mono text-[10px]">{d.cuds}</span>}
          {d.esAdHoc && <span className="text-[10px] text-gray-500">PROVEEDOR OCASIONAL</span>}
          <span className="text-[11px] text-gray-500 ml-auto">
            Creado por <strong>{d.creadoPor?.nombres} {d.creadoPor?.apellidos}</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-4 max-[900px]:grid-cols-1">
        {/* IZQ */}
        <div className="space-y-4">
          <div className="card">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Proveedor</div>
            </div>
            <div className="p-4 space-y-2 text-[13px]">
              <KV k="Nombre" v={d.nombreProveedor} />
              <KV k="Documento" v={`${d.tipoDocumento} ${d.numeroDocumento}`} mono />
              <KV k="Dirección" v={d.direccion || '—'} />
              <KV k="Ciudad" v={d.ciudad || '—'} />
              <KV k="Teléfono" v={d.telefono || '—'} />
              <KV k="Email" v={d.email || '—'} />
            </div>
          </div>

          <div className="card">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Servicio prestado</div>
            </div>
            <div className="p-4 space-y-2 text-[13px]">
              <div className="whitespace-pre-wrap">{d.servicioPrestado}</div>
              <hr className="border-gray-200 my-3" />
              <KV k="Fecha" v={fmtDate(d.fechaDocumento)} />
              <KV k="Frente" v={d.frente ? `${d.frente.codigo} ${d.frente.nombre}` : '—'} />
              <KV k="Forma de pago" v={d.formaPago} />
            </div>
          </div>

          {adj && (
            <div className="card">
              <div className="p-3.5 border-b border-gray-200">
                <div className="text-[14px] font-semibold text-navy-900">Identificación del proveedor</div>
              </div>
              <div className="p-4">
                {isImage && adjUrl ? (
                  <a href={adjUrl} target="_blank" rel="noopener">
                    <img src={adjUrl} alt={adj.nombre} className="max-w-full rounded border border-gray-200" />
                  </a>
                ) : (
                  <a href={adjUrl!} target="_blank" rel="noopener" className="btn btn-secondary">
                    📄 Ver archivo: {adj.nombre}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* DER */}
        <div className="space-y-4">
          <div className="card">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Resumen económico</div>
            </div>
            <div className="p-4 space-y-2.5 text-[13px]">
              <Row k="Subtotal" v={fmtCOP(d.subtotalCentavos, { full: true })} />
              {Number(d.ivaCentavos) > 0 && <Row k="IVA 19%" v={fmtCOP(d.ivaCentavos, { full: true })} />}
              {Number(d.retencionFuenteCentavos) > 0 && <Row k="ReteFuente 2.5%" v={`- ${fmtCOP(d.retencionFuenteCentavos, { full: true })}`} subtle />}
              {Number(d.retencionIvaCentavos) > 0 && <Row k="ReteIVA" v={`- ${fmtCOP(d.retencionIvaCentavos, { full: true })}`} subtle />}
              {Number(d.retencionIcaCentavos) > 0 && <Row k="ReteICA" v={`- ${fmtCOP(d.retencionIcaCentavos, { full: true })}`} subtle />}
              <hr className="border-gray-200 my-2" />
              <Row k="TOTAL" v={fmtCOP(d.totalCentavos, { full: true })} bold />
            </div>
          </div>

          {d.estado === 'borrador' && (
            <div className="card p-4 space-y-2 bg-gold-100 border-gold-500/40">
              <div className="text-[11px] uppercase font-semibold text-gold-700 tracking-wider mb-1">Acciones</div>
              <button
                onClick={() => emitir.mutate()}
                disabled={emitir.isPending}
                className="btn btn-accent w-full justify-center py-2.5"
              >
                {emitir.isPending ? 'Emitiendo…' : '✓ Emitir documento'}
              </button>
              <div className="text-[11px] text-gray-600">Al emitir se genera el código CUDS y el documento queda como soporte contable definitivo.</div>
            </div>
          )}

          {d.estado === 'emitido' && (
            <div className="card p-4 space-y-2">
              <div className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider mb-1">Anular documento</div>
              <button
                onClick={() => {
                  const m = prompt('Motivo de la anulación:');
                  if (m) anular.mutate(m);
                }}
                disabled={anular.isPending}
                className="btn btn-secondary w-full justify-center text-st-rechazada border-red-200"
              >
                ✗ Anular
              </button>
              {d.emitidoAt && (
                <div className="text-[11px] text-gray-500 mt-1">Emitido el {fmtDate(d.emitidoAt)}</div>
              )}
            </div>
          )}

          {d.estado === 'anulado' && d.motivoAnulacion && (
            <div className="card p-4 bg-red-50 border-red-200">
              <div className="text-[11px] uppercase font-semibold text-red-700 tracking-wider mb-1">Motivo de anulación</div>
              <div className="text-[13px] text-red-900">{d.motivoAnulacion}</div>
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
