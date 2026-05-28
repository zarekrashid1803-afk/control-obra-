import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
class InventarioService {
  constructor(private prisma: PrismaService) {}

  /**
   * Existencias por material = suma de lo despachado a cada frente (inventarioFrente).
   * NOTA: hoy NO se descuenta consumo en obra ni se lleva stock de bodega central;
   * representa "material entregado a frentes", no un balance entradas−salidas.
   * Un modelo de stock central + consumo es una decisión de producto pendiente.
   */
  async existencias(filter: { frenteId?: string }, tenantId: number) {
    const materiales = await this.prisma.material.findMany({
      where: { deletedAt: null, activo: true, tenantId },
      orderBy: { sku: 'asc' },
    });

    // InventarioFrente no tiene tenantId; filtramos por frentes del tenant
    const inv = await this.prisma.inventarioFrente.findMany({
      where: {
        frente: { tenantId },
        ...(filter.frenteId ? { frenteId: filter.frenteId } : {}),
      },
      include: { frente: { select: { codigo: true, nombre: true } } },
    });

    const byMaterial: Record<string, any[]> = {};
    inv.forEach((i) => {
      if (!byMaterial[i.materialId]) byMaterial[i.materialId] = [];
      byMaterial[i.materialId].push(i);
    });

    return materiales.map((m) => {
      const porFrente = byMaterial[m.id] || [];
      const total = porFrente.reduce((s, x) => s + Number(x.cantidad), 0);
      const estado =
        total <= 0 ? 'agotado'
        : total < Number(m.stockMinimo) ? 'bajo'
        : 'ok';
      return {
        materialId: m.id,
        sku: m.sku,
        descripcion: m.descripcion,
        unidad: m.unidad,
        stockMinimo: m.stockMinimo,
        existenciasPorFrente: porFrente.map((x) => ({
          frenteCodigo: x.frente.codigo,
          frenteNombre: x.frente.nombre,
          cantidad: x.cantidad,
        })),
        total,
        estado,
        valorEstimadoCentavos: (BigInt(Math.round(total * 100)) * m.precioReferenciaCentavos) / 100n,
      };
    });
  }

  async alertas(tenantId: number) {
    const todo = await this.existencias({}, tenantId);
    return {
      bajos: todo.filter((x) => x.estado === 'bajo').length,
      agotados: todo.filter((x) => x.estado === 'agotado').length,
      criticos: todo.filter((x) => x.estado !== 'ok'),
    };
  }
}

@ApiTags('inventario')
@ApiBearerAuth()
@Controller('inventario')
class InventarioController {
  constructor(private svc: InventarioService) {}

  @Get('existencias')
  existencias(@CurrentUser() user: AuthUser, @Query('frenteId') frenteId?: string) {
    return this.svc.existencias({ frenteId }, user.tenantId);
  }

  @Get('alertas')
  alertas(@CurrentUser() user: AuthUser) { return this.svc.alertas(user.tenantId); }
}

@Module({ providers: [InventarioService], controllers: [InventarioController] })
export class InventarioModule {}
