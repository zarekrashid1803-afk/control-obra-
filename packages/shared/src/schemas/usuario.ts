import { z } from 'zod';
import { ROLES } from '../constants';
import { idSchema } from './common';

export const createUsuarioSchema = z.object({
  email: z.string().email(),
  nombres: z.string().min(2),
  apellidos: z.string().min(2),
  password: z.string().min(8),
  roles: z.array(z.enum(ROLES)).min(1),
  frentesAsignados: z.array(idSchema).default([]),
  mfaEnabled: z.boolean().default(false),
});
export type CreateUsuarioInput = z.infer<typeof createUsuarioSchema>;

export const updateUsuarioSchema = createUsuarioSchema
  .partial()
  .omit({ password: true });
export type UpdateUsuarioInput = z.infer<typeof updateUsuarioSchema>;

export const usuarioPublicSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  nombres: z.string(),
  apellidos: z.string(),
  iniciales: z.string(),
  roles: z.array(z.enum(ROLES)),
  frentesAsignados: z.array(idSchema),
  mfaEnabled: z.boolean(),
  activo: z.boolean(),
  ultimoLoginAt: z.date().nullable(),
  createdAt: z.date(),
});
export type UsuarioPublic = z.infer<typeof usuarioPublicSchema>;
