import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Rol } from '@control-obra/shared';

export interface AuthUser {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  iniciales: string;
  roles: Rol[];
  frentesAsignados: string[];
  tenantId: number;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return data ? req.user?.[data] : req.user;
  },
);
