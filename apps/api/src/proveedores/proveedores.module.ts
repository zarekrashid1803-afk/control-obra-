import { Module } from '@nestjs/common';
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Injectable, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  createProveedorSchema, updateProveedorSchema, paginationQuerySchema,
  CreateProveedorInput, UpdateProveedorInput, PaginationQuery,
} from '@control-obra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Injectable()
export class ProveedoresService {
  constructor(private prisma: PrismaService) {}
  async list(p: { page: number; pageSize: number; search?: string }) {
    const where: any = { deletedAt: null };
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
  async getById(id: string) {
    const v = await this.prisma.proveedor.findUnique({ where: { id } });
    if (!v || v.deletedAt) throw new NotFoundException();
    return v;
  }
  create(input: CreateProveedorInput) { return this.prisma.proveedor.create({ data: input }); }
  async update(id: string, input: UpdateProveedorInput) {
    await this.getById(id);
    return this.prisma.proveedor.update({ where: { id }, data: input });
  }
  async softDelete(id: string) {
    await this.prisma.proveedor.update({ where: { id }, data: { deletedAt: new Date(), activo: false } });
    return { ok: true };
  }
}

@ApiTags('proveedores')
@ApiBearerAuth()
@Controller('proveedores')
class ProveedoresController {
  constructor(private svc: ProveedoresService) {}

  @Get() list(@Query(new ZodValidationPipe(paginationQuerySchema)) q: PaginationQuery) { return this.svc.list(q); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.svc.getById(id); }

  @Post() @RequireRoles('admin', 'compras')
  create(@Body(new ZodValidationPipe(createProveedorSchema)) body: CreateProveedorInput) { return this.svc.create(body); }

  @Patch(':id') @RequireRoles('admin', 'compras')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateProveedorSchema)) body: UpdateProveedorInput) {
    return this.svc.update(id, body);
  }

  @Delete(':id') @RequireRoles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.softDelete(id); }
}

@Module({
  providers: [ProveedoresService],
  controllers: [ProveedoresController],
  exports: [ProveedoresService],
})
export class ProveedoresModule {}
