import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMaterialInput, UpdateMaterialInput } from '@control-obra/shared';

@Injectable()
export class MaterialesService {
  constructor(private prisma: PrismaService) {}

  async list(params: { page: number; pageSize: number; search?: string }, tenantId: number) {
    const { page, pageSize, search } = params;
    const where: any = { deletedAt: null, tenantId };
    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, data] = await Promise.all([
      this.prisma.material.count({ where }),
      this.prisma.material.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize,
        orderBy: { sku: 'asc' },
      }),
    ]);
    return {
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getById(id: string, tenantId: number) {
    const m = await this.prisma.material.findUnique({ where: { id } });
    if (!m || m.deletedAt || m.tenantId !== tenantId) throw new NotFoundException();
    return m;
  }

  async create(input: CreateMaterialInput, tenantId: number) {
    return this.prisma.material.create({ data: { ...input, tenantId } });
  }

  async update(id: string, input: UpdateMaterialInput, tenantId: number) {
    await this.getById(id, tenantId);
    return this.prisma.material.update({ where: { id }, data: input });
  }

  async softDelete(id: string, tenantId: number) {
    await this.getById(id, tenantId);
    await this.prisma.material.update({ where: { id }, data: { deletedAt: new Date(), activo: false } });
    return { ok: true };
  }
}
