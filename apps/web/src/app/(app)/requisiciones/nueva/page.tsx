'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { requisiciones, frentes, materiales, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { fmtCOP } from '@/lib/utils';

const IVA_RATE = 0.19;

type ItemDraft = {
  id: string;
  materialId: string | null;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnitarioCentavos: bigint;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export default function NuevaRequisicionPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const frentesQ = useQuery({ queryKey: ['frentes'], queryFn: () => frentes.list() });
  const matsQ = useQuery({ queryKey: ['materiales'], queryFn: () => materiales.list({ pageSize: 100 }) });

  const [frenteId, setFrenteId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<'normal'|'urgente'>('normal');
  const [items, setItems] = useState<ItemDraft[]>([
    { id: uid(), materialId: null, descripcion: '', unidad: 'und', cantidad: 1, precioUnitarioCentavos: 0n },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem() {
    setItems((curr) => [...curr, { id: uid(), materialId: null, descripcion: '', unidad: 'und', cantidad: 1, precioUnitarioCentavos: 0n }]);
  }
  function removeItem(id: string) {
    setItems((curr) => curr.length > 1 ? curr.filter(it => it.id !== id) : curr);
  }
  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setItems((curr) => curr.map(it => it.id === id ? { ...it, ...patch } : it));
  }
  function pickMaterial(itemId: string, materialId: string) {
    if (!materialId) {
      updateItem(itemId, { materialId: null });
      return;
    }
    const m = matsQ.data?.data?.find((x: any) => x.id === materialId);
    if (m) {
      updateItem(itemId, {
        materialId: m.id,
        descripcion: m.descripcion,
        unidad: m.unidad,
        precioUnitarioCentavos: BigInt(m.precioReferenciaCentavos),
      });
    }
  }

  const subtotal = items.reduce((s, it) => s + Number(it.precioUnitarioCentavos) * it.cantidad, 0);
  const iva = subtotal * IVA_RATE;
  const total = subtotal + iva;

  const frente = frentesQ.data?.find((f: any) => f.id === frenteId);
  const presupuestoConsumido = frente ? Number(frente.consumidoCentavos) : 0;
  const presupuestoTotal = frente ? Number(frente.presupuestoTotalCentavos) : 0;
  const proyectado = presupuestoConsumido + total;
  const sobreP = frente && proyectado > presupuestoTotal;

  async function onSubmit() {
    setError(null);
    if (!frenteId) return setError('Selecciona un frente');
    if (!descripcion || descripcion.length < 3) return setError('Describe brevemente la requisición');
    const validItems = items.filter(it => it.descripcion && it.cantidad > 0 && Number(it.precioUnitarioCentavos) > 0);
    if (validItems.length === 0) return setError('Agrega al menos un item con descripción, cantidad y precio');

    setSubmitting(true);
    try {
      const created = await requisiciones.create({
        frenteId,
        descripcion,
        prioridad,
        items: validItems.map(it => ({
          materialId: it.materialId,
          descripcion: it.descripcion,
          unidad: it.unidad,
          cantidad: it.cantidad,
          precioUnitarioCentavos: String(it.precioUnitarioCentavos),
        })),
      });
      // Auto-envío: pasar de borrador → pendiente
      await requisiciones.transicion(created.id, 'enviar', 'Enviada desde web');
      router.push(`/requisiciones/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const m = (err.body as any)?.message || err.message;
        setError(typeof m === 'string' ? m : JSON.stringify(m));
      } else setError('Error al crear requisición');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 flex gap-1.5 mb-1.5">
            <Link href="/requisiciones" className="text-navy-700 hover:underline">Requisiciones</Link>
            <span>›</span><span>Nueva</span>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900 tracking-tight">Nueva requisición</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Solicitada por {user?.nombres} {user?.apellidos} · {user?.roles?.join(', ')}
          </p>
        </div>
        <Link href="/requisiciones" className="btn btn-secondary">← Cancelar</Link>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 text-red-800 text-sm rounded border border-red-200">{error}</div>}

      <div className="grid grid-cols-[1.5fr_1fr] gap-4 max-[1100px]:grid-cols-1">
        <div className="space-y-4">
          {/* Contexto */}
          <div className="card">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Contexto</div>
            </div>
            <div className="p-4 space-y-3">
              <Field label="Frente de obra *">
                <select value={frenteId} onChange={(e) => setFrenteId(e.target.value)} className="input">
                  <option value="">— Selecciona un frente —</option>
                  {frentesQ.data?.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.codigo} {f.nombre}</option>
                  ))}
                </select>
              </Field>

              <Field label="Descripción / propósito *">
                <input
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="input"
                  placeholder="Ej: Refuerzo estructural placa 4 — cemento, varilla y arena"
                />
              </Field>

              <Field label="Prioridad">
                <div className="flex gap-2">
                  <PrioBtn active={prioridad === 'normal'} onClick={() => setPrioridad('normal')}>📋 A tiempo</PrioBtn>
                  <PrioBtn active={prioridad === 'urgente'} onClick={() => setPrioridad('urgente')} danger>🔥 Urgente</PrioBtn>
                </div>
              </Field>
            </div>
          </div>

          {/* Items */}
          <div className="card">
            <div className="p-3.5 border-b border-gray-200 flex justify-between items-center">
              <div>
                <div className="text-[14px] font-semibold text-navy-900">Items solicitados · {items.length}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Selecciona del catálogo o agrega items no catalogados</div>
              </div>
              <button type="button" onClick={addItem} className="btn btn-secondary btn-sm">+ Agregar item</button>
            </div>
            <div className="p-4 space-y-3">
              {items.map((it, idx) => (
                <div key={it.id} className="grid grid-cols-[1fr_auto] gap-2 p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="space-y-2">
                    <div className="grid grid-cols-[2fr_1fr] gap-2">
                      <select
                        value={it.materialId || ''}
                        onChange={(e) => pickMaterial(it.id, e.target.value)}
                        className="input bg-white"
                      >
                        <option value="">— Del catálogo —</option>
                        {matsQ.data?.data?.map((m: any) => (
                          <option key={m.id} value={m.id}>{m.sku} · {m.descripcion}</option>
                        ))}
                      </select>
                      <input
                        value={it.descripcion}
                        onChange={(e) => updateItem(it.id, { descripcion: e.target.value, materialId: null })}
                        className="input bg-white"
                        placeholder="O escribe descripción libre"
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_1fr_1.5fr_1.5fr] gap-2 items-center">
                      <input
                        type="number"
                        value={it.cantidad}
                        onChange={(e) => updateItem(it.id, { cantidad: Number(e.target.value) })}
                        className="input bg-white text-right"
                        placeholder="Cant."
                        step="0.001"
                        min="0"
                      />
                      <select value={it.unidad} onChange={(e) => updateItem(it.id, { unidad: e.target.value })} className="input bg-white">
                        <option value="und">und</option>
                        <option value="rollo">rollo</option>
                        <option value="galon">galón</option>
                        <option value="m3">m³</option>
                        <option value="m2">m²</option>
                        <option value="m">m</option>
                        <option value="kg">kg</option>
                        <option value="ton">ton</option>
                        <option value="lt">lt</option>
                        <option value="paquete">paquete</option>
                        <option value="caja">caja</option>
                      </select>
                      <input
                        type="number"
                        value={Number(it.precioUnitarioCentavos) / 100}
                        onChange={(e) => updateItem(it.id, { precioUnitarioCentavos: BigInt(Math.round(Number(e.target.value) * 100)) })}
                        className="input bg-white text-right font-mono"
                        placeholder="Precio unit. COP"
                        min="0"
                      />
                      <div className="text-right tabular-nums font-medium text-navy-900 px-2">
                        {fmtCOP(BigInt(Math.round(Number(it.precioUnitarioCentavos) * it.cantidad)), { full: true })}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    disabled={items.length === 1}
                    className="self-start text-st-rechazada hover:bg-red-50 w-9 h-9 rounded grid place-items-center disabled:opacity-30"
                    title="Eliminar item"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className="space-y-4">
          <div className="card sticky top-20">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Resumen</div>
            </div>
            <div className="p-4 space-y-2 text-[13px]">
              <Row k="Subtotal" v={fmtCOP(subtotal, { full: true })} />
              <Row k="IVA 19%" v={fmtCOP(iva, { full: true })} subtle />
              <hr className="border-gray-200 my-2" />
              <Row k="TOTAL" v={fmtCOP(total, { full: true })} bold />
            </div>
            {frente && (
              <div className="p-4 border-t border-gray-200 text-[12px]">
                <div className="text-gray-500 mb-1">Impacto en presupuesto del frente</div>
                <div className="flex justify-between mb-1.5">
                  <span><strong>{frente.codigo}</strong> {frente.nombre}</span>
                  <span className="tabular-nums">{fmtCOP(presupuestoConsumido)} / {fmtCOP(presupuestoTotal)}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div
                    className={`h-full rounded ${sobreP ? 'bg-st-rechazada' : 'bg-st-aprobada'}`}
                    style={{ width: `${Math.min(100, (proyectado / presupuestoTotal) * 100)}%` }}
                  />
                </div>
                {sobreP && (
                  <div className="text-st-rechazada text-[11px] mt-2">⚠ Esta requisición excede el presupuesto disponible.</div>
                )}
              </div>
            )}
            <div className="p-4 bg-gold-100 border-t border-gold-500/40 space-y-2">
              <button
                onClick={onSubmit}
                disabled={submitting}
                className="btn btn-accent w-full justify-center py-2.5 disabled:opacity-50"
              >
                {submitting ? 'Enviando…' : '📤 Crear y enviar para aval'}
              </button>
              <div className="text-[11px] text-gray-600">
                La requisición pasará a estado <strong>"Pendiente Aval"</strong>. Un residente del mismo frente deberá avalarla.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function PrioBtn({ active, onClick, danger, children }: { active: boolean; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 px-3 rounded border text-[13px] font-medium transition ${
        active
          ? danger ? 'bg-st-rechazada text-white border-st-rechazada' : 'bg-navy-700 text-white border-navy-700'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
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
