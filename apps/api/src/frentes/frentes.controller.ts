import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { createFrenteSchema, updateFrenteSchema, CreateFrenteInput, UpdateFrenteInput } from '@control-obra/shared';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FrentesService } from './frentes.service';

@ApiTags('frentes')
@ApiBearerAuth()
@Controller('frentes')
export class FrentesController {
  constructor(private svc: FrentesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) { return this.svc.list(user.tenantId); }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.svc.getById(id, user.tenantId);
  }

  @Post()
  @RequireRoles('admin', 'director')
  create(
    @Body(new ZodValidationPipe(createFrenteSchema)) body: CreateFrenteInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.create(body, user.tenantId);
  }

  @Patch(':id')
  @RequireRoles('admin', 'director')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateFrenteSchema)) body: UpdateFrenteInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.update(id, body, user.tenantId);
  }

  @Delete(':id')
  @RequireRoles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.svc.softDelete(id, user.tenantId);
  }

  @Post(':id/recalcular-consumido')
  @RequireRoles('admin', 'director')
  recalcular(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.recalcularConsumido(id);
  }
}
