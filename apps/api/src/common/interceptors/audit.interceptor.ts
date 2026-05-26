import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

const SENSITIVE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const SKIP_PATHS = ['/auth/login', '/auth/refresh', '/health'];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(
      tap(async () => {
        if (!SENSITIVE_METHODS.includes(req.method)) return;
        if (SKIP_PATHS.some((p) => req.url?.includes(p))) return;
        if (!req.user) return;

        const entidad = (req.url?.split('?')[0].split('/').filter(Boolean)[2] || 'desconocido')
          .toString();

        try {
          await this.prisma.auditLog.create({
            data: {
              actorId: req.user.id,
              accion: `${req.method} ${req.route?.path || req.url}`,
              entidad,
              entidadId: req.params?.id || null,
              cambios: req.body && Object.keys(req.body).length ? req.body : undefined,
              ip: req.ip,
              userAgent: req.headers['user-agent'] || null,
            },
          });
        } catch (err) {
          // El log de auditoría nunca debe romper la respuesta al cliente
          console.error('[audit-interceptor] error escribiendo audit_log:', err);
        }
      }),
    );
  }
}
