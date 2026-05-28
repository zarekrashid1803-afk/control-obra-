import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea centavos (BigInt o string desde el API) a pesos colombianos */
export function fmtCOP(centavosOrPesos: bigint | number | string, opts: { full?: boolean } = {}): string {
  const n = typeof centavosOrPesos === 'string'
    ? Number(centavosOrPesos)
    : typeof centavosOrPesos === 'bigint'
      ? Number(centavosOrPesos)
      : centavosOrPesos;
  const pesos = n / 100;
  if (!opts.full && pesos >= 1_000_000) {
    return `$${(pesos / 1_000_000).toFixed(1)}M`;
  }
  if (!opts.full && pesos >= 1_000) {
    return `$${(pesos / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(pesos);
}

/**
 * Convierte un string de pesos a centavos (BigInt) de forma SEGURA.
 * Trata "." y "," como separadores de miles (uso colombiano: "1.000.000"),
 * por lo que solo conserva dígitos → pesos enteros. Nunca produce BigInt(NaN)
 * (un input inválido o vacío devuelve 0n), evitando crashes de RangeError.
 */
export function pesosACentavos(input: string | number): bigint {
  const digits = String(input).replace(/[^0-9]/g, '');
  if (!digits) return 0n;
  return BigInt(digits) * 100n;
}

export function fmtDate(d: Date | string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(typeof d === 'string' ? new Date(d) : d);
}

export function fmtRelative(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)}d`;
  return fmtDate(date);
}

export const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  pendiente: 'Pendiente Aval',
  avalada: 'Avalada',
  aprobada: 'Aprobada',
  compras: 'En Compras',
  recibida: 'Recibida',
  rechazada: 'Rechazada',
};
