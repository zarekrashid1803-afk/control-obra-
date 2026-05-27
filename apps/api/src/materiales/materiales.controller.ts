import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  createMaterialSchema, updateMaterialSchema, paginationQuerySchema,
  CreateMaterialInput, UpdateMaterialInput, PaginationQuery,
} from '@control-obra/shared';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MaterialesService } from './materiales.service';

@ApiTags('materiales')
@ApiBearerAuth()
@Controller('materiales')
export class MaterialesController {
  constructor(private svc: MaterialesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) q: PaginationQuery, @CurrentUser() user: AuthUser) {
    return this.svc.list(q, user.tenantId);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.svc.getById(id, user.tenantId); }

  @Post()
  @RequireRoles('admin', 'compras')
  create(@Body(new ZodValidationPipe(createMaterialSchema)) body: CreateMaterialInput, @CurrentUser() user: AuthUser) {
    return this.svc.create(body, user.tenantId);
  }

  @Patch(':id')
  @RequireRoles('admin', 'compras')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateMaterialSchema)) body: UpdateMaterialInput,
    @CurrentUser() user: AuthUser,
  ) { return this.svc.update(id, body, user.tenantId); }

  @Delete(':id')
  @RequireRoles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.svc.softDelete(id, user.tenantId); }
}
