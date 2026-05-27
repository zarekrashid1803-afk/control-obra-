import { Module } from '@nestjs/common';
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Injectable, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  createProveedorSchema, updateProveedorSchema, paginationQuerySchema,
  CreateProveedorInput, UpdateProveedorInput, PaginationQuery,
} from '@control-obra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Injectable()
export class ProveedoresService {
  constructor(private prisma: PrismaService) {}
  async list(p: { page: number; pageSize: number; search?: string }, tenantId: number) {
    const where: any = { deletedAt: null, tenantId };
    if (p.search) where.OR = [
      { razonSocial: { contains: p.search, mode: 'insensitive' } },
      { nit: { contains: p.search } },
      { codigo: { contains: p.search, mode: 'insensitive' } },
    ];
    const [total, data] = await Promise.all([
      this.prisma.proveedor.count({ where }),
      this.prisma.proveedor.findMany({ where, skip: (p.page - 1) * p.pageSize, take: p.pageSize, orderBy: { razonSocial: 'asc' } }),
    ]);
    return { data, pagination: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.ceil(total / p.pageSize) } };
  }
  async getById(id: string, tenantId: number) {
    const v = await this.prisma.proveedor.findUnique({ where: { id } });
    if (!v || v.deletedAt || v.tenantId !== tenantId) throw new NotFoundException();
    return v;
  }
  create(input: CreateProveedorInput, tenantId: number) {
    return this.prisma.proveedor.create({ data: { ...input, tenantId } });
  }
  async update(id: string, input: UpdateProveedorInput, tenantId: number) {
    await this.getById(id, tenantId);
    return this.prisma.proveedor.update({ where: { id }, data: input });
  }
  async softDelete(id: string, tenantId: number) {
    await this.getById(id, tenantId);
    await this.prisma.proveedor.update({ where: { id }, data: { deletedAt: new Date(), activo: false } });
    return { ok: true };
  }
}

@ApiTags('proveedores')
@ApiBearerAuth()
@Controller('proveedores')
class ProveedoresController {
  constructor(private svc: ProveedoresService) {}

  @Get() list(@Query(new ZodValidationPipe(paginationQuerySchema)) q: PaginationQuery, @CurrentUser() user: AuthUser) { return this.svc.list(q, user.tenantId); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.svc.getById(id, user.tenantId); }

  @Post() @RequireRoles('admin', 'compras')
  create(@Body(new ZodValidationPipe(createProveedorSchema)) body: CreateProveedorInput, @CurrentUser() user: AuthUser) { return this.svc.create(body, user.tenantId); }

  @Patch(':id') @RequireRoles('admin', 'compras')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateProveedorSchema)) body: UpdateProveedorInput, @CurrentUser() user: AuthUser) {
    return this.svc.update(id, body, user.tenantId);
  }

  @Delete(':id') @RequireRoles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.svc.softDelete(id, user.tenantId); }
}

@Module({
  providers: [ProveedoresService],
  controllers: [ProveedoresController],
  exports: [ProveedoresService],
})
export class ProveedoresModule {}
