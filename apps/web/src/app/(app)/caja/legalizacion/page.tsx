'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { caja } from '@/lib/api';
import { fmtCOP, fmtDate } from '@/lib/utils';

/**
 * Vista de "legalización" — días con movimientos pero sin arqueo cerrado.
 * En contabilidad colombiana, "legalizar caja menor" es el proceso de
 * convertir gastos en soporte contable formal mediante arqueo + comprobantes.
 */
export default function LegalizacionCajaPage() {
  const movsQ = useQuery({
    queryKey: ['caja-movimientos-leg'],
    queryFn: () => caja.listMovimientos({ pageSize: 500 }),
  });

  const movs = movsQ.data?.data || [];

  // Agrupar por día
  type DiaInfo = {
    fecha: string; // YYYY-MM-DD
    entradas: bigint;
    salidas: bigint;
    cantidad: number;
    retenciones: bigint;
    arqueoCerrado: boolean;
    arqueoCerradoAt?: Date | null;
    diferencia?: bigint;
  };
  const porDia: Record<string, DiaInfo> = {};

  for (const m of movs) {
    const d = new Date(m.fechaMovimiento);
    const key = d.toISOString().slice(0, 10);
    if (!porDia[key]) {
      porDia[key] = {
        fecha: key,
        entradas: 0n,
        salidas: 0n,
        cantidad: 0,
        retenciones: 0n,
        arqueoCerrado: !!m.arqueoId,
      };
    }
    const monto = BigInt(m.montoCentavos);
    if (m.tipo === 'entrada') porDia[key].entradas += monto;
    else if (m.tipo === 'salida') porDia[key].salidas += monto;
    porDia[key].cantidad++;
    porDia[key].retenciones +=
      BigInt(m.retencionFuenteCentavos || 0n) +
      BigInt(m.retencionIvaCentavos || 0n) +
      BigInt(m.retencionIcaCentavos || 0n);
    if (m.arqueoId) porDia[key].arqueoCerrado = true;
  }

  const dias = Object.values(porDia).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const hoy = new Date().toISOString().slice(0, 10);

  // Si no hay movimientos hoy, agregarlo como "día vacío" para que el usuario pueda hacer el arqueo de hoy
  if (!porDia[hoy]) {
    dias.unshift({ fecha: hoy, entradas: 0n, salidas: 0n, cantidad: 0, retenciones: 0n, arqueoCerrado: false });
  }

  const pendientes = dias.filter(d => !d.arqueoCerrado && d.cantidad > 0).length;
  const cerrados = dias.filter(d => d.arqueoCerrado).length;
  const sumPendiente = dias.filter(d => !d.arqueoCerrado).reduce((s, d) => s + (d.entradas - d.salidas), 0n);

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="mb-4 md:mb-5">
        <div className="text-[11px] text-gray-500 hidden md:flex gap-1.5 mb-1.5">
          <Link href="/caja" className="text-navy-700 hover:underline">Caja menor</Link>
          <span>›</span><span>Solicitud de arqueo y legalización</span>
        </div>
        <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight">
          Solicitud de arqueo y legalización
        </h1>
        <p className="text-[12.5px] md:text-[13px] text-gray-500 mt-1">
          Cierre diario contable de caja menor · cada día con movimientos requiere arqueo firmado
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-5">
        <KpiCard label="Días pendientes" value={String(pendientes)} bar="bg-st-pendiente" warn={pendientes > 0} />
        <KpiCard label="Días legalizados" value={String(cerrados)} bar="bg-st-aprobada" />
        <KpiCard label="Saldo no legalizado" value={fmtCOP(sumPendiente)} bar="bg-st-rechazada" />
        <KpiCard label="Total días" value={String(dias.length)} bar="bg-navy-700" />
      </div>

      <div className="card">
        <div className="p-3.5 border-b border-gray-200">
          <div className="text-[14px] font-semibold text-navy-900">Días por legalizar</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Cada día con movimientos debe tener un acta de arqueo cerrada con firma del Tesorero</div>
        </div>

        {movsQ.isLoading && <div className="p-8 text-center text-gray-500">Cargando…</div>}

        {/* PC */}
        <table className="tbl min-w-[700px] hidden md:table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th className="!text-right">Movimientos</th>
              <th className="!text-right">Entradas</th>
              <th className="!text-right">Salidas</th>
              <th className="!text-right">Retenciones</th>
              <th className="!text-right">Saldo del día</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => {
              const saldo = d.entradas - d.salidas;
              const esHoy = d.fecha === hoy;
              return (
                <tr key={d.fecha} onClick={() => d.cantidad > 0 || esHoy ? window.location.href = `/caja/arqueo/${d.fecha}` : null}>
                  <td>
                    <div className="font-mono text-[13px]">{fmtDate(new Date(d.fecha))}</div>
                    {esHoy && <span className="text-[10px] text-gold-700 font-semibold">HOY</span>}
                  </td>
                  <td className="text-right tabular-nums">{d.cantidad}</td>
                  <td className="text-right tabular-nums text-st-aprobada">{fmtCOP(d.entradas)}</td>
                  <td className="text-right tabular-nums text-st-rechazada">{fmtCOP(d.salidas)}</td>
                  <td className="text-right tabular-nums text-gray-500">{fmtCOP(d.retenciones)}</td>
                  <td className="text-right tabular-nums font-medium">{fmtCOP(saldo)}</td>
                  <td>
                    {d.arqueoCerrado ? (
                      <span className="badge badge-aprobada">✓ Legalizado</span>
                    ) : d.cantidad === 0 ? (
                      <span className="badge badge-borrador">Sin movimientos</span>
                    ) : (
                      <span className="badge badge-pendiente">Pendiente</span>
                    )}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/caja/arqueo/${d.fecha}`}
                      className={`btn ${d.arqueoCerrado ? 'btn-secondary' : 'btn-accent'} btn-sm`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {d.arqueoCerrado ? 'Ver acta' : 'Arquear y legalizar'}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {dias.length === 0 && !movsQ.isLoading && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-500">No hay movimientos registrados.</td></tr>
            )}
          </tbody>
        </table>

        {/* Móvil */}
        <div className="md:hidden divide-y divide-gray-100">
          {dias.map((d) => {
            const saldo = d.entradas - d.salidas;
            const esHoy = d.fecha === hoy;
            return (
              <Link key={d.fecha} href={`/caja/arqueo/${d.fecha}`} className="block p-4 active:bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <div className="font-mono text-[14px] font-semibold text-navy-900">{fmtDate(new Date(d.fecha))}</div>
                    {esHoy && <span className="text-[10px] text-gold-700 font-semibold">HOY</span>}
                  </div>
                  {d.arqueoCerrado ? <span className="badge badge-aprobada">✓ Legalizado</span>
                    : d.cantidad === 0 ? <span className="badge badge-borrador">Sin movs</span>
                    : <span className="badge badge-pendiente">Pendiente</span>}
                </div>
                <div className="flex justify-between text-[12px] text-gray-500">
                  <span>{d.cantidad} movimientos</span>
                  <strong className="text-navy-900 tabular-nums">{fmtCOP(saldo)}</strong>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-5 px-4 py-3 bg-navy-50 border border-navy-100 rounded text-[11.5px] text-gray-700">
        💡 <strong className="text-navy-900">¿Qué es legalizar?</strong> Es el proceso DIAN de cerrar contablemente los movimientos de caja menor de un día — registrar la entrada y salida de efectivo, validar que los soportes coincidan, calcular retenciones y firmar el acta con 2FA. Cada peso no legalizado queda fuera del cierre contable mensual.
      </div>
    </div>
  );
}

function KpiCard({ label, value, bar, warn }: { label: string; value: string; bar: string; warn?: boolean }) {
  return (
    <div className="kpi !p-3 md:!p-4">
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${bar}`} />
      <div className="kpi-label !text-[10px] md:!text-[11px]">{label}</div>
      <div className={`kpi-value !text-[18px] md:!text-[26px] ${warn ? 'text-st-rechazada' : ''}`}>{value}</div>
    </div>
  );
}
