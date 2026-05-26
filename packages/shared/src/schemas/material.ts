import { z } from 'zod';
import { UNIDADES } from '../constants';
import { idSchema, moneyCentavosSchema } from './common';

export const createMaterialSchema = z.object({
  sku: z.string().regex(/^MAT-\d{4,6}$/, { message: 'SKU debe ser MAT-XXXX' }),
  descripcion: z.string().min(3),
  unidad: z.enum(UNIDADES),
  categoria: z.string().optional(),
  precioReferenciaCentavos: moneyCentavosSchema,
  stockMinimo: z.coerce.number().nonnegative().default(0),
  proveedorPreferenteId: idSchema.optional(),
  activo: z.boolean().default(true),
});
export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;

export const updateMaterialSchema = createMaterialSchema.partial();
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
