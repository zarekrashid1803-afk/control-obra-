'use client';
import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requisiciones } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { EstadoBadge } from '@/components/badge';
import { fmtCOP, fmtRelative, ESTADO_LABEL } from '@/lib/utils';

const STATE_ORDER = ['borrador', 'pendiente', 'avalada', 'aprobada', 'compras', 'recibida'];

export default function DetalleRequisicionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [obs, setObs] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [motivo, setMotivo] = useState('');

  const q = useQuery({
    queryKey: ['requisicion', id],
    queryFn: () => requisiciones.get(id),
  });

  const trans = useMutation({
    mutationFn: ({ accion, motivo: m }: { accion: string; motivo?: string }) =>
      requisiciones.transicion(id, accion, obs, m),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicion', id] });
      qc.invalidateQueries({ queryKey: ['requisiciones'] });
      setObs('');
      setShowReject(false);
      setMotivo('');
    },
  });

  if (q.isLoading) return <div className="p-8 text-gray-500">Cargando requisición…</div>;
  if (q.isError) return <div className="p-8 text-red-700">No se pudo cargar la requisición</div>;
  const r = q.data;
  if (!r) return null;

  const currentIdx = STATE_ORDER.indexOf(r.estado);
  const isRejected = r.estado === 'rechazada';

  const isDirector = user?.roles?.includes('director');
  const isResidente = user?.roles?.includes('residente');
  const isCompras = user?.roles?.includes('compras');

  const canApprove = isDirector && r.estado === 'avalada' && r.solicitanteId !== user?.id;
  const canReject = (isDirector || isResidente) && ['pendiente', 'avalada', 'borrador'].includes(r.estado);
  const canEndorse = isResidente && r.estado === 'pendiente' && r.solicitanteId !== user?.id;
  const canGenerateOC = isCompras && r.estado === 'aprobada';
  const tieneAcciones = canApprove || canReject || canEndorse || canGenerateOC;

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8 pb-32 md:pb-8">
      <div className="flex md:items-end justify-between mb-4 md:mb-5 gap-3 flex-col md:flex-row">
        <div>
          <div className="text-[11px] text-gray-500 hidden md:flex gap-1.5 mb-1.5">
            <Link href="/requisiciones" className="text-navy-700 hover:underline">Requisiciones</Link>
            <span>›</span><span>{r.codigo}</span>
          </div>
          <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight font-mono">{r.codigo}</h1>
          <p className="text-[12.5px] md:text-[13px] text-gray-500 mt-1">{r.descripcion}</p>
        </div>
        <div className="hidden md:flex gap-2">
          {(user?.roles?.includes('admin') || user?.roles?.includes('director') || user?.roles?.includes('auditor')) && (
            <Link
              href={`/auditoria?entidad=requisiciones&entidadId=${r.id}`}
              className="btn btn-secondary"
              title="Ver historial de auditoría de esta requisición"
            >🔍 Auditoría</Link>
          )}
          <button onClick={() => router.back()} className="btn btn-secondary">← Volver</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        {/* LEFT */}
        <div className="space-y-4">
          {/* Hero */}
          <div className="card p-4 md:p-5">
            <div className="flex gap-2 items-center mb-2 flex-wrap">
              <EstadoBadge estado={r.estado} />
              <span className="chip">{r.frente?.codigo} {r.frente?.nombre}</span>
              {r.prioridad === 'urgente' && (
                <span className="text-[10.5px] font-bold text-st-rechazada">URGENTE</span>
              )}
              {r.sobrePresupuesto && (
                <span className="text-[10.5px] font-bold text-st-pendiente">⚠ SOBRE PRESUPUESTO</span>
              )}
            </div>
            <div className="text-[12px] text-gray-500 mt-2 leading-relaxed">
              Solicitada por <strong>{r.solicitante?.nombres} {r.solicitante?.apellidos}</strong> · {fmtRelative(r.fechaCreacion)}
              {r.avalador && <><br />Avalada por <strong>{r.avalador.nombres} {r.avalador.apellidos}</strong></>}
              {r.aprobador && <><br />Aprobada por <strong>{r.aprobador.nombres} {r.aprobador.apellidos}</strong></>}
            </div>
            {r.motivoRechazo && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-[12.5px] text-red-800">
                <strong>Motivo de rechazo:</strong> {r.motivoRechazo}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="card">
            <div className="p-3.5 border-b border-gray-200 flex justify-between items-center">
              <div className="text-[14px] font-semibold text-navy-900">Items · {r.items?.length || 0}</div>
              <div className="text-[14px] font-bold tabular-nums md:hidden">{fmtCOP(r.totalCentavos)}</div>
            </div>
            {/* PC: tabla */}
            <table className="tbl hidden md:table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Descripción</th>
                  <th className="!text-right">Cant.</th>
                  <th>Unidad</th>
                  <th className="!text-right">P. unit.</th>
                  <th className="!text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {r.items?.map((it: any) => (
                  <tr key={it.id}>
                    <td className="font-mono text-[11.5px] text-gray-600">{it.material?.sku || '—'}</td>
                    <td>{it.descripcionSnapshot}</td>
                    <td className="text-right tabular-nums">{Number(it.cantidad)}</td>
                    <td>{it.unidadSnapshot}</td>
                    <td className="text-right tabular-nums">{fmtCOP(it.precioUnitarioCentavosSnapshot, { full: true })}</td>
                    <td className="text-right tabular-nums font-medium">{fmtCOP(it.subtotalCentavos, { full: true })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={5} className="text-right py-2 text-gray-500">Subtotal</td><td className="text-right tabular-nums">{fmtCOP(r.subtotalCentavos, { full: true })}</td></tr>
                <tr><td colSpan={5} className="text-right py-2 text-gray-500">IVA 19%</td><td className="text-right tabular-nums">{fmtCOP(r.ivaCentavos, { full: true })}</td></tr>
                <tr className="bg-navy-50"><td colSpan={5} className="text-right py-3 font-semibold text-navy-900">TOTAL</td><td className="text-right tabular-nums font-bold text-navy-900">{fmtCOP(r.totalCentavos, { full: true })}</td></tr>
              </tfoot>
            </table>
            {/* Móvil: lista de cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {r.items?.map((it: any) => (
                <div key={it.id} className="p-3.5">
                  <div className="text-[13.5px] font-medium text-navy-900 mb-0.5">{it.descripcionSnapshot}</div>
                  <div className="flex justify-between items-center text-[12px] text-gray-500">
                    <span>{Number(it.cantidad)} {it.unidadSnapshot} · {fmtCOP(it.precioUnitarioCentavosSnapshot)} c/u</span>
                    <strong className="text-navy-900 tabular-nums">{fmtCOP(it.subtotalCentavos)}</strong>
                  </div>
                </div>
              ))}
              <div className="p-3.5 bg-gray-50 space-y-1.5 text-[13px]">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="tabular-nums">{fmtCOP(r.subtotalCentavos)}</span></div>
                <div className="flex justify-between text-gray-600"><span>IVA 19%</span><span className="tabular-nums">{fmtCOP(r.ivaCentavos)}</span></div>
                <div className="flex justify-between font-bold text-navy-900 text-[15px] pt-1.5 border-t border-gray-300">
                  <span>Total</span><span className="tabular-nums">{fmtCOP(r.totalCentavos)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          {/* Timeline */}
          <div className="card">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Timeline · 7 estados</div>
            </div>
            <div className="p-4 md:p-5">
              {STATE_ORDER.map((s, i) => {
                const event = r.historial?.find((h: any) => h.estadoNuevo === s);
                const done = i <= currentIdx && !isRejected;
                const current = i === currentIdx && !isRejected;
                const dotClass = current
                  ? 'bg-st-pendiente border-st-pendiente text-white ring-4 ring-amber-200/60'
                  : done
                    ? 'bg-st-aprobada border-st-aprobada text-white'
                    : 'bg-white border-gray-300 text-gray-400';
                return (
                  <div key={s} className="flex gap-3 pb-4 relative last:pb-0">
                    {i < STATE_ORDER.length - 1 && (
                      <div className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${done ? 'bg-st-aprobada' : 'bg-gray-200'}`} />
                    )}
                    <div className={`w-6 h-6 rounded-full border-2 grid place-items-center text-[10px] flex-shrink-0 ${dotClass}`}>
                      {done ? '✓' : current ? '●' : ''}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <div className={`text-[13px] font-semibold ${done || current ? 'text-navy-900' : 'text-gray-400'}`}>
                        {ESTADO_LABEL[s] || s}
                      </div>
                      {event && (
                        <div className="text-[11.5px] text-gray-500 mt-0.5">
                          {event.actor?.iniciales} · {fmtRelative(event.creadoAt)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Acciones — PC: inline, móvil: sticky bottom */}
            {tieneAcciones && (
              <div className="hidden md:flex flex-col gap-2 p-4 border-t border-gray-200 bg-gold-100">
                <div className="text-[11px] uppercase font-semibold text-gold-700 tracking-wider mb-1">Tu acción</div>
                {canEndorse && (
                  <button onClick={() => trans.mutate({ accion: 'avalar' })} disabled={trans.isPending} className="btn btn-accent justify-center py-2.5">
                    {trans.isPending ? 'Procesando…' : '✓ Avalar requisición'}
                  </button>
                )}
                {canApprove && (
                  <button onClick={() => trans.mutate({ accion: 'aprobar' })} disabled={trans.isPending} className="btn btn-accent justify-center py-2.5">
                    {trans.isPending ? 'Procesando…' : '✓ Aprobar requisición'}
                  </button>
                )}
                {canGenerateOC && (
                  <Link href={`/ordenes-compra/nueva?requisicion=${r.id}`} className="btn btn-accent justify-center py-2.5">
                    📋 Generar Orden de Compra
                  </Link>
                )}
                {canReject && !showReject && (
                  <button onClick={() => setShowReject(true)} className="btn btn-secondary justify-center text-st-rechazada border-red-200">
                    ✗ Rechazar con observaciones
                  </button>
                )}
                {showReject && (
                  <div className="flex flex-col gap-2">
                    <textarea
                      placeholder="Motivo del rechazo (obligatorio)"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-[13px]"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setShowReject(false)} className="btn btn-secondary flex-1 justify-center">Cancelar</button>
                      <button disabled={!motivo || trans.isPending} onClick={() => trans.mutate({ accion: 'rechazar', motivo })} className="btn flex-1 justify-center bg-st-rechazada text-white disabled:opacity-50">
                        Confirmar rechazo
                      </button>
                    </div>
                  </div>
                )}
                {trans.isError && (
                  <div className="text-[12px] text-red-700 bg-red-50 p-2 rounded">
                    {(trans.error as any)?.body?.message || 'Error al procesar'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Presupuesto */}
          {r.frente && (
            <div className="card">
              <div className="p-3.5 border-b border-gray-200">
                <div className="text-[14px] font-semibold text-navy-900">Impacto presupuestal</div>
              </div>
              <div className="p-4">
                <div className="text-[12px] text-gray-500 mb-1.5">
                  Frente <strong>{r.frente.codigo} {r.frente.nombre}</strong>
                </div>
                <div className="flex justify-between text-[12.5px] mb-1">
                  <span>Consumido</span>
                  <span><strong>{fmtCOP(r.frente.consumidoCentavos)}</strong> / {fmtCOP(r.frente.presupuestoTotalCentavos)}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div
                    className="h-full rounded bg-st-aprobada"
                    style={{ width: `${Math.min(100, (Number(r.frente.consumidoCentavos) / Number(r.frente.presupuestoTotalCentavos)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom actions móvil */}
      {tieneAcciones && (
        <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 p-4 z-30" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 16px)' }}>
          <div className="space-y-2 max-w-md mx-auto">
            {canEndorse && (
              <button onClick={() => trans.mutate({ accion: 'avalar' })} disabled={trans.isPending} className="w-full py-3.5 bg-gold-500 text-navy-900 font-semibold rounded-lg active:bg-gold-400 disabled:opacity-50">
                {trans.isPending ? 'Procesando…' : '✓ Avalar requisición'}
              </button>
            )}
            {canApprove && (
              <button onClick={() => trans.mutate({ accion: 'aprobar' })} disabled={trans.isPending} className="w-full py-3.5 bg-gold-500 text-navy-900 font-semibold rounded-lg active:bg-gold-400 disabled:opacity-50">
                {trans.isPending ? 'Procesando…' : '✓ Aprobar'}
              </button>
            )}
            {canGenerateOC && (
              <Link href={`/ordenes-compra/nueva?requisicion=${r.id}`} className="block w-full py-3.5 bg-gold-500 text-navy-900 font-semibold rounded-lg text-center">
                📋 Generar OC
              </Link>
            )}
            {canReject && (
              <button onClick={() => setShowReject(true)} className="w-full py-3 bg-white border border-red-200 text-st-rechazada font-semibold rounded-lg active:bg-red-50">
                ✗ Rechazar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Reject bottom-sheet móvil */}
      {showReject && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-50 flex items-end" onClick={() => setShowReject(false)}>
          <div className="bg-white w-full rounded-t-2xl p-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 20px)' }} onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h3 className="text-[16px] font-semibold text-navy-900 mb-1">Motivo del rechazo</h3>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explica brevemente..."
              className="w-full px-3 py-2 border border-gray-300 rounded text-[14px] min-h-[100px] mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowReject(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg">Cancelar</button>
              <button disabled={!motivo || trans.isPending} onClick={() => trans.mutate({ accion: 'rechazar', motivo })} className="flex-1 py-3 bg-st-rechazada text-white font-semibold rounded-lg disabled:opacity-50">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
