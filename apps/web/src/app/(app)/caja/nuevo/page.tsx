'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { caja, frentes, proveedores, ApiError } from '@/lib/api';
import { fmtCOP } from '@/lib/utils';

export default function NuevoMovimientoCajaPage() {
  const router = useRouter();
  const frentesQ = useQuery({ queryKey: ['frentes'], queryFn: () => frentes.list() });
  const provsQ = useQuery({ queryKey: ['proveedores'], queryFn: () => proveedores.list({ pageSize: 100 }) });

  const [tipo, setTipo] = useState<'entrada'|'salida'|'ajuste'>('salida');
  const [concepto, setConcepto] = useState('');
  const [montoPesos, setMontoPesos] = useState('');
  const [frenteId, setFrenteId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [categoria, setCategoria] = useState('');
  const [aplicaReteFuente, setAplicaReteFuente] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Key de idempotencia ESTABLE por montaje del formulario. Así un doble-click
  // o un reintento de red reusan la misma key → el backend no duplica el
  // movimiento. Se regenera solo al volver a entrar al formulario.
  const idempotencyKey = useRef(
    `caja-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  ).current;

  const monto = Number(montoPesos.replace(/[^0-9.]/g, '')) || 0;
  const reteFuente = aplicaReteFuente && tipo === 'salida' ? Math.round(monto * 0.025) : 0;

  async function onSubmit() {
    setError(null);
    if (!concepto || monto <= 0) {
      setError('El concepto y el monto son obligatorios');
      return;
    }
    if (tipo === 'salida' && !frenteId) {
      setError('Para una salida debes asignar un frente (centro de costos)');
      return;
    }
    setSubmitting(true);
    try {
      await caja.crearMovimiento({
        tipo,
        concepto,
        montoCentavos: String(BigInt(Math.round(monto * 100))),
        frenteId: frenteId || undefined,
        proveedorId: proveedorId || undefined,
        categoria: categoria || undefined,
        retencionFuenteCentavos: reteFuente > 0 ? String(BigInt(reteFuente * 100)) : undefined,
        idempotencyKey,
      });
      router.push('/caja');
    } catch (err) {
      if (err instanceof ApiError) {
        const m = (err.body as any)?.message || err.message;
        setError(typeof m === 'string' ? m : JSON.stringify(m));
      } else setError('Error al guardar movimiento');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[900px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 flex gap-1.5 mb-1.5">
            <Link href="/caja" className="text-navy-700 hover:underline">Caja Menor</Link>
            <span>›</span><span>Nuevo movimiento</span>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900 tracking-tight">Registrar movimiento</h1>
        </div>
        <Link href="/caja" className="btn btn-secondary">← Cancelar</Link>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 text-red-800 text-sm rounded border border-red-200">
          {error}
        </div>
      )}

      <div className="space-y-4">

        {/* Tipo */}
        <div className="card">
          <div className="p-3.5 border-b border-gray-200">
            <div className="text-[14px] font-semibold text-navy-900">Tipo de movimiento</div>
          </div>
          <div className="p-4 flex gap-2">
            <TipoBtn active={tipo === 'entrada'} onClick={() => setTipo('entrada')} color="text-st-aprobada border-emerald-300 bg-emerald-50">
              📥 Entrada (fondeo)
            </TipoBtn>
            <TipoBtn active={tipo === 'salida'} onClick={() => setTipo('salida')} color="text-st-rechazada border-red-300 bg-red-50">
              📤 Salida (gasto)
            </TipoBtn>
            <TipoBtn active={tipo === 'ajuste'} onClick={() => setTipo('ajuste')} color="text-st-pendiente border-amber-300 bg-amber-50">
              ⚙️ Ajuste
            </TipoBtn>
          </div>
        </div>

        <div className="card">
          <div className="p-3.5 border-b border-gray-200">
            <div className="text-[14px] font-semibold text-navy-900">Detalles</div>
          </div>
          <div className="p-4 space-y-3">
            <Field label="Concepto *">
              <input
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                className="input"
                placeholder={tipo === 'salida' ? 'Ej: Compra papelería oficina obra' : tipo === 'entrada' ? 'Ej: Reposición de fondo de caja' : 'Ej: Ajuste por diferencia en arqueo'}
              />
            </Field>

            <Field label="Monto (COP) *">
              <input
                type="text"
                inputMode="numeric"
                value={montoPesos}
                onChange={(e) => setMontoPesos(e.target.value.replace(/[^0-9.]/g, ''))}
                className="input text-right font-mono text-base"
                placeholder="0"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={tipo === 'salida' ? 'Frente (centro de costos) *' : 'Frente (opcional)'}>
                <select value={frenteId} onChange={(e) => setFrenteId(e.target.value)} className="input">
                  <option value="">— Sin frente —</option>
                  {frentesQ.data?.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.codigo} {f.nombre}</option>
                  ))}
                </select>
              </Field>
              <Field label="Categoría contable">
                <input
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="input"
                  placeholder="Ej: 5165 - Gastos diversos"
                />
              </Field>
            </div>

            {tipo === 'salida' && (
              <Field label="Proveedor (si aplica)">
                <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className="input">
                  <option value="">— Sin proveedor —</option>
                  {provsQ.data?.data?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.razonSocial}</option>
                  ))}
                </select>
              </Field>
            )}

            {tipo === 'salida' && (
              <label className="flex items-center gap-2 text-[13px] pt-2">
                <input type="checkbox" checked={aplicaReteFuente} onChange={(e) => setAplicaReteFuente(e.target.checked)} />
                Aplica Retención en la Fuente (2.5%)
              </label>
            )}
          </div>
        </div>

        {/* Resumen */}
        <div className="card">
          <div className="p-3.5 border-b border-gray-200">
            <div className="text-[14px] font-semibold text-navy-900">Resumen</div>
          </div>
          <div className="p-4 space-y-2 text-[13px]">
            <div className="flex justify-between"><span>Monto bruto</span><span className="tabular-nums">{fmtCOP(monto * 100, { full: true })}</span></div>
            {reteFuente > 0 && (
              <div className="flex justify-between text-gray-500"><span>ReteFuente 2.5%</span><span className="tabular-nums">- {fmtCOP(reteFuente * 100, { full: true })}</span></div>
            )}
            <hr className="border-gray-200" />
            <div className="flex justify-between font-bold text-navy-900">
              <span>Movimiento neto</span>
              <span className={`tabular-nums ${tipo === 'salida' ? 'text-st-rechazada' : tipo === 'entrada' ? 'text-st-aprobada' : ''}`}>
                {tipo === 'salida' ? '- ' : tipo === 'entrada' ? '+ ' : ''}{fmtCOP((monto - reteFuente) * 100, { full: true })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Link href="/caja" className="btn btn-secondary">Cancelar</Link>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="btn btn-accent disabled:opacity-50 px-6"
          >
            {submitting ? 'Guardando…' : 'Registrar movimiento'}
          </button>
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

function TipoBtn({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 px-3 rounded border-2 text-[13px] font-medium transition ${
        active ? color : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}
