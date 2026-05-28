import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFrenteInput, UpdateFrenteInput } from '@control-obra/shared';

@Injectable()
export class FrentesService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: number) {
    const data = await this.prisma.frenteObra.findMany({
      where: { deletedAt: null, tenantId },
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

  async getById(id: string, tenantId?: number) {
    const f = await this.prisma.frenteObra.findUnique({
      where: { id },
      include: { responsable: true },
    });
    if (!f || f.deletedAt) throw new NotFoundException();
    // Aislamiento por tenant: no permitir ver frentes de otro tenant
    if (tenantId !== undefined && f.tenantId !== tenantId) throw new NotFoundException();
    return f;
  }

  async getByCodigo(codigo: string, tenantId: number) {
    return this.prisma.frenteObra.findUnique({
      where: { tenantId_codigo: { tenantId, codigo } },
    });
  }

  async create(input: CreateFrenteInput, tenantId: number) {
    return this.prisma.frenteObra.create({ data: { ...input, tenantId } });
  }

  async update(id: string, input: UpdateFrenteInput, tenantId: number) {
    await this.getById(id, tenantId);
    return this.prisma.frenteObra.update({ where: { id }, data: input });
  }

  async softDelete(id: string, tenantId: number) {
    await this.getById(id, tenantId);
    await this.prisma.frenteObra.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  /** Recalcula el consumido sumando OC + caja menor. Llamado por triggers de servicio. */
  async recalcularConsumido(frenteId: string, tenantId: number) {
    // Verificar que el frente sea del tenant antes de tocar nada (evita que un
    // admin de otra empresa recalcule/sobreescriba un frente ajeno por UUID).
    await this.getById(frenteId, tenantId);
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
