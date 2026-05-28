import { z } from 'zod';
import { ROLES } from '../constants';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  mfaCode: z.string().length(6).optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Código TOTP de 6 dígitos
export const mfaCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'El código debe ser de 6 dígitos'),
});
export type MfaCodeInput = z.infer<typeof mfaCodeSchema>;

// Recuperación de contraseña
export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const authTokensResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    nombres: z.string(),
    apellidos: z.string(),
    iniciales: z.string(),
    roles: z.array(z.enum(ROLES)),
  }),
});
export type AuthTokensResponse = z.infer<typeof authTokensResponse>;
