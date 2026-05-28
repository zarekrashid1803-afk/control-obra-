'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usuarios, frentes, ApiError } from '@/lib/api';
import { Drawer } from '@/components/drawer';
import { fmtDate } from '@/lib/utils';

const ALL_ROLES = ['director', 'residente', 'compras', 'caja', 'bodega', 'admin', 'auditor'] as const;

type UsuarioForm = {
  email: string;
  nombres: string;
  apellidos: string;
  password: string;
  roles: string[];
  frentesAsignados: string[];
  mfaEnabled: boolean;
};

const EMPTY: UsuarioForm = {
  email: '', nombres: '', apellidos: '',
  password: '', roles: [], frentesAsignados: [], mfaEnabled: false,
};

function UsuariosInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const editId = sp.get('id');
  const isNew = sp.get('new') === '1';
  const drawerOpen = !!editId || isNew;
  const [search, setSearch] = useState('');

  const listQ = useQuery({
    queryKey: ['usuarios', search],
    queryFn: () => usuarios.list({ pageSize: 100, ...(search ? { search } : {}) }),
  });
  const frentesQ = useQuery({ queryKey: ['frentes'], queryFn: () => frentes.list() });

  const data = listQ.data?.data || [];
  const editing = data.find((u: any) => u.id === editId);

  const [form, setForm] = useState<UsuarioForm>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        email: editing.email,
        nombres: editing.nombres,
        apellidos: editing.apellidos,
        password: '',
        roles: editing.roles || [],
        frentesAsignados: editing.frentesAsignados || [],
        mfaEnabled: editing.mfaEnabled,
      });
    } else if (isNew) {
      setForm(EMPTY);
    }
    setError(null);
  }, [editing, isNew]);

  const save = useMutation({
    mutationFn: () => {
      if (editId) {
        const { password, ...rest } = form;
        return usuarios.update(editId, rest);
      } else {
        return usuarios.create(form);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); closeDrawer(); },
    onError: (err) => {
      if (err instanceof ApiError) {
        const m = (err.body as any)?.message || err.message;
        setError(typeof m === 'string' ? m : JSON.stringify(m));
      } else setError('Error al guardar');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => usuarios.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); closeDrawer(); },
  });

  // Red de seguridad: si un usuario pierde su teléfono y queda bloqueado por
  // 2FA, el admin se lo desactiva para que pueda volver a entrar.
  const resetMfa = useMutation({
    mutationFn: (id: string) => usuarios.resetMfa(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      setForm(f => ({ ...f, mfaEnabled: false }));
    },
  });

  function toggleRole(r: string) {
    setForm(f => ({ ...f, roles: f.roles.includes(r) ? f.roles.filter(x => x !== r) : [...f.roles, r] }));
  }
  function toggleFrente(fid: string) {
    setForm(f => ({ ...f, frentesAsignados: f.frentesAsignados.includes(fid) ? f.frentesAsignados.filter(x => x !== fid) : [...f.frentesAsignados, fid] }));
  }

  function closeDrawer() { router.replace('/admin/usuarios'); }
  function openNew() { router.replace('/admin/usuarios?new=1'); }
  function openEdit(id: string) { router.replace(`/admin/usuarios?id=${id}`); }

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-[20px] md:text-[22px] font-bold text-navy-900 tracking-tight">Usuarios</h1>
          <p className="text-[12.5px] md:text-[13px] text-gray-500 mt-1">Personas con acceso al sistema y sus roles</p>
        </div>
        <button onClick={openNew} className="btn btn-primary">+ Nuevo usuario</button>
      </div>

      <div className="card">
        <div className="p-3 border-b border-gray-200 flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px] flex items-center gap-1.5 border border-gray-300 rounded px-2.5 bg-white">
            <span>🔍</span>
            <input type="text" placeholder="Buscar por nombre o email..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 outline-none py-2 text-[13px] w-full" />
          </div>
        </div>

        {/* PC */}
        <table className="tbl min-w-[700px] hidden md:table">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Frentes</th>
              <th>MFA</th>
              <th>Último login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((u: any) => (
              <tr key={u.id} onClick={() => openEdit(u.id)}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="avatar w-7 h-7 text-[11px]">{u.iniciales}</div>
                    <div><strong>{u.nombres} {u.apellidos}</strong></div>
                  </div>
                </td>
                <td className="text-[12px] font-mono">{u.email}</td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    {u.roles?.map((r: string) => (
                      <span key={r} className="chip text-[10.5px] capitalize">{r}</span>
                    ))}
                  </div>
                </td>
                <td className="text-[11px] text-gray-500">{u.frentesAsignados?.length || 0} asignados</td>
                <td>{u.mfaEnabled ? '🔒 Sí' : '—'}</td>
                <td className="text-[11.5px] text-gray-500">{u.ultimoLoginAt ? fmtDate(u.ultimoLoginAt) : 'Nunca'}</td>
                <td className="text-right">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(u.id); }} className="btn btn-secondary btn-sm">Editar</button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-500">No hay usuarios.</td></tr>
            )}
          </tbody>
        </table>

        {/* Móvil */}
        <div className="md:hidden divide-y divide-gray-100">
          {data.map((u: any) => (
            <button key={u.id} onClick={() => openEdit(u.id)} className="w-full text-left p-4 active:bg-gray-50">
              <div className="flex items-center gap-3 mb-2">
                <div className="avatar w-9 h-9 text-[12px]">{u.iniciales}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-navy-900 truncate">{u.nombres} {u.apellidos}</div>
                  <div className="text-[11px] text-gray-500 truncate font-mono">{u.email}</div>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {u.roles?.map((r: string) => (
                  <span key={r} className="chip text-[10.5px] capitalize">{r}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editId ? `Editar ${editing?.nombres || 'usuario'}` : 'Nuevo usuario'}
        subtitle={editId ? editing?.email : 'Crea una nueva cuenta de acceso'}
        footer={(
          <>
            {editId && (
              <button onClick={() => { if (confirm('¿Desactivar este usuario?')) remove.mutate(editId); }} className="btn btn-secondary text-st-rechazada border-red-200 mr-auto">Desactivar</button>
            )}
            {editId && editing?.mfaEnabled && (
              <button
                onClick={() => { if (confirm('¿Resetear el 2FA de este usuario? Tendrá que volver a configurarlo.')) resetMfa.mutate(editId); }}
                disabled={resetMfa.isPending}
                className="btn btn-secondary"
                title="Desactiva el 2FA si el usuario perdió acceso a su app"
              >
                {resetMfa.isPending ? 'Reseteando…' : 'Resetear 2FA'}
              </button>
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
            <Field label="Nombres *">
              <input value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} className="input" placeholder="Andrés" />
            </Field>
            <Field label="Apellidos *">
              <input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} className="input" placeholder="Patiño" />
            </Field>
          </div>

          <Field label="Email corporativo *">
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input font-mono" placeholder="andres.patino@andina.co" />
          </Field>

          {!editId && (
            <Field label="Contraseña inicial *">
              <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input font-mono" placeholder="Mínimo 8 caracteres" />
              <div className="text-[11px] text-gray-500 mt-1">El usuario deberá cambiarla en el primer login</div>
            </Field>
          )}

          <Field label="Roles del sistema *">
            <div className="grid grid-cols-2 gap-2">
              {ALL_ROLES.map(r => (
                <label key={r} className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition ${form.roles.includes(r) ? 'bg-navy-50 border-navy-500 text-navy-900' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRole(r)} />
                  <span className="capitalize text-[13px] font-medium">{r}</span>
                </label>
              ))}
            </div>
            <div className="text-[11px] text-gray-500 mt-1.5">El sistema permite asignar múltiples roles a una misma persona</div>
          </Field>

          {(form.roles.includes('residente') || form.roles.includes('bodega')) && frentesQ.data && (
            <Field label="Frentes asignados">
              <div className="space-y-1.5">
                {frentesQ.data.map((f: any) => (
                  <label key={f.id} className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition ${form.frentesAsignados.includes(f.id) ? 'bg-gold-100 border-gold-500' : 'bg-white border-gray-200'}`}>
                    <input type="checkbox" checked={form.frentesAsignados.includes(f.id)} onChange={() => toggleFrente(f.id)} />
                    <span className="text-[13px]"><strong>{f.codigo}</strong> {f.nombre}</span>
                  </label>
                ))}
              </div>
              <div className="text-[11px] text-gray-500 mt-1.5">El residente solo verá requisiciones de los frentes asignados</div>
            </Field>
          )}

          <label className="flex items-center gap-2 text-[13px] pt-2 border-t border-gray-200">
            <input type="checkbox" checked={form.mfaEnabled} onChange={(e) => setForm({ ...form, mfaEnabled: e.target.checked })} />
            <span>Requerir <strong>2FA (autenticación de dos factores)</strong></span>
          </label>
          {(form.roles.includes('director') || form.roles.includes('caja') || form.roles.includes('admin')) && !form.mfaEnabled && (
            <div className="text-[11.5px] text-st-pendiente bg-amber-50 px-3 py-2 rounded border border-amber-200">
              ⚠ Recomendado activar 2FA para roles financieros (Director, Caja, Admin)
            </div>
          )}
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

export default function UsuariosAdminPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Cargando…</div>}>
      <UsuariosInner />
    </Suspense>
  );
}
