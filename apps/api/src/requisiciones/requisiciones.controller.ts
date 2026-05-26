import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  createRequisicionSchema, transicionRequisicionSchema, requisicionFilterSchema, paginationQuerySchema,
  CreateRequisicionInput, TransicionInput, RequisicionFilter, PaginationQuery,
} from '@control-obra/shared';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequisicionesService } from './requisiciones.service';

@ApiTags('requisiciones')
@ApiBearerAuth()
@Controller('requisiciones')
export class RequisicionesController {
  constructor(private svc: RequisicionesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar requisiciones (filtrable)' })
  list(
    @Query(new ZodValidationPipe(requisicionFilterSchema)) filter: RequisicionFilter,
    @Query(new ZodValidationPipe(paginationQuerySchema)) pagination: PaginationQuery,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.list(filter, pagination, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de requisición con timeline' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getById(id);
  }

  @Post()
  @RequireRoles('residente', 'admin')
  @ApiOperation({ summary: 'Crear requisición (estado: borrador)' })
  create(
    @Body(new ZodValidationPipe(createRequisicionSchema)) body: CreateRequisicionInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.create(body, user);
  }

  @Post(':id/transicion')
  @ApiOperation({ summary: 'Disparar acción sobre la requisición (enviar/avalar/aprobar/rechazar/recibir)' })
  transicionar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(transicionRequisicionSchema)) body: TransicionInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.transicionar(id, body, user);
  }
}
