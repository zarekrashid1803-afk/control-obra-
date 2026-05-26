import {
  Body, Controller, Get, Injectable, Module, Param, ParseUUIDPipe, Post, Query,
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

  async listEntradas(p: { page: number; pageSize: number }) {
    const [total, data] = await Promise.all([
      this.prisma.bodegaEntrada.count(),
      this.prisma.bodegaEntrada.findMany({
        skip: (p.page - 1) * p.pageSize, take: p.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { ordenCompra: { include: { proveedor: { select: { razonSocial: true } } } }, items: true },
      }),
    ]);
    return { data, pagination: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.ceil(total / p.pageSize) } };
  }

  async crearEntrada(input: CrearEntradaBodegaInput, user: AuthUser) {
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

      // Actualizar estado de OC
      const todosCompletos = input.items.every((it) => {
        const esp = Number(esperadasById.get(it.ocItemId) || 0);
        return Number(it.cantidadRecibida) >= esp;
      });
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
  listEntradas(@Query(new ZodValidationPipe(paginationQuerySchema)) p: PaginationQuery) {
    return this.svc.listEntradas(p);
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
