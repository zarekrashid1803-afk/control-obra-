import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  createMaterialSchema, updateMaterialSchema, paginationQuerySchema,
  CreateMaterialInput, UpdateMaterialInput, PaginationQuery,
} from '@control-obra/shared';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MaterialesService } from './materiales.service';

@ApiTags('materiales')
@ApiBearerAuth()
@Controller('materiales')
export class MaterialesController {
  constructor(private svc: MaterialesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) q: PaginationQuery) {
    return this.svc.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.svc.getById(id); }

  @Post()
  @RequireRoles('admin', 'compras')
  create(@Body(new ZodValidationPipe(createMaterialSchema)) body: CreateMaterialInput) {
    return this.svc.create(body);
  }

  @Patch(':id')
  @RequireRoles('admin', 'compras')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateMaterialSchema)) body: UpdateMaterialInput,
  ) { return this.svc.update(id, body); }

  @Delete(':id')
  @RequireRoles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.softDelete(id); }
}
