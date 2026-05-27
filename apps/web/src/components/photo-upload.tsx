'use client';
import { useRef, useState } from 'react';
import { uploadAdjunto } from '@/lib/api';

type Adjunto = { id: string; urlS3: string; nombre: string; mimeType: string };

type Props = {
  /** Llamado cuando se sube un archivo exitosamente */
  onUploaded: (adj: Adjunto) => void;
  /** Llamado al quitar el adjunto */
  onCleared?: () => void;
  /** Si ya hay un adjunto cargado, lo pasamos para mostrar el preview */
  current?: { id: string; nombre: string; previewUrl?: string } | null;
  /** Texto del label cuando no hay adjunto */
  hint?: string;
};

/**
 * Componente reusable de upload de foto/PDF.
 * - Botón "Tomar foto" abre cámara DIRECTAMENTE en móvil (capture="environment")
 * - Botón "Subir archivo" abre selector tradicional (incluye galería/archivos)
 * - Muestra preview tras subir
 */
export function PhotoUpload({ onUploaded, onCleared, current, hint }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(current?.previewUrl || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      // Preview local mientras sube
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);

      const adj = await uploadAdjunto(file);
      onUploaded(adj);
    } catch (err: any) {
      setError(err?.message || 'Error subiendo archivo');
      setPreviewUrl('');
    } finally {
      setUploading(false);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function clear() {
    setPreviewUrl('');
    setError(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
    onCleared?.();
  }

  // Inputs ocultos
  const inputs = (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onChange}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={onChange}
        className="hidden"
      />
    </>
  );

  if (current?.id) {
    return (
      <div>
        {inputs}
        <div className="flex gap-3 items-center p-3 bg-gray-50 rounded border border-gray-200">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Adjunto" className="w-20 h-20 object-cover rounded border border-gray-300" />
          ) : (
            <div className="w-20 h-20 bg-gray-300 rounded grid place-items-center text-2xl">📄</div>
          )}
          <div className="flex-1">
            <div className="text-[13px] font-medium">{current.nombre}</div>
            <div className="text-[11px] text-st-aprobada">✓ Subido correctamente</div>
          </div>
          <button type="button" onClick={clear} className="btn btn-secondary btn-sm">Quitar</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {inputs}
      {error && (
        <div className="mb-2 px-3 py-2 bg-red-50 text-red-800 text-[12px] rounded border border-red-200">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
          className="py-5 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-navy-500 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <div className="text-3xl mb-1">📷</div>
          <div className="text-[13px] font-semibold text-navy-900">
            {uploading ? 'Subiendo…' : 'Tomar foto'}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">Cámara directa</div>
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="py-5 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-navy-500 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <div className="text-3xl mb-1">📎</div>
          <div className="text-[13px] font-semibold text-navy-900">
            {uploading ? 'Subiendo…' : 'Subir archivo'}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">Galería o PDF</div>
        </button>
      </div>
      {hint && <div className="text-[11px] text-gray-500 mt-2 text-center">{hint}</div>}
    </div>
  );
}
