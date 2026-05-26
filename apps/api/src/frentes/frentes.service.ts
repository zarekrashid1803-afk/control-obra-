import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFrenteInput, UpdateFrenteInput } from '@control-obra/shared';

@Injectable()
export class FrentesService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const data = await this.prisma.frenteObra.findMany({
      where: { deletedAt: null },
      orderBy: { codigo: 'asc' },
      include: { responsable: { select: { id: true, nombres: true, apellidos: true, iniciales: true } } },
    });
    return data.map((f) => ({
      ...f,
      pctConsumido:
        Number(f.presupuestoTotalCentavos) > 0
          ? Number((Number(f.consumidoCentavos) / Number(f.presupuestoTotalCentavos)) * 100).toFixed(1)
          : '0.0',
    }));
  }

  async getById(id: string) {
    const f = await this.prisma.frenteObra.findUnique({
      where: { id },
      include: { responsable: true },
    });
    if (!f || f.deletedAt) throw new NotFoundException();
    return f;
  }

  async getByCodigo(codigo: string) {
    return this.prisma.frenteObra.findUnique({ where: { codigo } });
  }

  async create(input: CreateFrenteInput) {
    return this.prisma.frenteObra.create({ data: input });
  }

  async update(id: string, input: UpdateFrenteInput) {
    await this.getById(id);
    return this.prisma.frenteObra.update({ where: { id }, data: input });
  }

  async softDelete(id: string) {
    await this.prisma.frenteObra.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  /** Recalcula el consumido sumando OC + caja menor. Llamado por triggers de servicio. */
  async recalcularConsumido(frenteId: string) {
    const [ocSum, movSum] = await Promise.all([
      this.prisma.ordenCompra.aggregate({
        where: { frenteId, estado: { not: 'anulada' } },
        _sum: { totalCentavos: true },
      }),
      this.prisma.movimientoCaja.aggregate({
        where: { frenteId, tipo: 'salida' },
        _sum: { montoCentavos: true },
      }),
    ]);
    const consumido = (ocSum._sum.totalCentavos || 0n) + (movSum._sum.montoCentavos || 0n);
    await this.prisma.frenteObra.update({
      where: { id: frenteId },
      data: { consumidoCentavos: consumido },
    });
    return consumido;
  }
}
