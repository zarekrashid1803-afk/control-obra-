'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { frentes, promoCodes, tenant as tenantApi, type Sector, getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { LogoOrion } from '@/components/logo-orion';
import { pesosACentavos } from '@/lib/utils';

const TIPOS_OBRA = [
  { value: 'construccion_nueva', label: 'Construcción nueva' },
  { value: 'remodelacion', label: 'Remodelación' },
  { value: 'ampliacion', label: 'Ampliación' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'obra_civil', label: 'Obra civil' },
  { value: 'acabados', label: 'Acabados' },
  { value: 'otro', label: 'Otro' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState(1);
  const [horasRestantes, setHorasRestantes] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sector
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [sectorId, setSectorId] = useState<string>('');

  const [frente, setFrente] = useState({
    codigo: 'FR-001',
    nombre: '',
    presupuestoPesos: '',
    tipoObra: 'construccion_nueva',
    ubicacion: '',
  });

  useEffect(() => {
    promoCodes.status().then((s) => setHorasRestantes(s.horasRestantes)).catch(() => {});
    promoCodes.sectores().then((s) => setSectores(s)).catch(() => {});
    // Si el código traía sector preasignado, lo precargamos
    tenantApi.me().then((t) => { if (t.sectorId) setSectorId(t.sectorId); }).catch(() => {});
  }, []);

  async function guardarSector() {
    if (!sectorId) { setStep(3); return; }
    setError(null);
    setSaving(true);
    try {
      await tenantApi.update({ sectorId });
      setStep(3);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al guardar sector'));
    } finally {
      setSaving(false);
    }
  }

  async function crearPrimerFrente() {
    setError(null);
    setSaving(true);
    try {
      await frentes.create({
        codigo: frente.codigo,
        nombre: frente.nombre,
        presupuestoTotalCentavos: String(pesosACentavos(frente.presupuestoPesos)),
        tipoObra: frente.tipoObra,
        ubicacion: frente.ubicacion || undefined,
        estado: 'activo',
      });
      setStep(4);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al crear el frente'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex justify-center">
          <LogoOrion className="h-10 w-auto text-navy-900" />
        </div>

        {/* Progress — 4 pasos */}
        <div className="flex gap-1.5 mb-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`flex-1 h-1 rounded ${step >= n ? 'bg-navy-900' : 'bg-gray-200'}`} />
          ))}
        </div>

        {horasRestantes !== null && (
          <div className="mb-4 text-center text-[12px] text-gray-500">
            ⏱ Quedan <strong className="text-navy-900">{horasRestantes}h</strong> de prueba
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 text-red-800 text-sm rounded border border-red-200">{error}</div>
        )}

        <div className="card p-7">
          {step === 1 && (
            <>
              <h2 className="text-2xl font-bold text-navy-900 mb-2">Bienvenido, {user?.nombres} 👋</h2>
              <p className="text-[14px] text-gray-600 mb-6 leading-relaxed">
                Tu cuenta quedó activa. Te guiamos por unos pasos rápidos para que arranques hoy mismo.
              </p>
              <ul className="space-y-2 text-[13.5px] text-gray-700 mb-6">
                <li>✓ Elegís el sector de tu empresa</li>
                <li>✓ Creás tu primer frente de obra</li>
                <li>✓ Entrás al dashboard con datos reales</li>
              </ul>
              <button onClick={() => setStep(2)} className="w-full py-3 bg-navy-900 text-white font-semibold rounded hover:bg-navy-800">
                Empezar →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-bold text-navy-900 mb-1">¿En qué sector trabaja tu empresa?</h2>
              <p className="text-[13px] text-gray-500 mb-5">La app se adapta al tipo de obras u operaciones que manejas. Podés cambiarlo después.</p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mb-6">
                {sectores.map((s) => {
                  const active = sectorId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSectorId(s.id)}
                      className={`text-left p-3.5 rounded-lg border-2 transition ${
                        active ? 'border-navy-900 bg-gray-50' : 'border-gray-200 hover:border-navy-500'
                      }`}
                    >
                      <div className="text-2xl mb-1.5">{s.iconEmoji}</div>
                      <div className="font-semibold text-[13px] text-navy-900 leading-tight">{s.nombre}</div>
                      {s.descripcion && <div className="text-[10.5px] text-gray-500 mt-1 leading-snug">{s.descripcion}</div>}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn btn-secondary">← Atrás</button>
                <button
                  onClick={guardarSector}
                  disabled={saving || !sectorId}
                  className="flex-1 py-3 bg-navy-900 text-white font-semibold rounded hover:bg-navy-800 disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : 'Continuar →'}
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-xl font-bold text-navy-900 mb-1">Tu primer frente de obra</h2>
              <p className="text-[13px] text-gray-500 mb-5">Cada frente es un centro de costos con presupuesto y responsable.</p>

              <Field label="Nombre del frente *">
                <input value={frente.nombre} onChange={(e) => setFrente({ ...frente, nombre: e.target.value })} required className="input" placeholder="Torre Aurora · Casa Sur · etc." />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Código *">
                  <input value={frente.codigo} onChange={(e) => setFrente({ ...frente, codigo: e.target.value.toUpperCase() })} className="input font-mono" />
                </Field>
                <Field label="Tipo de obra">
                  <select value={frente.tipoObra} onChange={(e) => setFrente({ ...frente, tipoObra: e.target.value })} className="input">
                    {TIPOS_OBRA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Presupuesto total (COP) *">
                <input
                  type="text"
                  inputMode="numeric"
                  value={frente.presupuestoPesos}
                  onChange={(e) => setFrente({ ...frente, presupuestoPesos: e.target.value.replace(/[^0-9.]/g, '') })}
                  className="input text-right font-mono"
                  placeholder="850000000"
                />
              </Field>

              <Field label="Ubicación">
                <input value={frente.ubicacion} onChange={(e) => setFrente({ ...frente, ubicacion: e.target.value })} className="input" placeholder="Cra 100 #15-20, Cali" />
              </Field>

              <div className="flex gap-2 mt-6">
                <button onClick={() => setStep(2)} className="btn btn-secondary">← Atrás</button>
                <button
                  onClick={crearPrimerFrente}
                  disabled={saving || !frente.nombre || !frente.presupuestoPesos}
                  className="flex-1 py-3 bg-navy-900 text-white font-semibold rounded hover:bg-navy-800 disabled:opacity-50"
                >
                  {saving ? 'Creando…' : 'Crear y continuar →'}
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <div className="text-center">
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-2xl font-bold text-navy-900 mb-2">Listo</h2>
              <p className="text-[14px] text-gray-600 mb-6 leading-relaxed">
                Tu frente fue creado. Ya puedes registrar requisiciones, órdenes de compra,
                movimientos de caja y todo lo demás desde el dashboard.
              </p>
              <button onClick={() => router.push('/dashboard')} className="w-full py-3 bg-navy-900 text-white font-semibold rounded hover:bg-navy-800">
                Ir al dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
