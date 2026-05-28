'use client';
import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ordenesCompra, bodega, ApiError, getApiErrorMessage } from '@/lib/api';
import { fmtCOP } from '@/lib/utils';

type ItemRecepcion = {
  ocItemId: string;
  descripcion: string;
  unidad: string;
  cantidadEsperada: number;
  cantidadRecibida: number;
  estadoItem: 'completo' | 'parcial' | 'danado' | 'vencido';
  observaciones: string;
};

export default function RecepcionPage({ params }: { params: Promise<{ ocId: string }> }) {
  const { ocId } = use(params);
  const router = useRouter();

  const ocQ = useQuery({ queryKey: ['oc', ocId], queryFn: () => ordenesCompra.get(ocId) });

  const [items, setItems] = useState<ItemRecepcion[]>([]);
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ocQ.data?.items && items.length === 0) {
      setItems(ocQ.data.items.map((it: any) => ({
        ocItemId: it.id,
        descripcion: it.descripcion,
        unidad: it.unidad,
        cantidadEsperada: Number(it.cantidad),
        cantidadRecibida: Number(it.cantidad),
        estadoItem: 'completo',
        observaciones: '',
      })));
    }
  }, [ocQ.data, items.length]);

  function updateItem(idx: number, patch: Partial<ItemRecepcion>) {
    setItems(curr => curr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function ajusteRapido(idx: number, tipo: 'completo' | 'cero') {
    const it = items[idx];
    updateItem(idx, {
      cantidadRecibida: tipo === 'completo' ? it.cantidadEsperada : 0,
      estadoItem: tipo === 'completo' ? 'completo' : 'parcial',
    });
  }

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await bodega.crearEntrada({
        ordenCompraId: ocId,
        items: items.map(it => ({
          ocItemId: it.ocItemId,
          cantidadRecibida: it.cantidadRecibida,
          estadoItem: it.estadoItem,
          observaciones: it.observaciones || undefined,
        })),
        notas: notas || undefined,
      });
      router.push('/bodega');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(getApiErrorMessage(err));
      } else setError('Error al registrar entrada');
    } finally {
      setSubmitting(false);
    }
  }

  if (ocQ.isLoading) return <div className="p-8 text-gray-500">Cargando OC…</div>;
  if (ocQ.isError || !ocQ.data) return <div className="p-8 text-red-700">No se pudo cargar la OC</div>;
  const o = ocQ.data;

  const totalEsperado = items.reduce((s, it) => s + it.cantidadEsperada, 0);
  const totalRecibido = items.reduce((s, it) => s + it.cantidadRecibida, 0);
  const todoCompleto = items.every(it => it.cantidadRecibida >= it.cantidadEsperada);

  return (
    <div className="max-w-[1300px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 flex gap-1.5 mb-1.5">
            <Link href="/bodega" className="text-navy-700 hover:underline">Bodega</Link>
            <span>›</span><span>Recepción</span>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900 tracking-tight">
            Recepción de <span className="font-mono">{o.codigo}</span>
          </h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Proveedor: <strong>{o.proveedor?.razonSocial}</strong> · Frente: <strong>{o.frente?.codigo} {o.frente?.nombre}</strong>
          </p>
        </div>
        <Link href="/bodega" className="btn btn-secondary">← Cancelar</Link>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 text-red-800 text-sm rounded border border-red-200">{error}</div>}

      <div className="card mb-4">
        <div className="p-3.5 border-b border-gray-200 flex justify-between items-center">
          <div>
            <div className="text-[14px] font-semibold text-navy-900">Verificación de items · {items.length}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Confirma que lo que llegó coincide con lo que pedimos. Marca cualquier novedad.</div>
          </div>
          <div className="text-[13px] text-gray-600 tabular-nums">
            Recibido: <strong>{totalRecibido}</strong> / Esperado: {totalEsperado}
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Descripción</th>
              <th className="!text-right">Esperado</th>
              <th className="!text-right">Recibido</th>
              <th>Estado</th>
              <th>Observaciones</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const diff = it.cantidadRecibida - it.cantidadEsperada;
              return (
                <tr key={it.ocItemId} className="!cursor-default hover:!bg-transparent">
                  <td className="max-w-[300px]">
                    <div>{it.descripcion}</div>
                    <div className="text-[11px] text-gray-500">{it.unidad}</div>
                  </td>
                  <td className="text-right tabular-nums">{it.cantidadEsperada}</td>
                  <td className="text-right">
                    <input
                      type="number"
                      value={it.cantidadRecibida}
                      onChange={(e) => updateItem(idx, { cantidadRecibida: Number(e.target.value) })}
                      className="input text-right w-24 py-1.5"
                      min="0"
                      step="0.001"
                    />
                    {diff !== 0 && (
                      <div className={`text-[10.5px] mt-1 ${diff > 0 ? 'text-st-avalada' : 'text-st-rechazada'}`}>
                        {diff > 0 ? `+ ${diff} sobrante` : `${diff} faltante`}
                      </div>
                    )}
                  </td>
                  <td>
                    <select
                      value={it.estadoItem}
                      onChange={(e) => updateItem(idx, { estadoItem: e.target.value as any })}
                      className="input py-1.5 text-[12px] w-32"
                    >
                      <option value="completo">✓ Completo</option>
                      <option value="parcial">⚠ Parcial</option>
                      <option value="danado">✗ Dañado</option>
                      <option value="vencido">⏰ Vencido</option>
                    </select>
                  </td>
                  <td>
                    <input
                      value={it.observaciones}
                      onChange={(e) => updateItem(idx, { observaciones: e.target.value })}
                      className="input py-1.5 text-[12px]"
                      placeholder={it.estadoItem !== 'completo' ? 'Detalla la novedad…' : 'Opcional'}
                    />
                  </td>
                  <td className="text-right">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => ajusteRapido(idx, 'completo')} title="Marcar completo" className="text-[10px] text-st-aprobada hover:underline">✓ Todo</button>
                      <button onClick={() => ajusteRapido(idx, 'cero')} title="No llegó" className="text-[10px] text-st-rechazada hover:underline">✗ 0</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card mb-4">
        <div className="p-3.5 border-b border-gray-200">
          <div className="text-[14px] font-semibold text-navy-900">Notas generales de la recepción</div>
        </div>
        <div className="p-4">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="input min-h-[80px] resize-y"
            placeholder="Ej: Llegada a las 14:30, transportador Sr. Mauricio Ortega, vehículo placa AAA-123…"
          />
        </div>
      </div>

      <div className={`card p-5 ${todoCompleto ? 'bg-emerald-50 border-emerald-200' : 'bg-gold-100 border-gold-500/40'}`}>
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <div className="text-[13px]">
            <div className="font-semibold text-navy-900">
              {todoCompleto ? '✓ Recepción completa' : '⚠ Recepción parcial'}
            </div>
            <div className="text-gray-600 mt-1">
              {todoCompleto
                ? 'La OC pasará a estado "Recibida total"'
                : 'La OC quedará como "Recibida parcial" — podrás recibir el resto después'}
            </div>
          </div>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="btn btn-accent justify-center px-8 py-3 disabled:opacity-50"
          >
            {submitting ? 'Registrando…' : '📥 Confirmar recepción'}
          </button>
        </div>
      </div>
    </div>
  );
}
