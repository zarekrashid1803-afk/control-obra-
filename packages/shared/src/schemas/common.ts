import { z } from 'zod';

export const idSchema = z.string().uuid();

export const codigoSchema = z.string().regex(/^[A-Z]{2,3}-\d{4}-\d{4,5}$/, {
  message: 'Formato esperado: XX-YYYY-NNNN (ej. RQ-2026-0142)',
});

export const nitSchema = z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d$/, {
  message: 'NIT debe tener formato XXX.XXX.XXX-X',
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginatedResponse = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    pagination: z.object({
      page: z.number(),
      pageSize: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  });

export const moneyCentavosSchema = z.coerce.bigint().nonnegative();

export const dateInputSchema = z.union([z.string().datetime(), z.date()]);
