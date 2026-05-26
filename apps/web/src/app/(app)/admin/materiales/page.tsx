'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { materiales, ApiError } from '@/lib/api';
import { Drawer } from '@/components/drawer';
import { fmtCOP } from '@/lib/utils';

type MaterialForm = {
  sku: string;
  descripcion: string;
  unidad: string;
  categoria: string;
  precioPesos: string;
  stockMinimo: string;
  activo: boolean;
};

const EMPTY: MaterialForm = {
  sku: '', descripcion: '', unidad: 'und', categoria: '',
  precioPesos: '', stockMinimo: '0', activo: true,
};

const UNIDADES = [
  { v: 'und', l: 'Unidad' },
  { v: 'rollo', l: 'Rollo' },
  { v: 'galon', l: 'Galón' },
  { v: 'm3', l: 'Metro cúbico (m³)' },
  { v: 'm2', l: 'Metro cuadrado (m²)' },
  { v: 'm', l: 'Metro lineal' },
  { v: 'kg', l: 'Kilogramo' },
  { v: 'ton', l: 'Tonelada' },
  { v: 'lt', l: 'Litro' },
  { v: 'paquete', l: 'Paquete' },
  { v: 'caja', l: 'Caja' },
];

const CATEGORIAS = ['cemento', 'acero', 'mamposteria', 'electrico', 'hidraulico', 'pintura', 'agregados', 'epp', 'soldadura', 'herramientas', 'otros'];

function MaterialesInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const editId = sp.get('id');
  const isNew = sp.get('new') === '1';
  const drawerOpen = !!editId || isNew;
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');

  const listQ = useQuery({
    queryKey: ['materiales', search],
    queryFn: () => materiales.list({ pageSize: 200, ...(search ? { search } : {}) }),
  });
  let data = listQ.data?.data || [];
  if (categoria) data = data.filter((m: any) => m.categoria === categoria);
  const editing = (listQ.data?.data || []).find((m: any) => m.id === editId);

  const [form, setForm] = useState<MaterialForm>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        sku: editing.sku,
        descripcion: editing.descripcion,
        unidad: editing.unidad,
        categoria: editing.categoria || '',
        precioPesos: String(Number(editing.precioReferenciaCentavos) / 100),
        stockMinimo: String(Number(editing.stockMinimo)),
        activo: editing.activo,
      });
    } else if (isNew) {
      setForm(EMPTY);
    }
    setError(null);
  }, [editing, isNew]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        sku: form.sku,
        descripcion: form.descripcion,
        unidad: form.unidad,
        categoria: form.categoria || undefined,
        precioReferenciaCentavos: String(BigInt(Math.round((Number(form.precioPesos) || 0) * 100))),
        stockMinimo: Number(form.stockMinimo) || 0,
        activo: form.activo,
      };
      return editId ? materiales.update(editId, payload) : materiales.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['materiales'] }); closeDrawer(); },
    onError: (err) => {
      if (err instanceof ApiError) {
        const m = (err.body as any)?.message || err.message;
        setError(typeof m === 'string' ? m : JSON.stringify(m));
      } else setError('Error al guardar');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => materiales.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['materiales'] }); closeDrawer(); },
  });

  function closeDrawer() { router.replace('/admin/materiales'); }
  function openNew() { router.replace('/admin/materiales?new=1'); }
  function openEdit(id: string) { router.replace(`/admin/materiales?id=${id}`); }

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight">Materiales · SKUs</h1>
          <p className="text-[12.5px] md:text-[13px] text-gray-500 mt-1">Catálogo de items disponibles para requisiciones</p>
        </div>
        <button onClick={openNew} className="btn btn-primary">+ Nuevo material</button>
      </div>

      <div className="card">
        <div className="p-3 border-b border-gray-200 flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px] flex items-center gap-1.5 border border-gray-300 rounded px-2.5 bg-white">
            <span>🔍</span>
            <input type="text" placeholder="Buscar SKU o descripción..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 outline-none py-2 text-[13px] w-full" />
          </div>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="px-2.5 py-2 border border-gray-300 rounded text-[12.5px] bg-white">
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* PC */}
        <table className="tbl min-w-[800px] hidden md:table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Unidad</th>
              <th className="!text-right">Precio ref.</th>
              <th className="!text-right">Stock mínimo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((m: any) => (
              <tr key={m.id} onClick={() => openEdit(m.id)}>
                <td className="font-mono text-[12px]">{m.sku}</td>
                <td>{m.descripcion}</td>
                <td className="text-[12px] capitalize text-gray-500">{m.categoria || '—'}</td>
                <td className="text-[12px]">{m.unidad}</td>
                <td className="text-right tabular-nums">{fmtCOP(m.precioReferenciaCentavos)}</td>
                <td className="text-right tabular-nums text-[12px] text-gray-500">{Number(m.stockMinimo)}</td>
                <td><span className={`badge ${m.activo ? 'badge-aprobada' : 'badge-borrador'}`}>{m.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td className="text-right">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(m.id); }} className="btn btn-secondary btn-sm">Editar</button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-500">No hay materiales.</td></tr>
            )}
          </tbody>
        </table>

        {/* Móvil */}
        <div className="md:hidden divide-y divide-gray-100">
          {data.map((m: any) => (
            <button key={m.id} onClick={() => openEdit(m.id)} className="w-full text-left p-4 active:bg-gray-50">
              <div className="flex justify-between items-start mb-1">
                <span className="font-mono text-[11px] text-gray-500">{m.sku}</span>
                <span className={`badge ${m.activo ? 'badge-aprobada' : 'badge-borrador'}`}>{m.activo ? 'Activo' : 'Inactivo'}</span>
              </div>
              <div className="text-[14px] font-medium text-navy-900 mb-1">{m.descripcion}</div>
              <div className="flex justify-between text-[12px] text-gray-500">
                <span>{m.unidad} · stock mín {Number(m.stockMinimo)}</span>
                <strong className="text-navy-900 tabular-nums">{fmtCOP(m.precioReferenciaCentavos)}</strong>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editId ? `Editar ${editing?.sku || 'material'}` : 'Nuevo material'}
        subtitle={editId ? editing?.descripcion : 'Agrega un SKU al catálogo'}
        footer={(
          <>
            {editId && (
              <button onClick={() => { if (confirm('¿Eliminar este material?')) remove.mutate(editId); }} className="btn btn-secondary text-st-rechazada border-red-200 mr-auto">🗑️</button>
            )}
            <button onClick={closeDrawer} className="btn btn-secondary">Cancelar</button>
            <button onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-primary">
              {save.isPending ? 'Guardando…' : editId ? 'Guardar' : 'Crear'}
            </button>
          </>
        )}
      >
        {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-800 text-[13px] rounded border border-red-200">{error}</div>}

        <div className="space-y-4">
          <Field label="SKU *">
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} className="input font-mono" placeholder="MAT-0011" />
            <div className="text-[11px] text-gray-500 mt-1">Formato MAT-NNNN (4-6 dígitos)</div>
          </Field>

          <Field label="Descripción *">
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="input" placeholder='Cemento gris 50 kg' />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Unidad de medida *">
              <select value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })} className="input">
                {UNIDADES.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
              </select>
            </Field>
            <Field label="Categoría">
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="input">
                <option value="">— Sin categoría —</option>
                {CATEGORIAS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Precio de referencia (COP) *">
            <input
              type="text"
              inputMode="numeric"
              value={form.precioPesos}
              onChange={(e) => setForm({ ...form, precioPesos: e.target.value.replace(/[^0-9.]/g, '') })}
              className="input text-right font-mono"
              placeholder="32500"
            />
            {form.precioPesos && (
              <div className="text-[11px] text-gray-500 mt-1 text-right">
                {fmtCOP((Number(form.precioPesos) || 0) * 100, { full: true })} por {form.unidad}
              </div>
            )}
          </Field>

          <Field label="Stock mínimo (alerta cuando se baja de este nivel)">
            <input
              type="number"
              value={form.stockMinimo}
              onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
              className="input text-right"
              min="0"
              step="0.001"
            />
          </Field>

          <label className="flex items-center gap-2 text-[13px] pt-2 border-t border-gray-200">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
            Material activo (visible para nuevas requisiciones)
          </label>
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

export default function MaterialesAdminPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Cargando…</div>}>
      <MaterialesInner />
    </Suspense>
  );
}
