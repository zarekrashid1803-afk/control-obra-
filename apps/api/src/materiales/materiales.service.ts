import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMaterialInput, UpdateMaterialInput } from '@control-obra/shared';

@Injectable()
export class MaterialesService {
  constructor(private prisma: PrismaService) {}

  async list(params: { page: number; pageSize: number; search?: string }) {
    const { page, pageSize, search } = params;
    const where: any = { deletedAt: null };
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

  async getById(id: string) {
    const m = await this.prisma.material.findUnique({ where: { id } });
    if (!m || m.deletedAt) throw new NotFoundException();
    return m;
  }

  async create(input: CreateMaterialInput) {
    return this.prisma.material.create({ data: input });
  }

  async update(id: string, input: UpdateMaterialInput) {
    await this.getById(id);
    return this.prisma.material.update({ where: { id }, data: input });
  }

  async softDelete(id: string) {
    await this.prisma.material.update({ where: { id }, data: { deletedAt: new Date(), activo: false } });
    return { ok: true };
  }
}
