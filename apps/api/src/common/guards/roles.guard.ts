import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Rol } from '@control-obra/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Bypass total cuando ROLES_ENABLED=false (modo revisión interna).
    // Sigue requiriendo autenticación — solo se salta el chequeo de roles.
    if (process.env.ROLES_ENABLED === 'false') return true;

    const required = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException('No autenticado');

    const ok = required.some((r) => user.roles?.includes(r));
    if (!ok) {
      throw new ForbiddenException(
        `Rol insuficiente. Requerido alguno de: ${required.join(', ')}. Tienes: ${user.roles?.join(', ') || 'ninguno'}.`,
      );
    }
    return true;
  }
}
