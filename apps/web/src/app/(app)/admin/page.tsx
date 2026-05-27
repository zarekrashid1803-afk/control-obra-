'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { frentes, proveedores, materiales, usuarios, tenant, promoCodes } from '@/lib/api';
import { fmtCOP } from '@/lib/utils';

export default function AdminHomePage() {
  const qc = useQueryClient();
  const frentesQ = useQuery({ queryKey: ['frentes'], queryFn: () => frentes.list() });
  const provsQ = useQuery({ queryKey: ['proveedores'], queryFn: () => proveedores.list({ pageSize: 200 }) });
  const matsQ = useQuery({ queryKey: ['materiales'], queryFn: () => materiales.list({ pageSize: 200 }) });
  const usersQ = useQuery({ queryKey: ['usuarios'], queryFn: () => usuarios.list({ pageSize: 200 }) });
  const tenantQ = useQuery({ queryKey: ['tenant-me'], queryFn: () => tenant.me() });
  const sectoresQ = useQuery({ queryKey: ['sectores'], queryFn: () => promoCodes.sectores() });

  const [sectorEdit, setSectorEdit] = useState<string | null>(null);
  const cambiarSector = useMutation({
    mutationFn: (sectorId: string) => tenant.update({ sectorId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant-me'] }); setSectorEdit(null); },
  });

  const totalPresupuesto = frentesQ.data?.reduce((s: bigint, f: any) => s + BigInt(f.presupuestoTotalCentavos), 0n) || 0n;
  const totalConsumido = frentesQ.data?.reduce((s: bigint, f: any) => s + BigInt(f.consumidoCentavos), 0n) || 0n;

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight">Administración del sistema</h1>
        <p className="text-[12.5px] md:text-[13px] text-gray-500 mt-1">
          Gestión de catálogos maestros: frentes de obra, proveedores, materiales y usuarios
        </p>
      </div>

      {/* Configuración: sector de la empresa */}
      <div className="card p-4 mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{tenantQ.data?.sector?.iconEmoji || '🏢'}</div>
          <div>
            <div className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider">Sector de la empresa</div>
            <div className="text-[15px] font-semibold text-navy-900">
              {tenantQ.data?.sector?.nombre || 'Sin sector asignado'}
            </div>
          </div>
        </div>
        {sectorEdit === null ? (
          <button
            onClick={() => setSectorEdit(tenantQ.data?.sectorId || '')}
            className="btn btn-secondary btn-sm"
          >
            Cambiar sector
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={sectorEdit}
              onChange={(e) => setSectorEdit(e.target.value)}
              className="input !w-auto"
            >
              <option value="">— Seleccionar —</option>
              {(sectoresQ.data || []).map((s) => (
                <option key={s.id} value={s.id}>{s.iconEmoji} {s.nombre}</option>
              ))}
            </select>
            <button
              onClick={() => sectorEdit && cambiarSector.mutate(sectorEdit)}
              disabled={cambiarSector.isPending || !sectorEdit}
              className="btn btn-primary btn-sm"
            >
              {cambiarSector.isPending ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setSectorEdit(null)} className="btn btn-secondary btn-sm">Cancelar</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <AdminCard
          href="/admin/frentes"
          icon="🏗️"
          label="Frentes de obra"
          count={frentesQ.data?.length}
          subtitle={`Presupuesto total: ${fmtCOP(totalPresupuesto)}`}
        />
        <AdminCard
          href="/admin/proveedores"
          icon="🏢"
          label="Proveedores"
          count={provsQ.data?.pagination?.total}
          subtitle="Catálogo de terceros"
        />
        <AdminCard
          href="/admin/materiales"
          icon="📦"
          label="Materiales / SKU"
          count={matsQ.data?.pagination?.total}
          subtitle="Catálogo de items"
        />
        <AdminCard
          href="/admin/usuarios"
          icon="👤"
          label="Usuarios"
          count={usersQ.data?.pagination?.total}
          subtitle="Acceso al sistema"
        />
      </div>

      {/* Resumen rápido */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="p-3.5 border-b border-gray-200 flex justify-between items-center">
            <div className="text-[14px] font-semibold text-navy-900">Frentes activos</div>
            <Link href="/admin/frentes" className="text-[12px] text-navy-700 hover:underline">Ver todos →</Link>
          </div>
          <div className="p-4 space-y-3">
            {frentesQ.data?.slice(0, 5).map((f: any) => {
              const pct = (Number(f.consumidoCentavos) / Number(f.presupuestoTotalCentavos)) * 100;
              return (
                <Link href={`/admin/frentes?id=${f.id}`} key={f.id} className="block hover:bg-gray-50 -m-1 p-1 rounded">
                  <div className="flex justify-between text-[12.5px] mb-1">
                    <span><strong>{f.codigo}</strong> {f.nombre}</span>
                    <span className={pct > 85 ? 'text-st-rechazada font-semibold' : 'text-gray-500'}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded">
                    <div className={`h-full rounded ${pct > 85 ? 'bg-st-rechazada' : pct > 70 ? 'bg-st-pendiente' : 'bg-st-aprobada'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="p-3.5 border-b border-gray-200">
            <div className="text-[14px] font-semibold text-navy-900">Resumen del sistema</div>
          </div>
          <div className="p-4 space-y-2.5 text-[13px]">
            <SummaryRow k="Presupuesto total comprometido" v={fmtCOP(totalPresupuesto, { full: true })} />
            <SummaryRow k="Consumido a la fecha" v={fmtCOP(totalConsumido, { full: true })} subtle />
            <SummaryRow
              k="Disponible"
              v={fmtCOP(totalPresupuesto - totalConsumido, { full: true })}
              bold
            />
            <hr className="border-gray-200 my-2" />
            <SummaryRow k="Catálogo de materiales" v={`${matsQ.data?.pagination?.total || 0} SKUs activos`} />
            <SummaryRow k="Catálogo de proveedores" v={`${provsQ.data?.pagination?.total || 0} terceros`} />
            <SummaryRow k="Usuarios del sistema" v={`${usersQ.data?.pagination?.total || 0} cuentas`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminCard({ href, icon, label, count, subtitle }: { href: string; icon: string; label: string; count?: number | string; subtitle?: string }) {
  return (
    <Link href={href} className="card hover:shadow-md transition group">
      <div className="p-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="text-2xl">{icon}</div>
          <div className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider">{label}</div>
        </div>
        <div className="text-[28px] font-bold text-navy-900 leading-none tracking-tight">
          {count ?? '—'}
        </div>
        {subtitle && <div className="text-[11px] text-gray-500 mt-1.5">{subtitle}</div>}
        <div className="text-[12px] text-navy-700 mt-3 group-hover:underline">Gestionar →</div>
      </div>
    </Link>
  );
}

function SummaryRow({ k, v, bold, subtle }: { k: string; v: string; bold?: boolean; subtle?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-navy-900' : subtle ? 'text-gray-500' : ''}`}>
      <span>{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
