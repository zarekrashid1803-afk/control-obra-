'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { caja, frentes } from '@/lib/api';
import { fmtCOP, fmtDate, fmtRelative } from '@/lib/utils';

const TIPO_STYLES: Record<string, string> = {
  entrada: 'badge-aprobada',
  salida: 'badge-rechazada',
  ajuste: 'badge-pendiente',
};

export default function CajaPage() {
  const [tipo, setTipo] = useState('');
  const [frenteId, setFrenteId] = useState('');

  const movsQ = useQuery({
    queryKey: ['caja-movimientos', { tipo, frenteId }],
    queryFn: () => caja.listMovimientos({ pageSize: 100 }),
  });

  const frentesQ = useQuery({ queryKey: ['frentes'], queryFn: () => frentes.list() });

  const all = movsQ.data?.data || [];
  const data = all
    .filter((m: any) => !tipo || m.tipo === tipo)
    .filter((m: any) => !frenteId || m.frenteId === frenteId);

  // Calcular saldo y métricas del mes
  const now = new Date();
  const mesActual = data.filter((m: any) => {
    const d = new Date(m.fechaMovimiento);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const entradasMes = mesActual.filter((m: any) => m.tipo === 'entrada').reduce((s: bigint, m: any) => s + BigInt(m.montoCentavos), 0n);
  const salidasMes = mesActual.filter((m: any) => m.tipo === 'salida').reduce((s: bigint, m: any) => s + BigInt(m.montoCentavos), 0n);
  const saldo = entradasMes - salidasMes;

  // Saldo total histórico
  const saldoTotal = data.reduce((s: bigint, m: any) => {
    const monto = BigInt(m.montoCentavos);
    return m.tipo === 'entrada' ? s + monto : s - monto;
  }, 0n);

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 flex gap-1.5 mb-1.5">
            <Link href="/dashboard" className="text-navy-700 hover:underline">Inicio</Link>
            <span>›</span><span>Caja Menor</span>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900 tracking-tight">Caja Menor Central</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Fondo único para egresos pequeños · cada movimiento imputado a un centro de costos
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/caja/arqueo/${hoy}`} className="btn btn-secondary">📋 Arqueo del día</Link>
          <Link href="/caja/nuevo" className="btn btn-primary">+ Nuevo movimiento</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-5">
        <KpiCard label="Saldo actual estimado" value={fmtCOP(saldoTotal)} bar={saldoTotal >= 0n ? 'bg-st-aprobada' : 'bg-st-rechazada'} accent />
        <KpiCard label="Entradas del mes" value={fmtCOP(entradasMes)} bar="bg-st-aprobada" />
        <KpiCard label="Salidas del mes" value={fmtCOP(salidasMes)} bar="bg-st-rechazada" />
        <KpiCard label="Movimientos del mes" value={String(mesActual.length)} bar="bg-navy-700" />
      </div>

      {/* Filtros + tabla */}
      <div className="card">
        <div className="p-3 border-b border-gray-200 flex gap-2.5 flex-wrap items-center">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input" style={{ width: 'auto' }}>
            <option value="">Todos los tipos</option>
            <option value="entrada">Entradas</option>
            <option value="salida">Salidas</option>
            <option value="ajuste">Ajustes</option>
          </select>
          <select value={frenteId} onChange={(e) => setFrenteId(e.target.value)} className="input" style={{ width: 'auto' }}>
            <option value="">Todos los frentes</option>
            {frentesQ.data?.map((f: any) => (
              <option key={f.id} value={f.id}>{f.codigo} {f.nombre}</option>
            ))}
          </select>
          <div className="text-[11.5px] text-gray-500 ml-auto">
            {data.length} movimientos visibles
          </div>
        </div>

        {movsQ.isLoading && <div className="p-8 text-center text-gray-500">Cargando…</div>}

        {movsQ.data && (
          <table className="tbl min-w-[700px]">
            <thead>
              <tr>
                <th>Código</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Concepto</th>
                <th>Frente</th>
                <th>Proveedor</th>
                <th>Autorizado</th>
                <th className="!text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m: any) => (
                <tr key={m.id}>
                  <td className="font-mono text-[11.5px] text-gray-600">{m.codigo}</td>
                  <td className="text-[12px] text-gray-600">{fmtDate(m.fechaMovimiento)}</td>
                  <td><span className={`badge ${TIPO_STYLES[m.tipo] || 'badge-borrador'}`}>{m.tipo}</span></td>
                  <td className="max-w-[280px]">{m.concepto}</td>
                  <td>{m.frente && <span className="chip">{m.frente.codigo}</span>}</td>
                  <td className="text-[12px]">{m.proveedor?.razonSocial || '—'}</td>
                  <td className="text-[12px]">
                    {m.autorizadoPor && <span className="avatar w-6 h-6 text-[10px]">{m.autorizadoPor.iniciales}</span>}
                  </td>
                  <td className={`text-right tabular-nums font-medium ${m.tipo === 'salida' ? 'text-st-rechazada' : m.tipo === 'entrada' ? 'text-st-aprobada' : ''}`}>
                    {m.tipo === 'salida' ? '- ' : m.tipo === 'entrada' ? '+ ' : ''}{fmtCOP(m.montoCentavos)}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-500">
                  No hay movimientos. <Link href="/caja/nuevo" className="text-navy-700 underline">Registrar el primero →</Link>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, bar, accent }: { label: string; value: string; bar: string; accent?: boolean }) {
  return (
    <div className="kpi">
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${bar}`} />
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${accent ? 'text-st-aprobada' : ''}`}>{value}</div>
    </div>
  );
}
