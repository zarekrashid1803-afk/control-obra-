import { z } from 'zod';

// Formato PRE-A4B7 (4 chars alfanuméricos en mayúsculas)
export const promoCodeFormatSchema = z.string().regex(/^PRE-[A-Z0-9]{4}$/, {
  message: 'Formato esperado: PRE-XXXX (4 caracteres alfanuméricos)',
});

export const generarPromoCodesSchema = z.object({
  cantidad: z.number().int().min(1).max(50),
  notes: z.string().max(200).optional(),
  sectorId: z.string().optional(), // si se pasa, el tenant creado nace con este sector
});
export type GenerarPromoCodesInput = z.infer<typeof generarPromoCodesSchema>;

export const signupSchema = z.object({
  codigo: promoCodeFormatSchema,
  email: z.string().email(),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  nombres: z.string().min(2),
  apellidos: z.string().min(2),
  nombreConstructora: z.string().min(3),
  // Si el cliente NO especifica sector pero el código tiene uno preasignado, se usa ese.
  // Si tampoco hay preasignado, queda null (configurable después).
  sectorId: z.string().optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const extenderTrialSchema = z.object({
  tenantId: z.number().int().positive(),
  horasAdicionales: z.number().int().min(1).max(8760), // máx 1 año
});
export type ExtenderTrialInput = z.infer<typeof extenderTrialSchema>;
