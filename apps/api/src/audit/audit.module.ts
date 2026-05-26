import {
  Controller, Get, Injectable, Module, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { paginationQuerySchema, PaginationQuery } from '@control-obra/shared';

@Injectable()
class AuditService {
  constructor(private prisma: PrismaService) {}

  async list(
    p: { page: number; pageSize: number },
    f: { entidad?: string; entidadId?: string; actorId?: string },
  ) {
    const where: any = {};
    if (f.entidad) where.entidad = f.entidad;
    if (f.entidadId) where.entidadId = f.entidadId;
    if (f.actorId) where.actorId = f.actorId;

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip: (p.page - 1) * p.pageSize, take: p.pageSize,
        orderBy: { creadoAt: 'desc' },
        include: { actor: { select: { id: true, nombres: true, apellidos: true, iniciales: true } } },
      }),
    ]);
    return { data, pagination: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.ceil(total / p.pageSize) } };
  }
}

@ApiTags('auditoria')
@ApiBearerAuth()
@Controller('auditoria')
class AuditController {
  constructor(private svc: AuditService) {}

  @Get()
  @RequireRoles('admin', 'director', 'auditor')
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) p: PaginationQuery,
    @Query('entidad') entidad?: string,
    @Query('entidadId') entidadId?: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.svc.list(p, { entidad, entidadId, actorId });
  }
}

@Module({ providers: [AuditService], controllers: [AuditController] })
export class AuditModule {}
