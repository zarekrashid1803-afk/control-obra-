'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { bodega, frentes, materiales, requisiciones, ApiError } from '@/lib/api';

type Salida = {
  id: string;
  materialId: string;
  cantidad: number;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export default function NuevaSalidaPage() {
  const router = useRouter();

  const frentesQ = useQuery({ queryKey: ['frentes'], queryFn: () => frentes.list() });
  const matsQ = useQuery({ queryKey: ['materiales'], queryFn: () => materiales.list({ pageSize: 100 }) });

  const [frenteId, setFrenteId] = useState('');
  const [requisicionId, setRequisicionId] = useState('');
  const [items, setItems] = useState<Salida[]>([{ id: uid(), materialId: '', cantidad: 1 }]);
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si hay frente, buscar requisiciones en estado "compras" para ese frente
  const reqsQ = useQuery({
    queryKey: ['reqs-compras', frenteId],
    queryFn: () => requisiciones.list({ estado: 'compras', frenteId, pageSize: 50 }),
    enabled: !!frenteId,
  });

  function addItem() { setItems(c => [...c, { id: uid(), materialId: '', cantidad: 1 }]); }
  function removeItem(id: string) { setItems(c => c.length > 1 ? c.filter(it => it.id !== id) : c); }
  function updItem(id: string, patch: Partial<Salida>) {
    setItems(c => c.map(it => it.id === id ? { ...it, ...patch } : it));
  }

  async function onSubmit() {
    setError(null);
    if (!frenteId) return setError('Selecciona el frente destino');
    const valids = items.filter(it => it.materialId && it.cantidad > 0);
    if (valids.length === 0) return setError('Agrega al menos un material a despachar');

    setSubmitting(true);
    try {
      await bodega.crearSalida({
        frenteId,
        requisicionId: requisicionId || undefined,
        items: valids.map(it => ({ materialId: it.materialId, cantidad: it.cantidad })),
        notas: notas || undefined,
      });
      router.push('/bodega');
    } catch (err) {
      if (err instanceof ApiError) {
        const m = (err.body as any)?.message || err.message;
        setError(typeof m === 'string' ? m : JSON.stringify(m));
      } else setError('Error al registrar salida');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 flex gap-1.5 mb-1.5">
            <Link href="/bodega" className="text-navy-700 hover:underline">Bodega</Link>
            <span>›</span><span>Nueva salida</span>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900 tracking-tight">Despacho a frente</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Material sale de bodega central → entra al inventario del frente
          </p>
        </div>
        <Link href="/bodega" className="btn btn-secondary">← Cancelar</Link>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 text-red-800 text-sm rounded border border-red-200">{error}</div>}

      <div className="card mb-4">
        <div className="p-3.5 border-b border-gray-200">
          <div className="text-[14px] font-semibold text-navy-900">Destino</div>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Frente destino *">
              <select value={frenteId} onChange={(e) => { setFrenteId(e.target.value); setRequisicionId(''); }} className="input">
                <option value="">— Selecciona frente —</option>
                {frentesQ.data?.map((f: any) => (
                  <option key={f.id} value={f.id}>{f.codigo} {f.nombre}</option>
                ))}
              </select>
            </Field>
            <Field label="Requisición asociada (opcional)">
              <select value={requisicionId} onChange={(e) => setRequisicionId(e.target.value)} disabled={!frenteId} className="input">
                <option value="">— Sin requisición específica —</option>
                {reqsQ.data?.data?.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.codigo} · {r.descripcion?.slice(0, 50)}</option>
                ))}
              </select>
            </Field>
          </div>
          {requisicionId && (
            <div className="text-[11.5px] text-st-aprobada bg-emerald-50 px-3 py-2 rounded border border-emerald-200">
              ✓ Al confirmar, la requisición pasará a estado <strong>"Recibida"</strong> automáticamente (cierra el ciclo).
            </div>
          )}
        </div>
      </div>

      <div className="card mb-4">
        <div className="p-3.5 border-b border-gray-200 flex justify-between items-center">
          <div className="text-[14px] font-semibold text-navy-900">Materiales a despachar · {items.length}</div>
          <button type="button" onClick={addItem} className="btn btn-secondary btn-sm">+ Agregar</button>
        </div>
        <div className="p-4 space-y-2.5">
          {items.map((it) => (
            <div key={it.id} className="grid grid-cols-[1fr_120px_auto] gap-2 items-start">
              <select
                value={it.materialId}
                onChange={(e) => updItem(it.id, { materialId: e.target.value })}
                className="input"
              >
                <option value="">— Selecciona material —</option>
                {matsQ.data?.data?.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.sku} · {m.descripcion}</option>
                ))}
              </select>
              <input
                type="number"
                value={it.cantidad}
                onChange={(e) => updItem(it.id, { cantidad: Number(e.target.value) })}
                className="input text-right"
                placeholder="Cant."
                step="0.001"
                min="0"
              />
              <button
                type="button"
                onClick={() => removeItem(it.id)}
                disabled={items.length === 1}
                className="w-9 h-9 rounded grid place-items-center text-st-rechazada hover:bg-red-50 disabled:opacity-30"
              >✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card mb-4">
        <div className="p-3.5 border-b border-gray-200">
          <div className="text-[14px] font-semibold text-navy-900">Notas del despacho</div>
        </div>
        <div className="p-4">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="input min-h-[70px] resize-y"
            placeholder="Ej: Despacho con transportador interno, recibe residente Andrés Patiño…"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Link href="/bodega" className="btn btn-secondary">Cancelar</Link>
        <button onClick={onSubmit} disabled={submitting} className="btn btn-accent px-6 disabled:opacity-50">
          {submitting ? 'Registrando…' : '📤 Confirmar salida'}
        </button>
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
