'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { documentosSoporte, proveedores, frentes, ApiError } from '@/lib/api';
import { fmtCOP } from '@/lib/utils';
import { PhotoUpload } from '@/components/photo-upload';

const IVA_RATE = 0.19;
const RETEFUENTE_DEFAULT = 0.025;

export default function NuevoDocSoportePage() {
  const router = useRouter();

  // Form state
  const [esAdHoc, setEsAdHoc] = useState(true);
  const [proveedorId, setProveedorId] = useState<string>('');
  const [tipoDocumento, setTipoDocumento] = useState<'CC'|'CE'|'NIT'|'PASAPORTE'>('CC');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [nombreProveedor, setNombreProveedor] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('Cali');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [servicioPrestado, setServicioPrestado] = useState('');
  const [frenteId, setFrenteId] = useState('');
  const [fechaDocumento, setFechaDocumento] = useState(new Date().toISOString().slice(0, 10));
  const [formaPago, setFormaPago] = useState<'efectivo'|'transferencia'|'cheque'|'tarjeta'>('transferencia');
  const [subtotalPesos, setSubtotalPesos] = useState('');
  const [aplicaIva, setAplicaIva] = useState(false);
  const [aplicaReteFuente, setAplicaReteFuente] = useState(true);

  // Upload state — el preview lo maneja el componente PhotoUpload
  const [adjuntoId, setAdjuntoId] = useState<string>('');
  const [adjuntoNombre, setAdjuntoNombre] = useState<string>('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provsQuery = useQuery({ queryKey: ['proveedores'], queryFn: () => proveedores.list({ pageSize: 100 }) });
  const frentesQuery = useQuery({ queryKey: ['frentes'], queryFn: () => frentes.list() });

  // Cálculos
  const subtotal = Number(subtotalPesos.replace(/[^0-9.]/g, '')) || 0;
  const iva = aplicaIva ? Math.round(subtotal * IVA_RATE) : 0;
  const reteFuente = aplicaReteFuente ? Math.round(subtotal * RETEFUENTE_DEFAULT) : 0;
  const total = subtotal + iva - reteFuente;

  async function onPickProveedor(id: string) {
    setProveedorId(id);
    if (!id) {
      setEsAdHoc(true);
      return;
    }
    setEsAdHoc(false);
    const prov = provsQuery.data?.data?.find((p: any) => p.id === id);
    if (prov) {
      setTipoDocumento(prov.tipoPersona === 'natural' ? 'CC' : 'NIT');
      setNumeroDocumento(prov.nit);
      setNombreProveedor(prov.razonSocial);
      setDireccion(prov.direccion || '');
      setCiudad(prov.ciudad || 'Cali');
      setTelefono(prov.telefono || '');
      setEmail(prov.email || '');
    }
  }

  async function onSubmit(emitir = false) {
    setError(null);
    if (!nombreProveedor || !numeroDocumento || !servicioPrestado || subtotal <= 0) {
      setError('Completa los campos obligatorios: nombre, número de documento, servicio y monto');
      return;
    }
    setSubmitting(true);
    try {
      const created = await documentosSoporte.create({
        proveedorId: proveedorId || null,
        esAdHoc,
        tipoDocumento,
        numeroDocumento,
        nombreProveedor,
        direccion,
        ciudad,
        telefono,
        email: email || undefined,
        servicioPrestado,
        frenteId: frenteId || null,
        fechaDocumento: new Date(fechaDocumento).toISOString(),
        formaPago,
        subtotalCentavos: String(BigInt(Math.round(subtotal * 100))),
        ivaCentavos: String(BigInt(iva * 100)),
        retencionFuenteCentavos: String(BigInt(reteFuente * 100)),
        identificacionAdjuntoId: adjuntoId || null,
      });
      if (emitir && created?.id) {
        await documentosSoporte.emitir(created.id);
      }
      router.push(`/documentos-soporte/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as any;
        // Errores de validación Zod traen un array {path, message}: mostrarlos
        // campo por campo en vez del genérico "Validación falló".
        if (Array.isArray(body?.errors) && body.errors.length) {
          setError(
            body.errors
              .map((e: any) => (e.path ? `${e.path}: ${e.message}` : e.message))
              .join(' · '),
          );
        } else {
          const msg = body?.message || err.message;
          setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
      } else {
        setError('Error al guardar');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-8">
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-gray-500 flex gap-1.5 mb-1.5">
            <Link href="/documentos-soporte" className="text-navy-700 hover:underline">Documentos Soporte</Link>
            <span>›</span><span>Nuevo</span>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900 tracking-tight">Nuevo Documento Soporte</h1>
          <p className="text-[13px] text-gray-500 mt-1">DSNE — compra a proveedor no obligado a facturar</p>
        </div>
        <Link href="/documentos-soporte" className="btn btn-secondary">← Cancelar</Link>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 text-red-800 text-sm rounded border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[1.4fr_1fr] gap-4 max-[1100px]:grid-cols-1">
        {/* IZQUIERDA: formulario */}
        <div className="space-y-4">

          {/* Proveedor */}
          <Section title="Proveedor" hint="¿Proveedor del catálogo o uno ocasional?">
            <div className="flex gap-2 mb-4">
              <Toggle active={!esAdHoc} onClick={() => setEsAdHoc(false)}>📋 Del catálogo</Toggle>
              <Toggle active={esAdHoc} onClick={() => { setEsAdHoc(true); setProveedorId(''); }}>✏️ Ocasional / Nuevo</Toggle>
            </div>

            {!esAdHoc && (
              <Field label="Proveedor registrado">
                <select value={proveedorId} onChange={(e) => onPickProveedor(e.target.value)} className="input">
                  <option value="">— Selecciona un proveedor —</option>
                  {provsQuery.data?.data?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.razonSocial} — {p.nit}</option>
                  ))}
                </select>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de documento *">
                <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value as any)} className="input">
                  <option value="CC">Cédula de Ciudadanía</option>
                  <option value="CE">Cédula de Extranjería</option>
                  <option value="NIT">NIT</option>
                  <option value="PASAPORTE">Pasaporte</option>
                </select>
              </Field>
              <Field label="Número de documento *">
                <input
                  value={numeroDocumento}
                  onChange={(e) => setNumeroDocumento(e.target.value)}
                  className="input"
                  placeholder={tipoDocumento === 'NIT' ? '900.123.456-1' : '1234567890'}
                />
              </Field>
            </div>

            <Field label="Nombre o razón social *">
              <input
                value={nombreProveedor}
                onChange={(e) => setNombreProveedor(e.target.value)}
                className="input"
                placeholder="Ej: Juan Pérez Martínez"
              />
            </Field>
          </Section>

          {/* Contacto */}
          <Section title="Datos de contacto">
            <div className="grid grid-cols-[2fr_1fr] gap-3">
              <Field label="Dirección">
                <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className="input" placeholder="Cra 5 #12-34" />
              </Field>
              <Field label="Ciudad">
                <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} className="input" placeholder="Cali" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Teléfono">
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="input" placeholder="3001234567" />
              </Field>
              <Field label="Email">
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="input" placeholder="proveedor@email.com" />
              </Field>
            </div>
          </Section>

          {/* Servicio */}
          <Section title="Servicio prestado" hint="Describe el bien o servicio adquirido">
            <Field label="Descripción del servicio *">
              <textarea
                value={servicioPrestado}
                onChange={(e) => setServicioPrestado(e.target.value)}
                className="input min-h-[100px] resize-y"
                placeholder="Ej: Mano de obra calificada para instalación de cerámica en piso 3 — 80 m² · jornada de 8h"
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Fecha del documento *">
                <input type="date" value={fechaDocumento} onChange={(e) => setFechaDocumento(e.target.value)} className="input" />
              </Field>
              <Field label="Frente (centro de costos)">
                <select value={frenteId} onChange={(e) => setFrenteId(e.target.value)} className="input">
                  <option value="">— Sin frente —</option>
                  {frentesQuery.data?.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.codigo} {f.nombre}</option>
                  ))}
                </select>
              </Field>
              <Field label="Forma de pago">
                <select value={formaPago} onChange={(e) => setFormaPago(e.target.value as any)} className="input">
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="cheque">Cheque</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* Identificación */}
          <Section title="Identificación del proveedor" hint="Foto/PDF de la cédula o RUT — opcional pero recomendado para auditoría">
            <PhotoUpload
              current={adjuntoId ? { id: adjuntoId, nombre: adjuntoNombre } : null}
              onUploaded={(adj) => { setAdjuntoId(adj.id); setAdjuntoNombre(adj.nombre); }}
              onCleared={() => { setAdjuntoId(''); setAdjuntoNombre(''); }}
              hint="JPG, PNG, WEBP, HEIC o PDF — máx 10MB"
            />
          </Section>
        </div>

        {/* DERECHA: montos + sticky actions */}
        <div className="space-y-4">
          <Section title="Montos">
            <Field label="Subtotal (COP) *">
              <input
                type="text"
                inputMode="numeric"
                value={subtotalPesos}
                onChange={(e) => setSubtotalPesos(e.target.value.replace(/[^0-9.]/g, ''))}
                className="input text-right font-mono text-base"
                placeholder="0"
              />
            </Field>

            <label className="flex items-center gap-2 text-[13px] mt-3">
              <input type="checkbox" checked={aplicaIva} onChange={(e) => setAplicaIva(e.target.checked)} />
              Aplica IVA (19%)
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={aplicaReteFuente} onChange={(e) => setAplicaReteFuente(e.target.checked)} />
              Aplica Retención en la Fuente (2.5%)
            </label>

            <hr className="my-4 border-gray-200" />

            <Row label="Subtotal" value={fmtCOP(subtotal * 100, { full: true })} />
            {aplicaIva && <Row label="IVA 19%" value={fmtCOP(iva * 100, { full: true })} />}
            {aplicaReteFuente && <Row label="ReteFuente 2.5%" value={`- ${fmtCOP(reteFuente * 100, { full: true })}`} subtle />}
            <hr className="my-2 border-gray-200" />
            <Row label="TOTAL" value={fmtCOP(total * 100, { full: true })} bold />
          </Section>

          <div className="card p-4 sticky top-20 space-y-2 bg-gold-100 border-gold-500/40">
            <div className="text-[11px] uppercase font-semibold text-gold-700 tracking-wider mb-2">
              Acciones
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={() => onSubmit(false)}
              className="btn btn-secondary w-full justify-center py-2.5 disabled:opacity-50"
            >
              {submitting ? 'Guardando…' : '📝 Guardar borrador'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => onSubmit(true)}
              className="btn btn-accent w-full justify-center py-2.5 disabled:opacity-50"
            >
              {submitting ? 'Emitiendo…' : '✓ Guardar y emitir'}
            </button>
            <div className="text-[11px] text-gray-600 mt-2">
              Al <strong>emitir</strong> se registra el documento con un CUDS interno como soporte contable. ⚠️ Aún <strong>no se transmite a la DIAN</strong> (integración próximamente).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="p-3.5 border-b border-gray-200">
        <div className="text-[14px] font-semibold text-navy-900">{title}</div>
        {hint && <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div>}
      </div>
      <div className="p-4 space-y-3">{children}</div>
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

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 px-3 rounded border text-[13px] font-medium transition ${
        active
          ? 'bg-navy-700 text-white border-navy-700'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function Row({ label, value, bold, subtle }: { label: string; value: string; bold?: boolean; subtle?: boolean }) {
  return (
    <div className={`flex justify-between text-[13px] ${bold ? 'font-bold text-navy-900 text-[15px]' : ''} ${subtle ? 'text-gray-500' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
