import {
  Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  crearEntradaBodegaSchema, crearSalidaBodegaSchema,
  CrearEntradaBodegaInput, CrearSalidaBodegaInput,
  paginationQuerySchema, PaginationQuery,
} from '@control-obra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Injectable()
class BodegaService {
  constructor(private prisma: PrismaService) {}

  async listEntradas(p: { page: number; pageSize: number }, tenantId: number) {
    // BodegaEntrada no tiene tenantId; filtramos a través de la OC
    const where = { ordenCompra: { tenantId } };
    const [total, data] = await Promise.all([
      this.prisma.bodegaEntrada.count({ where }),
      this.prisma.bodegaEntrada.findMany({
        where,
        skip: (p.page - 1) * p.pageSize, take: p.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { ordenCompra: { include: { proveedor: { select: { razonSocial: true } } } }, items: true },
      }),
    ]);
    return { data, pagination: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.ceil(total / p.pageSize) } };
  }

  async crearEntrada(input: CrearEntradaBodegaInput, user: AuthUser) {
    // Validar que la OC pertenezca al tenant
    const oc = await this.prisma.ordenCompra.findUnique({ where: { id: input.ordenCompraId }, select: { tenantId: true } });
    if (!oc || oc.tenantId !== user.tenantId) throw new NotFoundException('Orden de compra no encontrada');
    const codigo = await this.codigo('BE');
    return this.prisma.$transaction(async (tx) => {
      // Map de cantidades esperadas según OC
      const ocItems = await tx.ordenCompraItem.findMany({
        where: { ordenCompraId: input.ordenCompraId },
      });
      const esperadasById = new Map(ocItems.map((i) => [i.id, i.cantidad]));

      const entrada = await tx.bodegaEntrada.create({
        data: {
          codigo,
          ordenCompraId: input.ordenCompraId,
          recibidoPorId: user.id,
          firmaUrl: input.firmaUrl,
          notas: input.notas,
          items: {
            create: input.items.map((it) => ({
              ocItemId: it.ocItemId,
              cantidadEsperada: esperadasById.get(it.ocItemId) || 0,
              cantidadRecibida: it.cantidadRecibida,
              estadoItem: it.estadoItem,
              observaciones: it.observaciones,
            })),
          },
        },
        include: { items: true },
      });

      // Recepción ACUMULADA: sumar lo recibido en TODAS las entradas de esta OC
      // (incluida la recién creada), por ítem. Antes solo miraba los ítems que
      // venían en este payload, así que una entrada parcial que omitía ítems
      // marcaba la OC como "recibida_total" perdiendo lo que faltaba.
      const todasLasEntradas = await tx.bodegaEntrada.findMany({
        where: { ordenCompraId: input.ordenCompraId },
        include: { items: true },
      });
      const recibidoAcum = new Map<string, number>();
      for (const e of todasLasEntradas) {
        for (const it of e.items) {
          recibidoAcum.set(it.ocItemId, (recibidoAcum.get(it.ocItemId) || 0) + Number(it.cantidadRecibida));
        }
      }
      const todosCompletos = ocItems.every(
        (oc) => (recibidoAcum.get(oc.id) || 0) >= Number(oc.cantidad),
      );
      await tx.ordenCompra.update({
        where: { id: input.ordenCompraId },
        data: {
          estado: todosCompletos ? 'recibida_total' : 'recibida_parcial',
          fechaEntregaReal: todosCompletos ? new Date() : undefined,
        },
      });

      return entrada;
    });
  }

  async crearSalida(input: CrearSalidaBodegaInput, user: AuthUser) {
    // Validar que el frente pertenezca al tenant
    const frente = await this.prisma.frenteObra.findUnique({ where: { id: input.frenteId }, select: { tenantId: true } });
    if (!frente || frente.tenantId !== user.tenantId) throw new NotFoundException('Frente no encontrado');
    const codigo = await this.codigo('BS');
    return this.prisma.$transaction(async (tx) => {
      const salida = await tx.bodegaSalida.create({
        data: {
          codigo,
          frenteId: input.frenteId,
          despachadoPorId: user.id,
          requisicionRef: input.requisicionId,
          notas: input.notas,
          items: {
            create: input.items.map((it) => ({ materialId: it.materialId, cantidad: it.cantidad })),
          },
        },
        include: { items: true },
      });

      // Actualizar inventario por frente
      for (const it of input.items) {
        await tx.inventarioFrente.upsert({
          where: { frenteId_materialId: { frenteId: input.frenteId, materialId: it.materialId } },
          create: { frenteId: input.frenteId, materialId: it.materialId, cantidad: it.cantidad },
          update: { cantidad: { increment: it.cantidad } },
        });
      }

      // Si está asociada a una requisición, marcarla como recibida
      if (input.requisicionId) {
        const r = await tx.requisicion.findUnique({ where: { id: input.requisicionId } });
        if (r && r.estado === 'compras') {
          await tx.requisicion.update({ where: { id: r.id }, data: { estado: 'recibida', fechaCierre: new Date() } });
          await tx.requisicionEstadoHistorial.create({
            data: {
              requisicionId: r.id, estadoAnterior: 'compras', estadoNuevo: 'recibida',
              actorId: user.id, observacion: `Despachada a frente via salida ${codigo}`,
            },
          });
        }
      }

      return salida;
    });
  }

  private async codigo(prefix: 'BE' | 'BS') {
    const year = new Date().getFullYear();
    const pref = `${prefix}-${year}-`;
    const model: any = prefix === 'BE' ? this.prisma.bodegaEntrada : this.prisma.bodegaSalida;
    const last = await model.findFirst({ where: { codigo: { startsWith: pref } }, orderBy: { codigo: 'desc' } });
    const num = last ? parseInt(last.codigo.split('-')[2], 10) : 0;
    return `${pref}${(num + 1).toString().padStart(4, '0')}`;
  }
}

@ApiTags('bodega')
@ApiBearerAuth()
@Controller('bodega')
class BodegaController {
  constructor(private svc: BodegaService) {}

  @Get('entradas')
  listEntradas(@Query(new ZodValidationPipe(paginationQuerySchema)) p: PaginationQuery, @CurrentUser() user: AuthUser) {
    return this.svc.listEntradas(p, user.tenantId);
  }

  @Post('entradas')
  @RequireRoles('bodega', 'admin')
  crearEntrada(
    @Body(new ZodValidationPipe(crearEntradaBodegaSchema)) body: CrearEntradaBodegaInput,
    @CurrentUser() user: AuthUser,
  ) { return this.svc.crearEntrada(body, user); }

  @Post('salidas')
  @RequireRoles('bodega', 'admin')
  crearSalida(
    @Body(new ZodValidationPipe(crearSalidaBodegaSchema)) body: CrearSalidaBodegaInput,
    @CurrentUser() user: AuthUser,
  ) { return this.svc.crearSalida(body, user); }
}

@Module({ providers: [BodegaService], controllers: [BodegaController] })
export class BodegaModule {}
