import { z } from 'zod';
import { ESTADOS_REQUISICION, PRIORIDADES, UNIDADES } from '../constants';
import { idSchema, moneyCentavosSchema } from './common';

export const requisicionItemInputSchema = z.object({
  materialId: idSchema.optional().nullable(),
  descripcion: z.string().min(2),
  unidad: z.enum(UNIDADES),
  cantidad: z.coerce.number().positive(),
  // Precio OPCIONAL: una requisición es un pedido; el precio lo define Compras
  // al cotizar. Por defecto 0 → la requisición queda con total $0 hasta la OC.
  precioUnitarioCentavos: moneyCentavosSchema.optional().default(0n as any),
  notas: z.string().optional(),
});
export type RequisicionItemInput = z.infer<typeof requisicionItemInputSchema>;

export const createRequisicionSchema = z.object({
  frenteId: idSchema,
  descripcion: z.string().min(3),
  prioridad: z.enum(PRIORIDADES).default('normal'),
  items: z.array(requisicionItemInputSchema).min(1, {
    message: 'Una requisición debe tener al menos un item',
  }),
});
export type CreateRequisicionInput = z.infer<typeof createRequisicionSchema>;

export const transicionRequisicionSchema = z.object({
  accion: z.enum(['enviar', 'avalar', 'aprobar', 'rechazar', 'recibir']),
  observacion: z.string().optional(),
  motivoRechazo: z.string().optional(),
});
export type TransicionInput = z.infer<typeof transicionRequisicionSchema>;

export const requisicionFilterSchema = z.object({
  estado: z.enum(ESTADOS_REQUISICION).optional(),
  frenteId: idSchema.optional(),
  solicitanteId: idSchema.optional(),
  prioridad: z.enum(PRIORIDADES).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});
export type RequisicionFilter = z.infer<typeof requisicionFilterSchema>;
