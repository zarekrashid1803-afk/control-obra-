import { z } from 'zod';
import { CONDICIONES_PAGO } from '../constants';
import { nitSchema } from './common';

export const tipoPersonaSchema = z.enum(['juridica', 'natural']);
export const regimenIvaSchema = z.enum([
  'responsable_iva',
  'no_responsable',
  'exento',
  'regimen_simple',
]);

export const createProveedorSchema = z.object({
  codigo: z.string().regex(/^P-\d{3,5}$/),
  nit: nitSchema,
  razonSocial: z.string().min(3),
  tipoPersona: tipoPersonaSchema.default('juridica'),
  regimenIva: regimenIvaSchema.default('responsable_iva'),
  autorretenedor: z.boolean().default(false),
  granContribuyente: z.boolean().default(false),
  direccion: z.string().optional(),
  ciudad: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional(),
  condicionesPago: z.enum(CONDICIONES_PAGO).default('credito_30'),
  activo: z.boolean().default(true),
});
export type CreateProveedorInput = z.infer<typeof createProveedorSchema>;

export const updateProveedorSchema = createProveedorSchema.partial();
export type UpdateProveedorInput = z.infer<typeof updateProveedorSchema>;
