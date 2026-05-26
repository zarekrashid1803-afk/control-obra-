import { z } from 'zod';
import { TIPOS_MOVIMIENTO_CAJA } from '../constants';
import { idSchema, moneyCentavosSchema } from './common';

export const createMovimientoCajaSchema = z.object({
  tipo: z.enum(TIPOS_MOVIMIENTO_CAJA),
  concepto: z.string().min(3),
  montoCentavos: moneyCentavosSchema,
  frenteId: idSchema.optional(),
  ordenCompraId: idSchema.optional(),
  proveedorId: idSchema.optional(),
  categoria: z.string().optional(),
  retencionFuenteCentavos: moneyCentavosSchema.optional(),
  retencionIvaCentavos: moneyCentavosSchema.optional(),
  retencionIcaCentavos: moneyCentavosSchema.optional(),
  soporteAdjuntoId: idSchema.optional(),
  idempotencyKey: z.string().min(8).optional(),
});
export type CreateMovimientoCajaInput = z.infer<typeof createMovimientoCajaSchema>;

export const cerrarArqueoSchema = z.object({
  fecha: z.coerce.date(),
  saldoRealCentavos: moneyCentavosSchema,
  justificacionDiferencia: z.string().optional(),
  mfaCode: z.string().length(6),
});
export type CerrarArqueoInput = z.infer<typeof cerrarArqueoSchema>;
