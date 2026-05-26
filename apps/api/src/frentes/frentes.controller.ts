import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { createFrenteSchema, updateFrenteSchema, CreateFrenteInput, UpdateFrenteInput } from '@control-obra/shared';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FrentesService } from './frentes.service';

@ApiTags('frentes')
@ApiBearerAuth()
@Controller('frentes')
export class FrentesController {
  constructor(private svc: FrentesService) {}

  @Get()
  list() { return this.svc.list(); }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.svc.getById(id); }

  @Post()
  @RequireRoles('admin', 'director')
  create(@Body(new ZodValidationPipe(createFrenteSchema)) body: CreateFrenteInput) {
    return this.svc.create(body);
  }

  @Patch(':id')
  @RequireRoles('admin', 'director')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateFrenteSchema)) body: UpdateFrenteInput,
  ) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @RequireRoles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.softDelete(id);
  }

  @Post(':id/recalcular-consumido')
  @RequireRoles('admin', 'director')
  recalcular(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.recalcularConsumido(id);
  }
}
