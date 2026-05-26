'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { caja, ApiError } from '@/lib/api';
import { fmtCOP, fmtDate } from '@/lib/utils';

export default function ArqueoPage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = use(params);
  const router = useRouter();

  const movsQ = useQuery({
    queryKey: ['caja-movimientos-fecha', fecha],
    queryFn: () => caja.listMovimientos({ pageSize: 200 }),
  });

  const arqueoQ = useQuery({
    queryKey: ['arqueo', fecha],
    queryFn: () => caja.getArqueo(fecha),
  });

  const [saldoRealPesos, setSaldoRealPesos] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [mfaCode, setMfaCode] = useState('123456');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Filtrar movimientos del día
  const fechaInicio = new Date(fecha); fechaInicio.setHours(0,0,0,0);
  const fechaFin = new Date(fecha); fechaFin.setHours(23,59,59,999);
  const movsDelDia = (movsQ.data?.data || []).filter((m: any) => {
    const d = new Date(m.fechaMovimiento);
    return d >= fechaInicio && d <= fechaFin;
  });

  // Calcular saldos
  const sumarBigInt = (items: any[], filter: (m: any) => boolean): bigint => {
    let total = 0n;
    for (const m of items) if (filter(m)) total += BigInt(m.montoCentavos);
    return total;
  };
  const entradasDia = sumarBigInt(movsDelDia, (m) => m.tipo === 'entrada');
  const salidasDia = sumarBigInt(movsDelDia, (m) => m.tipo === 'salida');
  // Saldo inicial: histórico antes de hoy
  let saldoInicial = 0n;
  for (const m of (movsQ.data?.data || []) as any[]) {
    if (new Date(m.fechaMovimiento) >= fechaInicio) continue;
    const monto = BigInt(m.montoCentavos);
    if (m.tipo === 'entrada') saldoInicial += monto;
    else if (m.tipo === 'salida') saldoInicial -= monto;
  }
  const saldoEsperado = saldoInicial + entradasDia - salidasDia;
  const saldoReal = BigInt(Math.round((Number(saldoRealPesos.replace(/[^0-9.]/g, '')) || 0) * 100));
  const diferencia = saldoReal - saldoEsperado;

  const yaCerrado = arqueoQ.data?.cerradoAt;

  async function onCerrar() {
    setError(null);
    if (saldoReal === 0n && saldoRealPesos === '') {
      setError('Debes ingresar el saldo real contado');
      return;
    }
    if (diferencia !== 0n && !justificacion) {
      setError(`Hay diferencia de ${fmtCOP(diferencia, { full: true })}. Debes justificarla.`);
      return;
    }
    setSubmitting(true);
    try {
      await caja.cerrarArqueo({
        fecha: new Date(fecha).toISOString(),
        saldoRealCentavos: String(saldoReal),
        justificacionDiferencia: justificacion || undefined,
        mfaCode,
      });
      setSuccess(true);
      setTimeout(() => router.push('/caja'), 1500);
    } catch (err) {
      if (err instanceof ApiError) {
        const m = (err.body as any)?.message || err.message;
        setError(typeof m === 'string' ? m : JSON.stringify(m));
      } else setError('Error al cerrar arqueo');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 flex gap-1.5 mb-1.5">
            <Link href="/caja" className="text-navy-700 hover:underline">Caja Menor</Link>
            <span>›</span><span>Arqueo</span>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900 tracking-tight">
            Arqueo del {fmtDate(new Date(fecha))}
          </h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Conciliación entre el saldo registrado en sistema vs el efectivo físico contado
          </p>
        </div>
        <Link href="/caja" className="btn btn-secondary">← Volver</Link>
      </div>

      {yaCerrado && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 text-emerald-800 text-sm rounded border border-emerald-200 flex items-center gap-2">
          ✓ <strong>Arqueo cerrado</strong> el {fmtDate(yaCerrado)}. Diferencia: {fmtCOP(arqueoQ.data?.diferenciaCentavos || 0, { full: true })}
        </div>
      )}

      {error && <div className="mb-4 px-4 py-3 bg-red-50 text-red-800 text-sm rounded border border-red-200">{error}</div>}
      {success && <div className="mb-4 px-4 py-3 bg-emerald-50 text-emerald-800 text-sm rounded border border-emerald-200">✓ Arqueo cerrado correctamente. Redirigiendo…</div>}

      <div className="grid grid-cols-[1fr_1fr] gap-4 max-[900px]:grid-cols-1">

        <div className="space-y-4">
          {/* Resumen del día */}
          <div className="card">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Resumen del día</div>
            </div>
            <div className="p-4 space-y-3 text-[13px]">
              <Row k="Saldo inicial (día anterior)" v={fmtCOP(saldoInicial, { full: true })} />
              <Row k="Entradas del día" v={`+ ${fmtCOP(entradasDia, { full: true })}`} color="text-st-aprobada" />
              <Row k="Salidas del día" v={`- ${fmtCOP(salidasDia, { full: true })}`} color="text-st-rechazada" />
              <hr className="border-gray-200" />
              <Row k="Saldo esperado en caja" v={fmtCOP(saldoEsperado, { full: true })} bold />
            </div>
          </div>

          {/* Movimientos del día */}
          <div className="card">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Movimientos del día · {movsDelDia.length}</div>
            </div>
            <table className="tbl">
              <thead><tr><th>Código</th><th>Concepto</th><th>Tipo</th><th className="!text-right">Monto</th></tr></thead>
              <tbody>
                {movsDelDia.map((m: any) => (
                  <tr key={m.id} className="!cursor-default hover:!bg-transparent">
                    <td className="font-mono text-[11px]">{m.codigo}</td>
                    <td className="text-[12px]">{m.concepto}</td>
                    <td><span className={`badge ${m.tipo === 'salida' ? 'badge-rechazada' : m.tipo === 'entrada' ? 'badge-aprobada' : 'badge-pendiente'}`}>{m.tipo}</span></td>
                    <td className={`text-right tabular-nums font-medium ${m.tipo === 'salida' ? 'text-st-rechazada' : m.tipo === 'entrada' ? 'text-st-aprobada' : ''}`}>
                      {m.tipo === 'salida' ? '- ' : m.tipo === 'entrada' ? '+ ' : ''}{fmtCOP(m.montoCentavos)}
                    </td>
                  </tr>
                ))}
                {movsDelDia.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6 text-gray-500">Sin movimientos este día</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Conteo y cierre */}
        <div className="space-y-4">
          <div className="card">
            <div className="p-3.5 border-b border-gray-200">
              <div className="text-[14px] font-semibold text-navy-900">Conteo físico</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Cuenta el efectivo + cheques + soportes en caja</div>
            </div>
            <div className="p-5">
              <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-2">Saldo real contado (COP)</label>
              <input
                type="text"
                inputMode="numeric"
                value={saldoRealPesos}
                onChange={(e) => setSaldoRealPesos(e.target.value.replace(/[^0-9.]/g, ''))}
                disabled={!!yaCerrado}
                className="w-full px-4 py-4 text-[24px] text-right font-bold font-mono border-2 border-navy-700 rounded-lg focus:outline-none focus:ring-4 focus:ring-navy-500/20 disabled:bg-gray-100"
                placeholder="0"
              />

              <div className="mt-5 space-y-2 text-[13px]">
                <div className="flex justify-between"><span className="text-gray-500">Saldo esperado</span><span className="tabular-nums">{fmtCOP(saldoEsperado, { full: true })}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Saldo real contado</span><span className="tabular-nums">{fmtCOP(saldoReal, { full: true })}</span></div>
                <hr className="border-gray-200" />
                <div className={`flex justify-between font-bold text-[15px] ${
                  diferencia === 0n ? 'text-st-aprobada'
                  : diferencia > 0n ? 'text-st-avalada'
                  : 'text-st-rechazada'
                }`}>
                  <span>Diferencia</span>
                  <span className="tabular-nums">
                    {diferencia === 0n ? '✓ Cuadrado'
                      : diferencia > 0n ? `+ ${fmtCOP(diferencia, { full: true })} (sobrante)`
                      : `${fmtCOP(diferencia, { full: true })} (faltante)`}
                  </span>
                </div>
              </div>

              {diferencia !== 0n && !yaCerrado && (
                <div className="mt-4">
                  <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">Justificación de diferencia *</label>
                  <textarea
                    value={justificacion}
                    onChange={(e) => setJustificacion(e.target.value)}
                    placeholder="Explica brevemente la causa de la diferencia (faltante o sobrante)..."
                    className="input min-h-[80px] resize-y"
                  />
                </div>
              )}
            </div>
          </div>

          {!yaCerrado && (
            <div className="card p-4 space-y-3 bg-gold-100 border-gold-500/40">
              <div className="text-[11px] uppercase font-semibold text-gold-700 tracking-wider">Cerrar arqueo</div>
              <div className="text-[12px] text-gray-600">
                Una vez cerrado, los movimientos del día <strong>no podrán modificarse</strong>.
                Se requiere 2FA del responsable de caja.
              </div>
              <div>
                <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">Código 2FA</label>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  maxLength={6}
                  className="input text-center font-mono tracking-widest text-base"
                  placeholder="000000"
                />
                <div className="text-[10.5px] text-gray-500 mt-1">En beta acepta cualquier código de 6 dígitos (123456)</div>
              </div>
              <button
                onClick={onCerrar}
                disabled={submitting}
                className="btn btn-accent w-full justify-center py-2.5 disabled:opacity-50"
              >
                {submitting ? 'Cerrando…' : '🔒 Cerrar arqueo y firmar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, bold, color }: { k: string; v: string; bold?: boolean; color?: string }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-navy-900 text-[15px]' : ''} ${color || ''}`}>
      <span>{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
