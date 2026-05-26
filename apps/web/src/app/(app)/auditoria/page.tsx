'use client';
import { useState, Suspense, Fragment } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { auditoria, usuarios } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { fmtRelative, fmtDate } from '@/lib/utils';

const ENTIDADES = [
  { v: '', l: 'Todas las entidades' },
  { v: 'requisiciones', l: 'Requisiciones' },
  { v: 'ordenes-compra', l: 'Órdenes de Compra' },
  { v: 'frentes', l: 'Frentes' },
  { v: 'proveedores', l: 'Proveedores' },
  { v: 'materiales', l: 'Materiales' },
  { v: 'usuarios', l: 'Usuarios' },
  { v: 'caja', l: 'Caja Menor' },
  { v: 'bodega', l: 'Bodega' },
  { v: 'documentos-soporte', l: 'Documentos Soporte' },
];

// Mapeo de método HTTP → label y color
const METHOD_STYLE: Record<string, { label: string; classes: string }> = {
  POST:   { label: 'CREAR',     classes: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  PUT:    { label: 'ACTUALIZAR', classes: 'bg-blue-100 text-blue-800 border-blue-200' },
  PATCH:  { label: 'EDITAR',    classes: 'bg-amber-100 text-amber-800 border-amber-200' },
  DELETE: { label: 'ELIMINAR',  classes: 'bg-red-100 text-red-800 border-red-200' },
};

function parseAccion(accion: string): { method: string; endpoint: string } {
  const match = accion.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/);
  if (match) return { method: match[1], endpoint: match[2] };
  return { method: 'GET', endpoint: accion };
}

function AuditoriaInner() {
  const sp = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const [entidad, setEntidad] = useState(sp.get('entidad') || '');
  const [actorId, setActorId] = useState(sp.get('actorId') || '');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const entidadId = sp.get('entidadId') || '';

  const canSee = user?.roles?.some((r) => ['admin', 'director', 'auditor'].includes(r));

  const filters: Record<string, any> = { pageSize: 200 };
  if (entidad) filters.entidad = entidad;
  if (entidadId) filters.entidadId = entidadId;
  if (actorId) filters.actorId = actorId;

  const q = useQuery({
    queryKey: ['auditoria', filters],
    queryFn: () => auditoria.list(filters),
    enabled: !!canSee,
  });

  const usersQ = useQuery({
    queryKey: ['usuarios-todos'],
    queryFn: () => usuarios.list({ pageSize: 100 }),
    enabled: !!canSee,
  });

  if (!canSee) {
    return (
      <div className="max-w-2xl mx-auto p-6 md:p-12 text-center">
        <div className="text-5xl mb-3">🔒</div>
        <h1 className="text-[20px] font-bold text-navy-900 mb-2">Acceso restringido</h1>
        <p className="text-[13px] text-gray-600">
          La auditoría está disponible solo para roles <strong>Admin</strong>, <strong>Director</strong> y <strong>Auditor</strong>.
        </p>
      </div>
    );
  }

  let data = (q.data?.data || []);
  if (search) {
    const s = search.toLowerCase();
    data = data.filter((row: any) =>
      row.accion?.toLowerCase().includes(s) ||
      row.entidad?.toLowerCase().includes(s) ||
      row.entidadId?.toLowerCase().includes(s) ||
      row.actor?.nombres?.toLowerCase().includes(s) ||
      row.actor?.apellidos?.toLowerCase().includes(s)
    );
  }

  const total = q.data?.pagination?.total || 0;

  // Métricas
  const hoyStart = new Date(); hoyStart.setHours(0, 0, 0, 0);
  const sieteAtras = new Date(); sieteAtras.setDate(sieteAtras.getDate() - 7);

  const accionesHoy = data.filter((r: any) => new Date(r.creadoAt) >= hoyStart).length;
  const accionesSemana = data.filter((r: any) => new Date(r.creadoAt) >= sieteAtras).length;
  const actoresUnicos = new Set(data.map((r: any) => r.actorId).filter(Boolean)).size;
  const accionesDelete = data.filter((r: any) => r.accion?.startsWith('DELETE')).length;

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="flex md:items-end justify-between mb-4 md:mb-5 gap-3 flex-col md:flex-row">
        <div>
          <div className="text-[11px] text-gray-500 hidden md:flex gap-1.5 mb-1.5">
            <Link href="/dashboard" className="text-navy-700 hover:underline">Inicio</Link>
            <span>›</span><span>Auditoría</span>
          </div>
          <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight">Bitácora de auditoría</h1>
          <p className="text-[12.5px] md:text-[13px] text-gray-500 mt-1">
            Registro <strong>inmutable</strong> de toda operación sensible · {total} eventos totales
          </p>
        </div>
        {(entidadId || actorId || entidad) && (
          <Link href="/auditoria" className="btn btn-secondary text-[12px]">
            ✕ Limpiar filtros
          </Link>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-5">
        <KpiCard label="Acciones hoy" value={String(accionesHoy)} bar="bg-navy-700" />
        <KpiCard label="Últimos 7 días" value={String(accionesSemana)} bar="bg-st-aprobada" />
        <KpiCard label="Actores únicos" value={String(actoresUnicos)} bar="bg-st-compras" />
        <KpiCard label="Eliminaciones" value={String(accionesDelete)} bar="bg-st-rechazada" warn={accionesDelete > 0} />
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="p-3 flex gap-2 flex-wrap items-center">
          <div className="flex-1 min-w-[200px] flex items-center gap-1.5 border border-gray-300 rounded px-2.5 bg-white">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Buscar por acción, persona, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 outline-none py-2 text-[13px] w-full"
            />
          </div>
          <select value={entidad} onChange={(e) => setEntidad(e.target.value)} className="px-2.5 py-2 border border-gray-300 rounded text-[12.5px] bg-white">
            {ENTIDADES.map(e => <option key={e.v} value={e.v}>{e.l}</option>)}
          </select>
          <select value={actorId} onChange={(e) => setActorId(e.target.value)} className="px-2.5 py-2 border border-gray-300 rounded text-[12.5px] bg-white">
            <option value="">Todos los usuarios</option>
            {usersQ.data?.data?.map((u: any) => (
              <option key={u.id} value={u.id}>{u.nombres} {u.apellidos}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Filtro activo de entidad específica */}
      {entidadId && (
        <div className="mb-4 px-4 py-3 bg-gold-100 border border-gold-500/30 rounded text-[13px] flex items-center gap-2 flex-wrap">
          🔎 Mostrando historial de la entidad <code className="font-mono bg-white px-2 py-0.5 rounded">{entidadId.slice(0, 8)}...</code>
          <Link href="/auditoria" className="ml-auto text-navy-700 underline text-[12px]">Ver todo</Link>
        </div>
      )}

      <div className="card">
        {q.isLoading && <div className="p-8 text-center text-gray-500">Cargando bitácora…</div>}
        {q.isError && <div className="p-8 text-center text-red-700 bg-red-50">Error al cargar auditoría</div>}

        {q.data && data.length === 0 && (
          <div className="p-10 text-center text-gray-500">
            <div className="text-3xl mb-2">🔍</div>
            No hay eventos que coincidan con los filtros.
          </div>
        )}

        {/* PC */}
        {q.data && data.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <table className="tbl min-w-[800px]">
              <thead>
                <tr>
                  <th className="!w-[150px]">Cuándo</th>
                  <th>Quién</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Identificador</th>
                  <th>IP</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((row: any) => {
                  const { method, endpoint } = parseAccion(row.accion || '');
                  const style = METHOD_STYLE[method] || { label: method, classes: 'bg-gray-100 text-gray-800 border-gray-200' };
                  const isExpanded = expanded === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr onClick={() => setExpanded(isExpanded ? null : row.id)}>
                        <td>
                          <div className="text-[12.5px]">{fmtRelative(row.creadoAt)}</div>
                          <div className="text-[10.5px] text-gray-500">{fmtDate(row.creadoAt)} {new Date(row.creadoAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td>
                          {row.actor ? (
                            <div className="flex items-center gap-2">
                              <span className="avatar w-6 h-6 text-[10px]">{row.actor.iniciales}</span>
                              <span className="text-[12.5px]">{row.actor.nombres} {row.actor.apellidos}</span>
                            </div>
                          ) : (
                            <span className="text-[12px] text-gray-400 italic">Sistema</span>
                          )}
                        </td>
                        <td>
                          <span className={`inline-block px-2 py-0.5 border rounded text-[10.5px] font-bold ${style.classes}`}>
                            {style.label}
                          </span>
                          <div className="text-[11px] font-mono text-gray-500 mt-0.5">{endpoint}</div>
                        </td>
                        <td>
                          <span className="chip capitalize text-[11px]">{(row.entidad || '').replace(/-/g, ' ')}</span>
                        </td>
                        <td className="font-mono text-[11px] text-gray-500">
                          {row.entidadId ? row.entidadId.slice(0, 8) + '...' : '—'}
                        </td>
                        <td className="font-mono text-[11px] text-gray-500">{row.ip || '—'}</td>
                        <td className="text-right">
                          {row.cambios && (
                            <button className="text-[11px] text-navy-700 hover:underline">
                              {isExpanded ? '▴ Ocultar' : '▾ Ver cambios'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && row.cambios && (
                        <tr className="!cursor-default hover:!bg-transparent">
                          <td colSpan={7} className="bg-gray-50 !py-3 !px-6">
                            <div className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider mb-2">Cambios registrados</div>
                            <pre className="bg-navy-900 text-emerald-200 p-3 rounded text-[11.5px] overflow-x-auto font-mono leading-relaxed">{JSON.stringify(row.cambios, null, 2)}</pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Móvil */}
        {q.data && data.length > 0 && (
          <div className="md:hidden divide-y divide-gray-100">
            {data.map((row: any) => {
              const { method, endpoint } = parseAccion(row.accion || '');
              const style = METHOD_STYLE[method] || { label: method, classes: 'bg-gray-100 text-gray-800' };
              const isExpanded = expanded === row.id;
              return (
                <div key={row.id} className="p-3.5">
                  <button onClick={() => setExpanded(isExpanded ? null : row.id)} className="w-full text-left active:bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-block px-2 py-0.5 border rounded text-[10px] font-bold ${style.classes}`}>{style.label}</span>
                      <span className="chip capitalize text-[10.5px]">{(row.entidad || '').replace(/-/g, ' ')}</span>
                      <span className="ml-auto text-[10.5px] text-gray-500">{fmtRelative(row.creadoAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      {row.actor ? (
                        <>
                          <span className="avatar w-6 h-6 text-[10px]">{row.actor.iniciales}</span>
                          <span className="text-[13px]">{row.actor.nombres} {row.actor.apellidos}</span>
                        </>
                      ) : (
                        <span className="text-[12px] text-gray-400 italic">Sistema</span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-gray-500">{endpoint}</div>
                    {row.cambios && (
                      <div className="text-[11px] text-navy-700 mt-1">
                        {isExpanded ? '▴ Ocultar cambios' : '▾ Ver cambios'}
                      </div>
                    )}
                  </button>
                  {isExpanded && row.cambios && (
                    <pre className="mt-2 bg-navy-900 text-emerald-200 p-3 rounded text-[10.5px] overflow-x-auto font-mono leading-relaxed">{JSON.stringify(row.cambios, null, 2)}</pre>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {q.data && data.length > 0 && (
          <div className="p-3 text-[11.5px] text-gray-500 border-t border-gray-200">
            Mostrando {data.length} de {total} · datos cargados desde la tabla <code className="font-mono bg-gray-100 px-1 rounded">audit_log</code>
          </div>
        )}
      </div>

      <div className="mt-4 px-4 py-3 bg-navy-50 border border-navy-100 rounded text-[11.5px] text-gray-700">
        🔒 <strong className="text-navy-900">Bitácora inmutable:</strong> los registros de auditoría solo permiten INSERT — nadie (ni el admin) puede modificarlos o eliminarlos. Triggers en PostgreSQL bloquean cualquier UPDATE/DELETE sobre <code className="font-mono bg-white px-1 rounded">audit_log</code>.
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

export default function AuditoriaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Cargando…</div>}>
      <AuditoriaInner />
    </Suspense>
  );
}
