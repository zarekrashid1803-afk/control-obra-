'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promoCodes, ApiError } from '@/lib/api';

export default function CodigosBetaPage() {
  const qc = useQueryClient();
  const listQ = useQuery({ queryKey: ['promo-codes'], queryFn: () => promoCodes.list() });

  const [cantidad, setCantidad] = useState(1);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ultimoLote, setUltimoLote] = useState<string[] | null>(null);

  const generar = useMutation({
    mutationFn: () => promoCodes.generar(cantidad, notes || undefined),
    onSuccess: (data) => {
      setUltimoLote(data.generados);
      setNotes('');
      qc.invalidateQueries({ queryKey: ['promo-codes'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.body?.message || err.message : 'Error');
    },
  });

  const extender = useMutation({
    mutationFn: ({ tenantId, horas }: { tenantId: number; horas: number }) =>
      promoCodes.extenderTrial(tenantId, horas),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promo-codes'] }),
  });

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto);
  }

  function copiarLote() {
    if (!ultimoLote) return;
    copiar(ultimoLote.join('\n'));
  }

  const data = listQ.data || [];
  const usados = data.filter((c: any) => c.usedAt).length;
  const disponibles = data.length - usados;

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="mb-5">
        <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight">
          Códigos de invitación beta
        </h1>
        <p className="text-[12.5px] text-gray-500 mt-1">
          Gestiona los códigos <code className="font-mono">PRE-XXXX</code> que entregas a clientes para que activen su prueba de 120h.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="kpi">
          <div className="kpi-label">Total generados</div>
          <div className="kpi-value">{data.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Disponibles</div>
          <div className="kpi-value">{disponibles}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Canjeados</div>
          <div className="kpi-value">{usados}</div>
        </div>
      </div>

      {/* Generar */}
      <div className="card p-5 mb-6">
        <h2 className="text-[15px] font-semibold text-navy-900 mb-3">Generar nuevos códigos</h2>

        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 text-red-800 text-[13px] rounded border border-red-200">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-3 items-end">
          <div>
            <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">Cantidad</label>
            <input
              type="number"
              min={1}
              max={50}
              value={cantidad}
              onChange={(e) => setCantidad(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
              className="input text-right font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">Notas (opcional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              placeholder="Ej. Constructora X — contacto Juan, demo viernes"
            />
          </div>
          <button
            onClick={() => generar.mutate()}
            disabled={generar.isPending}
            className="btn btn-primary"
          >
            {generar.isPending ? 'Generando…' : '+ Generar'}
          </button>
        </div>

        {ultimoLote && ultimoLote.length > 0 && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded">
            <div className="flex justify-between items-center mb-2">
              <strong className="text-emerald-900 text-[13px]">
                ✓ {ultimoLote.length} código{ultimoLote.length > 1 ? 's' : ''} generado{ultimoLote.length > 1 ? 's' : ''}
              </strong>
              <button onClick={copiarLote} className="text-[12px] text-emerald-700 underline">Copiar todos</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ultimoLote.map((c) => (
                <button
                  key={c}
                  onClick={() => copiar(c)}
                  className="font-mono text-[13px] px-2.5 py-1 bg-white border border-emerald-300 rounded hover:bg-emerald-100"
                  title="Click para copiar"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[700px]">
          <thead>
            <tr>
              <th>Código</th>
              <th>Estado</th>
              <th>Notas</th>
              <th>Canjeado por</th>
              <th>Tenant</th>
              <th>Trial</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((c: any) => {
              const usado = !!c.usedAt;
              const trialActivo = c.trialActivo === true;
              return (
                <tr key={c.id}>
                  <td>
                    <button onClick={() => copiar(c.codigo)} className="font-mono text-[12.5px] font-semibold hover:underline">
                      {c.codigo}
                    </button>
                  </td>
                  <td>
                    <span className={`badge ${usado ? 'badge-aprobada' : 'badge-borrador'}`}>
                      {usado ? 'canjeado' : 'disponible'}
                    </span>
                  </td>
                  <td className="text-[12px] text-gray-600 max-w-[200px] truncate">{c.notes || '—'}</td>
                  <td className="text-[12px]">
                    {c.usedBy ? (
                      <div>
                        <div>{c.usedBy.nombres} {c.usedBy.apellidos}</div>
                        <div className="text-gray-500">{c.usedBy.email}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="text-[12px]">
                    {c.tenant ? <span className="text-navy-900 font-medium">#{c.tenant.id} · {c.tenant.nombre}</span> : '—'}
                  </td>
                  <td className="text-[12px]">
                    {c.tenant ? (
                      <span className={trialActivo ? 'text-st-aprobada font-medium' : 'text-st-rechazada'}>
                        {trialActivo ? `${c.horasRestantes}h restantes` : 'Vencido'}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="text-right">
                    {c.tenant && (
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => extender.mutate({ tenantId: c.tenant.id, horas: 24 })}
                          disabled={extender.isPending}
                          className="btn btn-secondary btn-sm"
                          title="Extender 24h"
                        >+24h</button>
                        <button
                          onClick={() => extender.mutate({ tenantId: c.tenant.id, horas: 720 })}
                          disabled={extender.isPending}
                          className="btn btn-secondary btn-sm"
                          title="Extender 30 días"
                        >+30d</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-500">No hay códigos generados todavía.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-[11px] text-gray-500">
        Solo usuarios con email en <code className="font-mono">SUPERADMIN_EMAILS</code> (env var del backend) pueden generar y extender códigos.
      </div>
    </div>
  );
}
