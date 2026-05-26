'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requisiciones } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { EstadoBadge } from '@/components/badge';
import { fmtCOP, fmtRelative, ESTADO_LABEL } from '@/lib/utils';

type Tab = 'pendientes' | 'avaladas' | 'sobre_presupuesto' | 'urgentes';

export default function EvaluacionPage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('avaladas');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');

  const isDirector = user?.roles?.includes('director');
  const isResidente = user?.roles?.includes('residente');

  const q = useQuery({
    queryKey: ['requisiciones', 'eval'],
    queryFn: () => requisiciones.list({ pageSize: 100 }),
  });

  const trans = useMutation({
    mutationFn: ({ id, accion, motivoRechazo }: { id: string; accion: string; motivoRechazo?: string }) =>
      requisiciones.transicion(id, accion, undefined, motivoRechazo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisiciones'] });
      setRejectingId(null);
      setMotivo('');
    },
  });

  const all = (q.data?.data || []);
  const pendientes  = all.filter((r: any) => r.estado === 'pendiente');
  const avaladas    = all.filter((r: any) => r.estado === 'avalada');
  const sobrePresup = all.filter((r: any) => r.sobrePresupuesto && ['pendiente', 'avalada'].includes(r.estado));
  const urgentes    = all.filter((r: any) => r.prioridad === 'urgente' && ['pendiente', 'avalada'].includes(r.estado));

  const counts = {
    pendientes: pendientes.length,
    avaladas: avaladas.length,
    sobre_presupuesto: sobrePresup.length,
    urgentes: urgentes.length,
  };

  const lista = tab === 'pendientes' ? pendientes
    : tab === 'avaladas' ? avaladas
    : tab === 'sobre_presupuesto' ? sobrePresup
    : urgentes;

  // Calcular monto total de cada categoría
  const sum = (arr: any[]) => arr.reduce((s: bigint, r: any) => s + BigInt(r.totalCentavos), 0n);
  const totalMostrado = sum(lista);

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="mb-4 md:mb-5">
        <div className="text-[11px] text-gray-500 hidden md:flex gap-1.5 mb-1.5">
          <Link href="/dashboard" className="text-navy-700 hover:underline">Inicio</Link>
          <span>›</span><span>Evaluación y aprobación</span>
        </div>
        <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight">
          Evaluación y aprobación
        </h1>
        <p className="text-[12.5px] md:text-[13px] text-gray-500 mt-1">
          Workspace para revisar requisiciones que requieren tu decisión · {isDirector ? 'Director' : isResidente ? 'Residente avalador' : 'Solo lectura'}
        </p>
      </div>

      {/* Tabs con counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
        <TabCard
          active={tab === 'avaladas'}
          onClick={() => setTab('avaladas')}
          label="Para aprobar"
          count={counts.avaladas}
          sub={isDirector ? 'Tu firma pendiente' : 'Esperando Director'}
          accent="bg-st-avalada"
        />
        <TabCard
          active={tab === 'pendientes'}
          onClick={() => setTab('pendientes')}
          label="Para avalar"
          count={counts.pendientes}
          sub={isResidente ? 'Tu aval requerido' : 'Esperando Residente'}
          accent="bg-st-pendiente"
        />
        <TabCard
          active={tab === 'urgentes'}
          onClick={() => setTab('urgentes')}
          label="Urgentes"
          count={counts.urgentes}
          sub="Prioridad alta"
          accent="bg-st-rechazada"
          warn={counts.urgentes > 0}
        />
        <TabCard
          active={tab === 'sobre_presupuesto'}
          onClick={() => setTab('sobre_presupuesto')}
          label="Sobre presupuesto"
          count={counts.sobre_presupuesto}
          sub="Requieren autorización extra"
          accent="bg-st-rechazada"
          warn={counts.sobre_presupuesto > 0}
        />
      </div>

      {/* Resumen monto */}
      <div className="card !p-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[13px] text-gray-600">
          Mostrando <strong className="text-navy-900">{lista.length}</strong> requisiciones · monto total <strong className="text-navy-900 font-mono">{fmtCOP(totalMostrado, { full: true })}</strong>
        </div>
        <Link href="/requisiciones" className="text-[12px] text-navy-700 hover:underline">Ver todas las requisiciones →</Link>
      </div>

      {/* Lista */}
      {q.isLoading && <div className="card p-8 text-center text-gray-500">Cargando…</div>}

      {q.data && lista.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <div className="text-[15px] font-semibold text-navy-900 mb-1">No hay nada por evaluar</div>
          <div className="text-[12.5px] text-gray-500">
            {tab === 'avaladas' && 'Todas las requisiciones avaladas ya fueron decididas.'}
            {tab === 'pendientes' && 'No hay requisiciones esperando aval.'}
            {tab === 'urgentes' && 'No hay requisiciones urgentes pendientes.'}
            {tab === 'sobre_presupuesto' && 'Ninguna requisición excede el presupuesto.'}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {lista.map((r: any) => {
          const canApprove = isDirector && r.estado === 'avalada' && r.solicitanteId !== user?.id;
          const canEndorse = isResidente && r.estado === 'pendiente' && r.solicitanteId !== user?.id;
          const canReject = canApprove || canEndorse;
          const isRejecting = rejectingId === r.id;

          return (
            <div key={r.id} className="card !p-0 overflow-hidden">
              <div className="p-4 md:p-5">
                <div className="flex justify-between items-start gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/requisiciones/${r.id}`} className="font-mono text-[13px] font-semibold text-navy-900 hover:underline">
                      {r.codigo}
                    </Link>
                    <EstadoBadge estado={r.estado} />
                    {r.prioridad === 'urgente' && (
                      <span className="badge badge-rechazada">🔥 URGENTE</span>
                    )}
                    {r.sobrePresupuesto && (
                      <span className="badge badge-pendiente">⚠ SOBRE PRESUPUESTO</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[16px] md:text-[18px] font-bold text-navy-900 tabular-nums">{fmtCOP(r.totalCentavos)}</div>
                    <div className="text-[10.5px] text-gray-500">{fmtRelative(r.fechaCreacion)}</div>
                  </div>
                </div>

                <div className="text-[14px] text-navy-900 font-medium mb-2">{r.descripcion}</div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-gray-600 mb-3">
                  <span><span className="text-gray-400">Frente:</span> <span className="chip">{r.frente?.codigo} {r.frente?.nombre}</span></span>
                  <span><span className="text-gray-400">Solicitante:</span> <strong>{r.solicitante?.nombres} {r.solicitante?.apellidos}</strong></span>
                  <span><span className="text-gray-400">Items:</span> <strong>{r._count?.items || r.itemCount || 0}</strong></span>
                  {r.avalador && (
                    <span><span className="text-gray-400">Avalado por:</span> <strong>{r.avalador.nombres}</strong></span>
                  )}
                </div>

                {/* Acciones contextuales */}
                {!isRejecting ? (
                  <div className="flex gap-2 flex-wrap">
                    <Link href={`/requisiciones/${r.id}`} className="btn btn-secondary btn-sm">Ver detalle</Link>
                    {canEndorse && (
                      <button
                        onClick={() => trans.mutate({ id: r.id, accion: 'avalar' })}
                        disabled={trans.isPending}
                        className="btn btn-accent btn-sm"
                      >
                        {trans.isPending ? '...' : '✓ Avalar'}
                      </button>
                    )}
                    {canApprove && (
                      <button
                        onClick={() => trans.mutate({ id: r.id, accion: 'aprobar' })}
                        disabled={trans.isPending}
                        className="btn btn-accent btn-sm"
                      >
                        {trans.isPending ? '...' : '✓ Aprobar'}
                      </button>
                    )}
                    {canReject && (
                      <button
                        onClick={() => { setRejectingId(r.id); setMotivo(''); }}
                        className="btn btn-secondary btn-sm text-st-rechazada border-red-200"
                      >
                        ✗ Rechazar
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2">
                    <textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Motivo del rechazo (mínimo 5 caracteres)..."
                      className="w-full px-3 py-2 border border-red-200 rounded text-[13px] min-h-[60px]"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setRejectingId(null)} className="btn btn-secondary btn-sm">Cancelar</button>
                      <button
                        disabled={motivo.length < 5 || trans.isPending}
                        onClick={() => trans.mutate({ id: r.id, accion: 'rechazar', motivoRechazo: motivo })}
                        className="btn btn-sm bg-st-rechazada text-white disabled:opacity-50"
                      >
                        Confirmar rechazo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabCard({
  active, onClick, label, count, sub, accent, warn,
}: {
  active: boolean; onClick: () => void; label: string; count: number; sub: string; accent: string; warn?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`card !p-3 md:!p-4 text-left transition relative ${active ? 'ring-2 ring-navy-500 shadow-md' : 'hover:shadow-md'}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${accent}`} />
      <div className="kpi-label !text-[10px] md:!text-[11px]">{label}</div>
      <div className={`kpi-value !text-[20px] md:!text-[28px] ${warn ? 'text-st-rechazada' : ''}`}>{count}</div>
      <div className="text-[10.5px] text-gray-500 mt-0.5">{sub}</div>
    </button>
  );
}
