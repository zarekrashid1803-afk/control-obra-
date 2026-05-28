import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

/**
 * Filtro global de excepciones. Garantiza que:
 *  - Las HttpException intencionales (BadRequest, Conflict, Unauthorized…)
 *    pasen tal cual al cliente.
 *  - Los errores conocidos de Prisma se mapeen a respuestas limpias.
 *  - Cualquier error inesperado devuelva un 500 genérico SIN filtrar stack
 *    traces ni detalles internos (se loguean del lado del servidor).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    // 1) Excepciones HTTP intencionales: respetar status + cuerpo.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return res.status(status).json(this.normalize(exception.getResponse(), status));
    }

    // 2) Errores conocidos de Prisma → status apropiado, mensaje seguro.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapPrisma(exception);
      this.logger.warn(`Prisma ${exception.code} en ${req.method} ${req.url}`);
      return res.status(mapped.statusCode).json(mapped);
    }

    // 3) Cualquier otra cosa: 500 genérico. Log completo solo en servidor.
    const msg = exception instanceof Error ? exception.stack || exception.message : String(exception);
    this.logger.error(`Error no controlado en ${req.method} ${req.url}: ${msg}`);
    // Reportar a Sentry (no-op si no hay SENTRY_DSN configurado).
    Sentry.captureException(exception);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
    });
  }

  private mapPrisma(e: Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P2002':
        return { statusCode: HttpStatus.CONFLICT, message: 'Ya existe un registro con ese valor único.' };
      case 'P2025':
        return { statusCode: HttpStatus.NOT_FOUND, message: 'Registro no encontrado.' };
      case 'P2003':
        return { statusCode: HttpStatus.BAD_REQUEST, message: 'Referencia inválida (clave foránea).' };
      default:
        return { statusCode: HttpStatus.BAD_REQUEST, message: 'Operación inválida.' };
    }
  }

  // Asegura una forma consistente { statusCode, message, ... } en la respuesta.
  private normalize(body: unknown, status: number) {
    if (typeof body === 'string') return { statusCode: status, message: body };
    if (body && typeof body === 'object') return { statusCode: status, ...(body as object) };
    return { statusCode: status, message: 'Error' };
  }
}
