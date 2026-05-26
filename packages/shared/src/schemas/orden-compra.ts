import { z } from 'zod';
import { CONDICIONES_PAGO, UNIDADES } from '../constants';
import { idSchema, moneyCentavosSchema } from './common';

export const ocItemInputSchema = z.object({
  materialId: idSchema.nullable(),
  descripcion: z.string().min(2),
  unidad: z.enum(UNIDADES),
  cantidad: z.coerce.number().positive(),
  precioUnitarioCentavos: moneyCentavosSchema,
  descuentoPct: z.coerce.number().min(0).max(100).default(0),
});
export type OCItemInput = z.infer<typeof ocItemInputSchema>;

export const generarOCSchema = z.object({
  requisicionId: idSchema,
  proveedorId: idSchema,
  condicionesPago: z.enum(CONDICIONES_PAGO).default('credito_30'),
  fechaEntregaPrometida: z.coerce.date().optional(),
  notas: z.string().optional(),
  // Permitimos override de items (precios negociados, descuentos)
  items: z.array(ocItemInputSchema).min(1),
});
export type GenerarOCInput = z.infer<typeof generarOCSchema>;
