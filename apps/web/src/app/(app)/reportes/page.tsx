'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { downloadFile, frentes, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { fmtDate } from '@/lib/utils';

type Reporte = {
  id: string;
  icon: string;
  titulo: string;
  descripcion: string;
  publico: string;
  rutaApi: string;
  filenameBase: string;
  rolesPermitidos: string[];
  filtros: ('rango' | 'frente')[];
};

const REPORTES: Reporte[] = [
  {
    id: 'consumo-presupuestal',
    icon: '🏗️',
    titulo: 'Consumo presupuestal por frente',
    descripcion: 'Snapshot del estado financiero de cada centro de costos. Incluye presupuesto, consumido, disponible, % y alertas. Sin filtros — siempre datos en vivo.',
    publico: 'Para: Dirección, junta directiva, socios.',
    rutaApi: '/reportes/consumo-presupuestal',
    filenameBase: 'Consumo-Presupuestal',
    rolesPermitidos: ['admin', 'director', 'auditor'],
    filtros: [],
  },
  {
    id: 'requisiciones',
    icon: '📋',
    titulo: 'Requisiciones del período',
    descripcion: 'Listado completo de requisiciones con sus items, montos, estados, aprobadores y banderas de "sobre presupuesto". Filtrable por rango y frente.',
    publico: 'Para: Compras, control interno, revisor fiscal.',
    rutaApi: '/reportes/requisiciones',
    filenameBase: 'Requisiciones',
    rolesPermitidos: ['admin', 'director', 'auditor', 'compras'],
    filtros: ['rango', 'frente'],
  },
  {
    id: 'ordenes-compra',
    icon: '🧾',
    titulo: 'Órdenes de compra emitidas',
    descripcion: 'OCs por proveedor con desglose tributario completo: subtotal, IVA 19%, retenciones (Fuente, IVA, ICA), estado y persona que la generó.',
    publico: 'Para: Compras, contabilidad, DIAN.',
    rutaApi: '/reportes/ordenes-compra',
    filenameBase: 'Ordenes-Compra',
    rolesPermitidos: ['admin', 'director', 'auditor', 'compras'],
    filtros: ['rango'],
  },
  {
    id: 'caja-menor',
    icon: '💵',
    titulo: 'Caja Menor — movimientos',
    descripcion: 'Movimientos del período con tipo (entrada/salida/ajuste), concepto, frente imputado, retenciones, neto y autorizador. Incluye totales.',
    publico: 'Para: Tesorería, contabilidad, arqueo.',
    rutaApi: '/reportes/caja-menor',
    filenameBase: 'Caja-Menor',
    rolesPermitidos: ['admin', 'director', 'auditor', 'caja'],
    filtros: ['rango'],
  },
  {
    id: 'auditoria',
    icon: '🔍',
    titulo: 'Bitácora de auditoría',
    descripcion: 'Registro inmutable de toda operación sensible del período. Incluye usuario, IP, dispositivo, acción y JSON de cambios. Máximo 5.000 eventos.',
    publico: 'Para: Revisor fiscal, auditoría externa, evidencia legal.',
    rutaApi: '/reportes/auditoria',
    filenameBase: 'Auditoria',
    rolesPermitidos: ['admin', 'director', 'auditor'],
    filtros: ['rango'],
  },
];

function ayer(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportesPage() {
  const user = useAuthStore((s) => s.user);
  const userRoles = user?.roles || [];

  const frentesQ = useQuery({ queryKey: ['frentes'], queryFn: () => frentes.list() });

  // Filtros globales (compartidos entre reportes que los aceptan)
  const [desde, setDesde] = useState(ayer());
  const [hasta, setHasta] = useState(hoy());
  const [frenteId, setFrenteId] = useState('');

  // Estado per-reporte
  const [downloading, setDownloading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function descargar(rep: Reporte) {
    setDownloading(rep.id);
    setErrors((e) => ({ ...e, [rep.id]: '' }));
    try {
      const params = new URLSearchParams();
      if (rep.filtros.includes('rango')) {
        if (desde) params.set('desde', new Date(desde).toISOString());
        if (hasta) {
          const h = new Date(hasta); h.setHours(23, 59, 59, 999);
          params.set('hasta', h.toISOString());
        }
      }
      if (rep.filtros.includes('frente') && frenteId) {
        params.set('frenteId', frenteId);
      }
      const qs = params.toString();
      const path = qs ? `${rep.rutaApi}?${qs}` : rep.rutaApi;
      const filename = `${rep.filenameBase}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      await downloadFile(path, filename);
    } catch (err) {
      if (err instanceof ApiError) {
        const m = (err.body as any)?.message || err.message;
        setErrors((e) => ({ ...e, [rep.id]: typeof m === 'string' ? m : `Error ${err.status}` }));
      } else {
        setErrors((e) => ({ ...e, [rep.id]: 'Error al descargar' }));
      }
    } finally {
      setDownloading(null);
    }
  }

  const reportesVisibles = REPORTES.filter(r => r.rolesPermitidos.some(role => userRoles.includes(role)));

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="mb-5">
        <div className="text-[11px] text-gray-500 hidden md:flex gap-1.5 mb-1.5">
          <Link href="/dashboard" className="text-navy-700 hover:underline">Inicio</Link>
          <span>›</span><span>Reportes</span>
        </div>
        <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight">Reportes ejecutivos</h1>
        <p className="text-[12.5px] md:text-[13px] text-gray-500 mt-1">
          Archivos Excel con tu marca, descarga directa. Datos en vivo desde Supabase.
        </p>
      </div>

      {/* Filtros globales */}
      <div className="card mb-5">
        <div className="p-3.5 border-b border-gray-200">
          <div className="text-[14px] font-semibold text-navy-900">Filtros</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Aplican solo a los reportes que los soportan</div>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="input" />
          </div>
          <div>
            <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="input" />
          </div>
          <div>
            <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">Frente <span className="text-gray-400">(opcional)</span></label>
            <select value={frenteId} onChange={(e) => setFrenteId(e.target.value)} className="input">
              <option value="">Todos los frentes</option>
              {frentesQ.data?.map((f: any) => (
                <option key={f.id} value={f.id}>{f.codigo} {f.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="px-4 py-2.5 bg-navy-50 border-t border-navy-100 text-[11.5px] text-gray-600 flex flex-wrap gap-3">
          <span>📅 Rango: <strong>{fmtDate(new Date(desde))}</strong> → <strong>{fmtDate(new Date(hasta))}</strong></span>
          {frenteId && (
            <span>🏗️ Frente: <strong>{frentesQ.data?.find((f: any) => f.id === frenteId)?.codigo}</strong></span>
          )}
        </div>
      </div>

      {/* Cards de reportes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {reportesVisibles.map((rep) => (
          <div key={rep.id} className="card flex flex-col">
            <div className="p-4 flex items-start gap-3 flex-1">
              <div className="text-3xl flex-shrink-0">{rep.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-navy-900 mb-1">{rep.titulo}</div>
                <p className="text-[12.5px] text-gray-600 leading-relaxed mb-2">{rep.descripcion}</p>
                <p className="text-[11px] text-navy-700 italic">{rep.publico}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {rep.filtros.length === 0 && (
                    <span className="chip text-[10.5px]">Sin filtros · en vivo</span>
                  )}
                  {rep.filtros.includes('rango') && (
                    <span className="chip text-[10.5px]">📅 Rango aplicable</span>
                  )}
                  {rep.filtros.includes('frente') && (
                    <span className="chip text-[10.5px]">🏗️ Filtro por frente</span>
                  )}
                </div>
              </div>
            </div>
            {errors[rep.id] && (
              <div className="mx-4 mb-3 px-3 py-2 bg-red-50 text-red-800 text-[12px] rounded border border-red-200">
                {errors[rep.id]}
              </div>
            )}
            <div className="border-t border-gray-200 p-3">
              <button
                onClick={() => descargar(rep)}
                disabled={downloading === rep.id}
                className="btn btn-accent w-full justify-center disabled:opacity-50"
              >
                {downloading === rep.id ? '⏳ Generando…' : '📥 Descargar Excel'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 px-4 py-3 bg-gold-100 border border-gold-500/30 rounded text-[11.5px] text-gray-700">
        💡 <strong className="text-navy-900">Tip:</strong> los archivos se generan al instante con datos en vivo desde la base de datos. Incluyen tu logo, encabezado con metadatos (quién, cuándo, qué filtros) y totales calculados. Listos para enviar a Dirección, contador o revisor fiscal.
      </div>
    </div>
  );
}
