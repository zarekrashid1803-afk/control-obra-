import { z } from 'zod';
import { idSchema, moneyCentavosSchema } from './common';

export const estadoFrenteSchema = z.enum(['activo', 'pausado', 'cerrado']);
export type EstadoFrente = z.infer<typeof estadoFrenteSchema>;

// FR-001, FR-002, etc. (mínimo 3 dígitos)
const frenteCodigoSchema = z.string().regex(/^FR-\d{3,5}$/, {
  message: 'Formato esperado: FR-NNN (ej. FR-001)',
});

export const createFrenteSchema = z.object({
  codigo: frenteCodigoSchema,
  nombre: z.string().min(3),
  presupuestoTotalCentavos: moneyCentavosSchema,
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2f5d8a'),
  estado: estadoFrenteSchema.default('activo'),
  fechaInicio: z.coerce.date().optional(),
  fechaFinEstimada: z.coerce.date().optional(),
  ubicacion: z.string().optional(),
  responsableId: idSchema.optional(),
});
export type CreateFrenteInput = z.infer<typeof createFrenteSchema>;

export const updateFrenteSchema = createFrenteSchema.partial();
export type UpdateFrenteInput = z.infer<typeof updateFrenteSchema>;
