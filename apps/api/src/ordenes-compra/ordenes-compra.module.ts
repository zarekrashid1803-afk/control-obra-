import {
  Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { generarOCSchema, GenerarOCInput, paginationQuerySchema, PaginationQuery } from '@control-obra/shared';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrdenesCompraService } from './ordenes-compra.service';
import { RequisicionesModule } from '../requisiciones/requisiciones.module';

@ApiTags('ordenes-compra')
@ApiBearerAuth()
@Controller('ordenes-compra')
class OrdenesCompraController {
  constructor(private svc: OrdenesCompraService) {}

  @Get()
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) p: PaginationQuery, @Query('estado') estado?: string) {
    return this.svc.list({ ...p, estado });
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.svc.getById(id); }

  @Post()
  @RequireRoles('compras', 'admin')
  generar(
    @Body(new ZodValidationPipe(generarOCSchema)) body: GenerarOCInput,
    @CurrentUser() user: AuthUser,
  ) { return this.svc.generar(body, user); }

  @Post(':id/enviar')
  @RequireRoles('compras', 'admin')
  enviar(@Param('id', ParseUUIDPipe) id: string) { return this.svc.enviar(id); }

  @Post(':id/anular')
  @RequireRoles('compras', 'admin', 'director')
  anular(@Param('id', ParseUUIDPipe) id: string, @Body('motivo') motivo: string) {
    return this.svc.anular(id, motivo || 'Anulada sin motivo registrado');
  }
}

@Module({
  imports: [RequisicionesModule],
  providers: [OrdenesCompraService],
  controllers: [OrdenesCompraController],
  exports: [OrdenesCompraService],
})
export class OrdenesCompraModule {}
