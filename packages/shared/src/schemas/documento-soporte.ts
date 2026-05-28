import { z } from 'zod';
import { idSchema, moneyCentavosSchema } from './common';

export const tipoDocumentoPersonaSchema = z.enum(['CC', 'CE', 'NIT', 'PASAPORTE']);
export type TipoDocumentoPersona = z.infer<typeof tipoDocumentoPersonaSchema>;

export const formaPagoSchema = z.enum(['efectivo', 'transferencia', 'cheque', 'tarjeta']);
export type FormaPagoDoc = z.infer<typeof formaPagoSchema>;

export const estadoDocSoporteSchema = z.enum(['borrador', 'emitido', 'anulado']);
export type EstadoDocSoporte = z.infer<typeof estadoDocSoporteSchema>;

export const createDocumentoSoporteSchema = z.object({
  // Proveedor (puede venir registrado o ad-hoc)
  proveedorId: idSchema.optional().nullable(),
  esAdHoc: z.boolean().default(false),

  // Datos del proveedor (siempre obligatorios — snapshot)
  tipoDocumento: tipoDocumentoPersonaSchema,
  numeroDocumento: z.string().min(3),
  nombreProveedor: z.string().min(2),
  direccion: z.string().optional(),
  ciudad: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),

  // Servicio
  servicioPrestado: z.string().min(3, { message: 'Describe el servicio prestado (mínimo 3 caracteres)' }),
  frenteId: idSchema.optional().nullable(),
  fechaDocumento: z.coerce.date(),
  formaPago: formaPagoSchema.default('transferencia'),

  // Montos
  subtotalCentavos: moneyCentavosSchema,
  ivaCentavos: moneyCentavosSchema.optional().default(0n as any),
  retencionFuenteCentavos: moneyCentavosSchema.optional().default(0n as any),
  retencionIvaCentavos: moneyCentavosSchema.optional().default(0n as any),
  retencionIcaCentavos: moneyCentavosSchema.optional().default(0n as any),

  identificacionAdjuntoId: idSchema.optional().nullable(),
});
export type CreateDocumentoSoporteInput = z.infer<typeof createDocumentoSoporteSchema>;

export const updateDocumentoSoporteSchema = createDocumentoSoporteSchema.partial();
export type UpdateDocumentoSoporteInput = z.infer<typeof updateDocumentoSoporteSchema>;

export const docSoporteFilterSchema = z.object({
  estado: estadoDocSoporteSchema.optional(),
  proveedorId: idSchema.optional(),
  frenteId: idSchema.optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});
export type DocSoporteFilter = z.infer<typeof docSoporteFilterSchema>;
