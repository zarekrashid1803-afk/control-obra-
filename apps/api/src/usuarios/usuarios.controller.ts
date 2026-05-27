import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  createUsuarioSchema,
  updateUsuarioSchema,
  paginationQuerySchema,
  CreateUsuarioInput,
  UpdateUsuarioInput,
  PaginationQuery,
} from '@control-obra/shared';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsuariosService } from './usuarios.service';

@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(private usuarios: UsuariosService) {}

  @Get('me')
  @ApiOperation({ summary: 'Mi perfil' })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get()
  @RequireRoles('admin', 'director')
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) q: PaginationQuery,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usuarios.list(q, user.tenantId);
  }

  @Get(':id')
  @RequireRoles('admin', 'director')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.usuarios.getById(id, user.tenantId);
  }

  @Post()
  @RequireRoles('admin')
  @UsePipes(new ZodValidationPipe(createUsuarioSchema))
  create(@Body() body: CreateUsuarioInput, @CurrentUser() user: AuthUser) {
    return this.usuarios.create(body, user.tenantId);
  }

  @Patch(':id')
  @RequireRoles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateUsuarioSchema)) body: UpdateUsuarioInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usuarios.update(id, body, user.tenantId);
  }

  @Delete(':id')
  @RequireRoles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.usuarios.softDelete(id, user.tenantId);
  }
}
