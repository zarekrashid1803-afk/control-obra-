import {
  BadRequestException, Body, Controller, Get, Injectable, Module, Patch,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { updateTenantSchema, UpdateTenantInput } from '@control-obra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async getMe(tenantId: number) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { sector: { select: { id: true, nombre: true, iconEmoji: true } } },
    });
    if (!t) throw new BadRequestException('Tenant no encontrado');
    return {
      id: t.id,
      nombre: t.nombre,
      nit: t.nit,
      sectorId: t.sectorId,
      sector: t.sector,
      trialEndsAt: t.trialEndsAt,
    };
  }

  async update(tenantId: number, input: UpdateTenantInput) {
    // Validar sector si se pasa
    if (input.sectorId) {
      const sector = await this.prisma.sector.findUnique({ where: { id: input.sectorId } });
      if (!sector) throw new BadRequestException(`Sector '${input.sectorId}' no existe`);
    }
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(input.nombre !== undefined ? { nombre: input.nombre } : {}),
        ...(input.sectorId !== undefined ? { sectorId: input.sectorId } : {}),
      },
      include: { sector: { select: { id: true, nombre: true, iconEmoji: true } } },
    });
    return {
      id: updated.id,
      nombre: updated.nombre,
      sectorId: updated.sectorId,
      sector: updated.sector,
      trialEndsAt: updated.trialEndsAt,
    };
  }
}

@ApiTags('tenant')
@ApiBearerAuth()
@Controller('tenant')
class TenantController {
  constructor(private svc: TenantService) {}

  @Get('me')
  @ApiOperation({ summary: 'Datos del tenant del usuario actual' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.svc.getMe(user.tenantId);
  }

  @Patch('me')
  @RequireRoles('admin')
  @ApiOperation({ summary: 'Actualizar tenant (sector, nombre) — solo admin' })
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantInput,
  ) {
    return this.svc.update(user.tenantId, body);
  }
}

@Module({
  providers: [TenantService],
  controllers: [TenantController],
  exports: [TenantService],
})
export class TenantModule {}
