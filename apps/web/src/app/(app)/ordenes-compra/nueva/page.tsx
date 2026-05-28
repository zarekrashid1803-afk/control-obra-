'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ordenesCompra, requisiciones, proveedores, ApiError, getApiErrorMessage } from '@/lib/api';
import { fmtCOP } from '@/lib/utils';

const IVA_RATE = 0.19;
const RETEFUENTE = 0.025;
const RETEIVA = 0.15;
const RETEICA = 0.00966;

type ItemEdit = {
  materialId: string | null;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnitarioCentavos: bigint;
  descuentoPct: number;
};

function NuevaOCInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const requisicionId = sp.get('requisicion');

  const reqQ = useQuery({
    queryKey: ['requisicion', requisicionId],
    queryFn: () => requisiciones.get(requisicionId!),
    enabled: !!requisicionId,
  });

  const provsQ = useQuery({ queryKey: ['proveedores'], queryFn: () => proveedores.list({ pageSize: 100 }) });

  const [proveedorId, setProveedorId] = useState<string>('');
  const [condicionesPago, setCondicionesPago] = useState('credito_30');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [notas, setNotas] = useState('');
  const [items, setItems] = useState<ItemEdit[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cuando la requisición carga, prellenar items
  useEffect(() => {
    if (reqQ.data?.items && items.length === 0) {
      setItems(reqQ.data.items.map((it: any) => ({
        materialId: it.materialId,
        descripcion: it.descripcionSnapshot,
        unidad: it.unidadSnapshot,
        cantidad: Number(it.cantidad),
        precioUnitarioCentavos: BigInt(it.precioUnitarioCentavosSnapshot),
        descuentoPct: 0,
      })));
      // Fecha de entrega: 7 días por defecto
      const fe = new Date();
      fe.setDate(fe.getDate() + 7);
      setFechaEntrega(fe.toISOString().slice(0, 10));
    }
  }, [reqQ.data, items.length]);

  if (!requisicionId) {
    return (
      <div className="p-8">
        <div className="card p-8 text-center max-w-lg mx-auto">
          <div className="text-gray-500 mb-3">Para generar una OC primero selecciona una requisición aprobada.</div>
          <Link href="/requisiciones?estado=aprobada" className="btn btn-primary">Ver requisiciones aprobadas →</Link>
        </div>
      </div>
    );
  }

  if (reqQ.isLoading) return <div className="p-8 text-gray-500">Cargando requisición…</div>;
  if (reqQ.isError || !reqQ.data) return <div className="p-8 text-red-700">No se pudo cargar la requisición</div>;
  const r = reqQ.data;

  if (r.estado !== 'aprobada') {
    return (
      <div className="p-8">
        <div className="card p-6 max-w-2xl mx-auto">
          <div className="text-st-rechazada font-semibold mb-2">⚠ Estado incompatible</div>
          <p className="text-[13px] text-gray-600">
            Solo se pueden generar OCs de requisiciones en estado <strong>Aprobada</strong>.
            Esta requisición está en estado <strong>{r.estado}</strong>.
          </p>
          <Link href={`/requisiciones/${r.id}`} className="btn btn-secondary mt-4">Volver al detalle</Link>
        </div>
      </div>
    );
  }

  // Cálculos
  const proveedor = provsQ.data?.data?.find((p: any) => p.id === proveedorId);
  const subtotal = items.reduce((s, it) => {
    const sub = Number(it.cantidad) * Number(it.precioUnitarioCentavos);
    return s + sub * (1 - it.descuentoPct / 100);
  }, 0);
  const iva = subtotal * IVA_RATE;
  const reteFuente = proveedor?.regimenIva === 'responsable_iva' ? subtotal * RETEFUENTE : 0;
  const reteIva = (proveedor?.regimenIva === 'responsable_iva' && !proveedor?.granContribuyente) ? iva * RETEIVA : 0;
  const reteIca = subtotal * RETEICA;
  const total = subtotal + iva - reteFuente - reteIva - reteIca;

  function updateItem(i: number, patch: Partial<ItemEdit>) {
    setItems((curr) => curr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function onSubmit() {
    setError(null);
    if (!proveedorId) { setError('Selecciona un proveedor'); return; }
    if (items.length === 0) { setError('Debe haber al menos un ítem'); return; }
    setSubmitting(true);
    try {
      const oc = await ordenesCompra.generar({
        requisicionId: r.id,
        proveedorId,
        condicionesPago,
        fechaEntregaPrometida: fechaEntrega ? new Date(fechaEntrega).toISOString() : undefined,
        notas,
        items: items.map(it => ({
          materialId: it.materialId,
          descripcion: it.descripcion,
          unidad: it.unidad,
          cantidad: it.cantidad,
          precioUnitarioCentavos: String(it.precioUnitarioCentavos),
          descuentoPct: it.descuentoPct,
        })),
      });
      router.push(`/ordenes-compra/${oc.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(getApiErrorMessage(err));
      } else {
        setError('Error al generar OC');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 flex gap-1.5 mb-1.5">
            <Link href="/ordenes-compra" className="text-navy-700 hover:underline">Órdenes de Compra</Link>
            <span>›</span><span>Nueva</span>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900 tracking-tight">
            Generar OC desde <span className="font-mono">{r.codigo}</span>
          </h1>
          <p className="text-[13px] text-gray-500 mt-1">{r.descripcion} · Frente {r.frente?.codigo}</p>
        </div>
        <Link href={`/requisiciones/${r.id}`} className="btn btn-secondary">← Volver a requisición</Link>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 text-red-800 text-sm rounded border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[1.4fr_1fr] gap-4 max-[1100px]:grid-cols-1">
        <div className="space-y-4">

          {/* Proveedor */}
          <div className="card">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Proveedor</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Selecciona el proveedor que ejecutará la OC</div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">Proveedor *</label>
                <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className="input">
                  <option value="">— Selecciona un proveedor —</option>
                  {provsQ.data?.data?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.razonSocial} — {p.nit} (★ {Number(p.rating || 0).toFixed(1)})</option>
                  ))}
                </select>
              </div>

              {proveedor && (
                <div className="text-[12px] bg-navy-50 rounded p-3 grid grid-cols-2 gap-2">
                  <div><span className="text-gray-500">NIT:</span> <span className="font-mono">{proveedor.nit}</span></div>
                  <div><span className="text-gray-500">Régimen:</span> {proveedor.regimenIva.replace('_', ' ')}</div>
                  {proveedor.ciudad && <div><span className="text-gray-500">Ciudad:</span> {proveedor.ciudad}</div>}
                  {proveedor.telefono && <div><span className="text-gray-500">Tel:</span> {proveedor.telefono}</div>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">Condiciones de pago</label>
                  <select value={condicionesPago} onChange={(e) => setCondicionesPago(e.target.value)} className="input">
                    <option value="contado">Contado</option>
                    <option value="credito_15">Crédito 15 días</option>
                    <option value="credito_30">Crédito 30 días</option>
                    <option value="credito_60">Crédito 60 días</option>
                    <option value="credito_90">Crédito 90 días</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">Fecha entrega prometida</label>
                  <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="input" />
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="card">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Items · {items.length}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Puedes negociar precios o descuentos antes de emitir la OC</div>
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
                {items.map((it, idx) => {
                  const sub = it.cantidad * Number(it.precioUnitarioCentavos) * (1 - it.descuentoPct / 100);
                  return (
                    <tr key={idx} className="!cursor-default hover:!bg-transparent">
                      <td className="max-w-[300px]">{it.descripcion}</td>
                      <td className="text-right">
                        <input
                          type="number"
                          value={it.cantidad}
                          onChange={(e) => updateItem(idx, { cantidad: Number(e.target.value) })}
                          className="input text-right w-20 py-1"
                          step="0.001"
                        />
                      </td>
                      <td className="text-[11.5px] text-gray-500">{it.unidad}</td>
                      <td className="text-right">
                        <input
                          type="number"
                          value={Number(it.precioUnitarioCentavos) / 100}
                          onChange={(e) => updateItem(idx, { precioUnitarioCentavos: BigInt(Math.round((Number(e.target.value) || 0) * 100)) })}
                          className="input text-right w-32 py-1"
                        />
                      </td>
                      <td className="text-right">
                        <input
                          type="number"
                          value={it.descuentoPct}
                          onChange={(e) => updateItem(idx, { descuentoPct: Number(e.target.value) })}
                          className="input text-right w-16 py-1"
                          min="0"
                          max="100"
                          step="0.5"
                        />
                      </td>
                      <td className="text-right tabular-nums font-medium">{fmtCOP(BigInt(Math.round(sub)), { full: true })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Notas */}
          <div className="card">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Notas para el proveedor</div>
            </div>
            <div className="p-4">
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Instrucciones de entrega, horario, contacto en obra..."
                className="input min-h-[80px] resize-y"
              />
            </div>
          </div>
        </div>

        {/* Resumen y acciones */}
        <div className="space-y-4">
          <div className="card sticky top-20">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Resumen económico</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Cálculo automático según régimen del proveedor</div>
            </div>
            <div className="p-4 space-y-2.5 text-[13px]">
              <Row k="Subtotal" v={fmtCOP(BigInt(Math.round(subtotal)), { full: true })} />
              <Row k="IVA 19%" v={fmtCOP(BigInt(Math.round(iva)), { full: true })} />
              {reteFuente > 0 && <Row k="ReteFuente 2.5%" v={`- ${fmtCOP(BigInt(Math.round(reteFuente)), { full: true })}`} subtle />}
              {reteIva > 0 && <Row k="ReteIVA 15%" v={`- ${fmtCOP(BigInt(Math.round(reteIva)), { full: true })}`} subtle />}
              <Row k="ReteICA 0.966%" v={`- ${fmtCOP(BigInt(Math.round(reteIca)), { full: true })}`} subtle />
              <hr className="border-gray-200 my-2" />
              <Row k="TOTAL A PAGAR" v={fmtCOP(BigInt(Math.round(total)), { full: true })} bold />
              {!proveedor && (
                <div className="text-[11px] text-gray-500 italic mt-2">
                  Selecciona el proveedor para calcular retenciones correctamente.
                </div>
              )}
            </div>
            <div className="p-4 bg-gold-100 border-t border-gold-500/40 space-y-2">
              <button
                onClick={onSubmit}
                disabled={submitting || !proveedorId}
                className="btn btn-accent w-full justify-center py-2.5 disabled:opacity-50"
              >
                {submitting ? 'Generando…' : '📋 Generar Orden de Compra'}
              </button>
              <div className="text-[11px] text-gray-600">
                Al generar la OC la requisición pasa a estado <strong>"En Compras"</strong>. La OC queda en estado <strong>"Borrador"</strong> hasta que se envíe al proveedor.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NuevaOCPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Cargando…</div>}>
      <NuevaOCInner />
    </Suspense>
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
