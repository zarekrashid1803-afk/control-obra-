'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { proveedores, ApiError, getApiErrorMessage } from '@/lib/api';
import { Drawer } from '@/components/drawer';

type ProveedorForm = {
  codigo: string;
  nit: string;
  razonSocial: string;
  tipoPersona: 'juridica' | 'natural';
  regimenIva: 'responsable_iva' | 'no_responsable' | 'exento' | 'regimen_simple';
  autorretenedor: boolean;
  granContribuyente: boolean;
  direccion: string;
  ciudad: string;
  telefono: string;
  email: string;
  condicionesPago: 'contado' | 'credito_15' | 'credito_30' | 'credito_60' | 'credito_90';
  activo: boolean;
};

const EMPTY: ProveedorForm = {
  codigo: '', nit: '', razonSocial: '',
  tipoPersona: 'juridica', regimenIva: 'responsable_iva',
  autorretenedor: false, granContribuyente: false,
  direccion: '', ciudad: 'Cali', telefono: '', email: '',
  condicionesPago: 'credito_30', activo: true,
};

function ProveedoresInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const editId = sp.get('id');
  const isNew = sp.get('new') === '1';
  const drawerOpen = !!editId || isNew;
  const [search, setSearch] = useState('');

  const listQ = useQuery({
    queryKey: ['proveedores', search],
    queryFn: () => proveedores.list({ pageSize: 100, ...(search ? { search } : {}) }),
  });
  const data = listQ.data?.data || [];
  const editing = data.find((p: any) => p.id === editId);

  const [form, setForm] = useState<ProveedorForm>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        codigo: editing.codigo,
        nit: editing.nit,
        razonSocial: editing.razonSocial,
        tipoPersona: editing.tipoPersona,
        regimenIva: editing.regimenIva,
        autorretenedor: editing.autorretenedor,
        granContribuyente: editing.granContribuyente,
        direccion: editing.direccion || '',
        ciudad: editing.ciudad || 'Cali',
        telefono: editing.telefono || '',
        email: editing.email || '',
        condicionesPago: editing.condicionesPago,
        activo: editing.activo,
      });
    } else if (isNew) {
      setForm(EMPTY);
    }
    setError(null);
  }, [editing, isNew]);

  const save = useMutation({
    mutationFn: () => editId ? proveedores.update(editId, form) : proveedores.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proveedores'] });
      closeDrawer();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(getApiErrorMessage(err));
      } else setError('Error al guardar');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => proveedores.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proveedores'] }); closeDrawer(); },
  });

  function closeDrawer() { router.replace('/admin/proveedores'); }
  function openNew() { router.replace('/admin/proveedores?new=1'); }
  function openEdit(id: string) { router.replace(`/admin/proveedores?id=${id}`); }

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight">Proveedores</h1>
          <p className="text-[12.5px] md:text-[13px] text-gray-500 mt-1">Catálogo de terceros que abastecen las obras</p>
        </div>
        <button onClick={openNew} className="btn btn-primary">+ Nuevo proveedor</button>
      </div>

      <div className="card">
        <div className="p-3 border-b border-gray-200 flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px] flex items-center gap-1.5 border border-gray-300 rounded px-2.5 bg-white">
            <span>🔍</span>
            <input type="text" placeholder="Buscar por nombre, NIT o código..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 outline-none py-2 text-[13px] w-full" />
          </div>
        </div>

        {/* PC */}
        <table className="tbl min-w-[700px] hidden md:table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Razón social</th>
              <th>NIT</th>
              <th>Régimen</th>
              <th>Ciudad</th>
              <th>Pago</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((p: any) => (
              <tr key={p.id} onClick={() => openEdit(p.id)}>
                <td className="font-mono text-[12px]">{p.codigo}</td>
                <td><strong>{p.razonSocial}</strong></td>
                <td className="font-mono text-[12px]">{p.nit}</td>
                <td className="text-[12px] capitalize">{p.regimenIva.replace(/_/g, ' ')}</td>
                <td className="text-[12px]">{p.ciudad}</td>
                <td className="text-[12px] capitalize">{p.condicionesPago?.replace('_', ' ')}</td>
                <td><span className={`badge ${p.activo ? 'badge-aprobada' : 'badge-borrador'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td className="text-right">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(p.id); }} className="btn btn-secondary btn-sm">Editar</button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-500">No hay proveedores.</td></tr>
            )}
          </tbody>
        </table>

        {/* Móvil */}
        <div className="md:hidden divide-y divide-gray-100">
          {data.map((p: any) => (
            <button key={p.id} onClick={() => openEdit(p.id)} className="w-full text-left p-4 active:bg-gray-50">
              <div className="flex justify-between items-start mb-1">
                <span className="font-mono text-[11px] text-gray-500">{p.codigo}</span>
                <span className={`badge ${p.activo ? 'badge-aprobada' : 'badge-borrador'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span>
              </div>
              <div className="text-[14px] font-medium text-navy-900">{p.razonSocial}</div>
              <div className="text-[11.5px] text-gray-500 mt-1">{p.nit} · {p.ciudad}</div>
            </button>
          ))}
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editId ? `Editar ${editing?.codigo || 'proveedor'}` : 'Nuevo proveedor'}
        subtitle={editId ? editing?.razonSocial : 'Agrega un tercero al catálogo'}
        footer={(
          <>
            {editId && (
              <button onClick={() => { if (confirm('¿Eliminar este proveedor?')) remove.mutate(editId); }} className="btn btn-secondary text-st-rechazada border-red-200 mr-auto">🗑️</button>
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código *">
              <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} className="input" placeholder="P-008" />
            </Field>
            <Field label="NIT *">
              <input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} className="input font-mono" placeholder="900.123.456-1" />
            </Field>
          </div>

          <Field label="Razón social *">
            <input value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} className="input" placeholder="Ferretería Industrial Sur S.A.S." />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select value={form.tipoPersona} onChange={(e) => setForm({ ...form, tipoPersona: e.target.value as any })} className="input">
                <option value="juridica">Persona jurídica</option>
                <option value="natural">Persona natural</option>
              </select>
            </Field>
            <Field label="Régimen IVA">
              <select value={form.regimenIva} onChange={(e) => setForm({ ...form, regimenIva: e.target.value as any })} className="input">
                <option value="responsable_iva">Responsable de IVA</option>
                <option value="no_responsable">No responsable</option>
                <option value="exento">Exento</option>
                <option value="regimen_simple">Régimen simple</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={form.autorretenedor} onChange={(e) => setForm({ ...form, autorretenedor: e.target.checked })} />
              Autorretenedor
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={form.granContribuyente} onChange={(e) => setForm({ ...form, granContribuyente: e.target.checked })} />
              Gran contribuyente
            </label>
          </div>

          <hr className="border-gray-200" />

          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <Field label="Dirección">
              <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className="input" placeholder="Cra 100 #15-20" />
            </Field>
            <Field label="Ciudad">
              <input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} className="input" placeholder="Cali" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono">
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="input" placeholder="3001234567" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" placeholder="ventas@proveedor.co" />
            </Field>
          </div>

          <Field label="Condiciones de pago">
            <select value={form.condicionesPago} onChange={(e) => setForm({ ...form, condicionesPago: e.target.value as any })} className="input">
              <option value="contado">Contado</option>
              <option value="credito_15">Crédito 15 días</option>
              <option value="credito_30">Crédito 30 días</option>
              <option value="credito_60">Crédito 60 días</option>
              <option value="credito_90">Crédito 90 días</option>
            </select>
          </Field>

          <label className="flex items-center gap-2 text-[13px] pt-2 border-t border-gray-200">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
            Proveedor activo (visible para nuevas OCs)
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

export default function ProveedoresAdminPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Cargando…</div>}>
      <ProveedoresInner />
    </Suspense>
  );
}
