import { z } from 'zod';
import { idSchema } from './common';

export const estadoItemRecepcionSchema = z.enum([
  'completo',
  'parcial',
  'danado',
  'vencido',
]);
export type EstadoItemRecepcion = z.infer<typeof estadoItemRecepcionSchema>;

export const recepcionItemSchema = z.object({
  ocItemId: idSchema,
  cantidadRecibida: z.coerce.number().nonnegative(),
  estadoItem: estadoItemRecepcionSchema.default('completo'),
  observaciones: z.string().optional(),
});

export const crearEntradaBodegaSchema = z.object({
  ordenCompraId: idSchema,
  items: z.array(recepcionItemSchema).min(1),
  firmaUrl: z.string().url().optional(),
  notas: z.string().optional(),
});
export type CrearEntradaBodegaInput = z.infer<typeof crearEntradaBodegaSchema>;

export const salidaItemSchema = z.object({
  materialId: idSchema,
  cantidad: z.coerce.number().positive(),
});

export const crearSalidaBodegaSchema = z.object({
  frenteId: idSchema,
  requisicionId: idSchema.optional(),
  items: z.array(salidaItemSchema).min(1),
  notas: z.string().optional(),
});
export type CrearSalidaBodegaInput = z.infer<typeof crearSalidaBodegaSchema>;
