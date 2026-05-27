import {
  BadRequestException, Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Query, Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { generarOCSchema, GenerarOCInput, paginationQuerySchema, PaginationQuery } from '@control-obra/shared';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrdenesCompraService } from './ordenes-compra.service';
import { RequisicionesModule } from '../requisiciones/requisiciones.module';
import { NotificationsModule } from '../notifications/notifications.module';

@ApiTags('ordenes-compra')
@ApiBearerAuth()
@Controller('ordenes-compra')
class OrdenesCompraController {
  constructor(private svc: OrdenesCompraService) {}

  @Get()
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) p: PaginationQuery, @CurrentUser() user: AuthUser, @Query('estado') estado?: string) {
    return this.svc.list({ ...p, estado }, user.tenantId);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.svc.getById(id, user.tenantId); }

  @Post()
  @RequireRoles('compras', 'admin')
  generar(
    @Body(new ZodValidationPipe(generarOCSchema)) body: GenerarOCInput,
    @CurrentUser() user: AuthUser,
  ) { return this.svc.generar(body, user); }

  @Post(':id/enviar')
  @RequireRoles('compras', 'admin')
  @ApiOperation({ summary: 'Marcar OC como enviada y mandar PDF al email del proveedor' })
  async enviar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.svc.enviarConEmail(id, user.tenantId);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Descargar el PDF de la orden de compra' })
  async pdf(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const { buffer, filename } = await this.svc.generarPdf(id, user.tenantId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }

  @Post(':id/anular')
  @RequireRoles('compras', 'admin', 'director')
  anular(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Body('motivo') motivo: string) {
    return this.svc.anular(id, motivo || 'Anulada sin motivo registrado', user.tenantId);
  }
}

@Module({
  imports: [RequisicionesModule, NotificationsModule],
  providers: [OrdenesCompraService],
  controllers: [OrdenesCompraController],
  exports: [OrdenesCompraService],
})
export class OrdenesCompraModule {}
