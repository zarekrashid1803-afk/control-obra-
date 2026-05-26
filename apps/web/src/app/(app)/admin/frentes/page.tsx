'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { frentes, ApiError } from '@/lib/api';
import { Drawer } from '@/components/drawer';
import { fmtCOP } from '@/lib/utils';

type FrenteForm = {
  codigo: string;
  nombre: string;
  presupuestoPesos: string;
  colorHex: string;
  estado: 'activo' | 'pausado' | 'cerrado';
  ubicacion: string;
  fechaInicio: string;
  fechaFinEstimada: string;
};

const EMPTY: FrenteForm = {
  codigo: '',
  nombre: '',
  presupuestoPesos: '',
  colorHex: '#686B6C',
  estado: 'activo',
  ubicacion: '',
  fechaInicio: '',
  fechaFinEstimada: '',
};

const COLORS = ['#000000', '#686B6C', '#AEBFCA', '#dc2626', '#059669', '#7c3aed', '#0891b2'];

function FrentesInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const editId = sp.get('id');
  const isNew = sp.get('new') === '1';
  const drawerOpen = !!editId || isNew;

  const listQ = useQuery({ queryKey: ['frentes'], queryFn: () => frentes.list() });
  const editingFrente = listQ.data?.find((f: any) => f.id === editId);

  const [form, setForm] = useState<FrenteForm>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingFrente) {
      setForm({
        codigo: editingFrente.codigo,
        nombre: editingFrente.nombre,
        presupuestoPesos: String(Number(editingFrente.presupuestoTotalCentavos) / 100),
        colorHex: editingFrente.colorHex || '#686B6C',
        estado: editingFrente.estado,
        ubicacion: editingFrente.ubicacion || '',
        fechaInicio: editingFrente.fechaInicio?.slice(0, 10) || '',
        fechaFinEstimada: editingFrente.fechaFinEstimada?.slice(0, 10) || '',
      });
    } else if (isNew) {
      setForm(EMPTY);
    }
    setError(null);
  }, [editingFrente, isNew]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        codigo: form.codigo,
        nombre: form.nombre,
        presupuestoTotalCentavos: String(BigInt(Math.round(Number(form.presupuestoPesos.replace(/[^0-9.]/g, '')) * 100))),
        colorHex: form.colorHex,
        estado: form.estado,
        ubicacion: form.ubicacion || undefined,
        fechaInicio: form.fechaInicio ? new Date(form.fechaInicio).toISOString() : undefined,
        fechaFinEstimada: form.fechaFinEstimada ? new Date(form.fechaFinEstimada).toISOString() : undefined,
      };
      return editId ? frentes.update(editId, payload) : frentes.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frentes'] });
      closeDrawer();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const m = (err.body as any)?.message || err.message;
        setError(typeof m === 'string' ? m : JSON.stringify(m));
      } else setError('Error al guardar');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => frentes.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['frentes'] });
      closeDrawer();
    },
  });

  function closeDrawer() { router.replace('/admin/frentes'); }

  function openNew() { router.replace('/admin/frentes?new=1'); }
  function openEdit(id: string) { router.replace(`/admin/frentes?id=${id}`); }

  const data = listQ.data || [];

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight">Frentes de Obra</h1>
          <p className="text-[12.5px] md:text-[13px] text-gray-500 mt-1">Centros de costos con presupuesto asignado</p>
        </div>
        <button onClick={openNew} className="btn btn-primary">+ Nuevo frente</button>
      </div>

      {/* PC: tabla */}
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[700px] hidden md:table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Estado</th>
              <th className="!text-right">Presupuesto</th>
              <th className="!text-right">Consumido</th>
              <th>%</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((f: any) => {
              const pct = (Number(f.consumidoCentavos) / Number(f.presupuestoTotalCentavos)) * 100;
              return (
                <tr key={f.id} onClick={() => openEdit(f.id)}>
                  <td className="font-mono text-[12px]">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: f.colorHex }} />
                    {f.codigo}
                  </td>
                  <td>
                    <div>{f.nombre}</div>
                    {f.ubicacion && <div className="text-[11px] text-gray-500">{f.ubicacion}</div>}
                  </td>
                  <td><span className={`badge ${f.estado === 'activo' ? 'badge-aprobada' : f.estado === 'pausado' ? 'badge-pendiente' : 'badge-borrador'}`}>{f.estado}</span></td>
                  <td className="text-right tabular-nums">{fmtCOP(f.presupuestoTotalCentavos)}</td>
                  <td className="text-right tabular-nums">{fmtCOP(f.consumidoCentavos)}</td>
                  <td className="w-[150px]">
                    <div className="text-[11px] text-gray-500 mb-1">{pct.toFixed(0)}%</div>
                    <div className="w-full h-1.5 bg-gray-200 rounded">
                      <div className={`h-full rounded ${pct > 85 ? 'bg-st-rechazada' : pct > 70 ? 'bg-st-pendiente' : 'bg-st-aprobada'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </td>
                  <td className="text-right">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(f.id); }} className="btn btn-secondary btn-sm">Editar</button>
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-500">No hay frentes. Crea el primero.</td></tr>
            )}
          </tbody>
        </table>

        {/* Móvil: cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {data.map((f: any) => {
            const pct = (Number(f.consumidoCentavos) / Number(f.presupuestoTotalCentavos)) * 100;
            return (
              <button key={f.id} onClick={() => openEdit(f.id)} className="w-full text-left p-4 active:bg-gray-50">
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: f.colorHex }} />
                    <span className="font-mono text-[13px] font-medium">{f.codigo}</span>
                  </div>
                  <span className={`badge ${f.estado === 'activo' ? 'badge-aprobada' : f.estado === 'pausado' ? 'badge-pendiente' : 'badge-borrador'}`}>{f.estado}</span>
                </div>
                <div className="text-[14px] text-navy-900 font-medium mb-2">{f.nombre}</div>
                <div className="text-[11.5px] text-gray-500 mb-1">
                  {fmtCOP(f.consumidoCentavos)} / {fmtCOP(f.presupuestoTotalCentavos)}
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded">
                  <div className={`h-full rounded ${pct > 85 ? 'bg-st-rechazada' : pct > 70 ? 'bg-st-pendiente' : 'bg-st-aprobada'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editId ? `Editar ${editingFrente?.codigo || 'frente'}` : 'Nuevo frente'}
        subtitle={editId ? editingFrente?.nombre : 'Crea un nuevo centro de costos'}
        footer={(
          <>
            {editId && (
              <button
                onClick={() => { if (confirm('¿Eliminar este frente?')) remove.mutate(editId); }}
                disabled={remove.isPending}
                className="btn btn-secondary text-st-rechazada border-red-200 mr-auto"
              >🗑️ Eliminar</button>
            )}
            <button onClick={closeDrawer} className="btn btn-secondary">Cancelar</button>
            <button onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-primary">
              {save.isPending ? 'Guardando…' : editId ? 'Guardar cambios' : 'Crear frente'}
            </button>
          </>
        )}
      >
        {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-800 text-[13px] rounded border border-red-200">{error}</div>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código *">
              <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} className="input" placeholder="FR-004" />
            </Field>
            <Field label="Estado">
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as any })} className="input">
                <option value="activo">Activo</option>
                <option value="pausado">Pausado</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </Field>
          </div>

          <Field label="Nombre *">
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="input" placeholder="Torre Aurora" />
          </Field>

          <Field label="Presupuesto total (COP) *">
            <input
              type="text"
              inputMode="numeric"
              value={form.presupuestoPesos}
              onChange={(e) => setForm({ ...form, presupuestoPesos: e.target.value.replace(/[^0-9.]/g, '') })}
              className="input text-right font-mono"
              placeholder="850000000"
            />
            {form.presupuestoPesos && (
              <div className="text-[11px] text-gray-500 mt-1 text-right">
                {fmtCOP((Number(form.presupuestoPesos) || 0) * 100, { full: true })}
              </div>
            )}
          </Field>

          <Field label="Ubicación">
            <input value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} className="input" placeholder="Cra 100 #15-20, Cali" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha de inicio">
              <input type="date" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} className="input" />
            </Field>
            <Field label="Entrega estimada">
              <input type="date" value={form.fechaFinEstimada} onChange={(e) => setForm({ ...form, fechaFinEstimada: e.target.value })} className="input" />
            </Field>
          </div>

          <Field label="Color identificador">
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, colorHex: c })}
                  className={`w-9 h-9 rounded-lg border-2 transition ${form.colorHex === c ? 'border-navy-900 scale-110' : 'border-gray-200'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
        </div>
      </Drawer>
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

export default function FrentesAdminPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Cargando…</div>}>
      <FrentesInner />
    </Suspense>
  );
}
