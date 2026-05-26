import {
  Body, ConflictException, Controller, Get, Injectable, Module,
  NotFoundException, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  createMovimientoCajaSchema, cerrarArqueoSchema,
  CreateMovimientoCajaInput, CerrarArqueoInput,
  paginationQuerySchema, PaginationQuery,
} from '@control-obra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Injectable()
class CajaService {
  constructor(private prisma: PrismaService) {}

  async listMovimientos(p: { page: number; pageSize: number }) {
    const [total, data] = await Promise.all([
      this.prisma.movimientoCaja.count(),
      this.prisma.movimientoCaja.findMany({
        skip: (p.page - 1) * p.pageSize, take: p.pageSize,
        orderBy: { fechaMovimiento: 'desc' },
        include: {
          frente: { select: { id: true, codigo: true, nombre: true } },
          proveedor: { select: { id: true, razonSocial: true } },
          autorizadoPor: { select: { id: true, iniciales: true } },
        },
      }),
    ]);
    return { data, pagination: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.ceil(total / p.pageSize) } };
  }

  async crearMovimiento(input: CreateMovimientoCajaInput, user: AuthUser) {
    if (input.idempotencyKey) {
      const dup = await this.prisma.movimientoCaja.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (dup) return dup;
    }
    const codigo = await this.generarCodigo();
    const mov = await this.prisma.movimientoCaja.create({
      data: {
        codigo,
        tipo: input.tipo,
        concepto: input.concepto,
        montoCentavos: input.montoCentavos,
        frenteId: input.frenteId,
        ordenCompraId: input.ordenCompraId,
        proveedorId: input.proveedorId,
        categoria: input.categoria,
        retencionFuenteCentavos: input.retencionFuenteCentavos || 0n,
        retencionIvaCentavos: input.retencionIvaCentavos || 0n,
        retencionIcaCentavos: input.retencionIcaCentavos || 0n,
        idempotencyKey: input.idempotencyKey,
        autorizadoPorId: user.id,
      },
    });
    // Actualizar consumido del frente si aplica
    if (input.frenteId && input.tipo === 'salida') {
      await this.prisma.frenteObra.update({
        where: { id: input.frenteId },
        data: { consumidoCentavos: { increment: input.montoCentavos } },
      });
    }
    return mov;
  }

  async cerrarArqueo(input: CerrarArqueoInput, user: AuthUser) {
    const fechaInicio = new Date(input.fecha);
    fechaInicio.setHours(0, 0, 0, 0);
    const fechaFin = new Date(fechaInicio);
    fechaFin.setHours(23, 59, 59, 999);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.arqueoCaja.findUnique({
        where: { tenantId_fecha: { tenantId: user.tenantId, fecha: fechaInicio } },
      });
      if (existing?.cerradoAt) throw new ConflictException('Ya existe arqueo cerrado para esa fecha');

      // Saldo del día anterior (esperado al inicio)
      const ayer = new Date(fechaInicio);
      ayer.setDate(ayer.getDate() - 1);
      const ayerArqueo = await tx.arqueoCaja.findFirst({
        where: { tenantId: user.tenantId, fecha: ayer },
      });
      const saldoInicial = ayerArqueo?.saldoRealCentavos ?? 0n;

      const movs = await tx.movimientoCaja.findMany({
        where: { fechaMovimiento: { gte: fechaInicio, lte: fechaFin } },
      });
      const sumDia = movs.reduce(
        (s, m) => (m.tipo === 'entrada' ? s + m.montoCentavos : s - m.montoCentavos),
        0n,
      );
      const saldoEsperado = saldoInicial + sumDia;
      const diferencia = input.saldoRealCentavos - saldoEsperado;

      if (diferencia !== 0n && !input.justificacionDiferencia) {
        throw new ConflictException(
          `Hay diferencia de ${diferencia} centavos. Debe justificarla.`,
        );
      }

      const arqueo = await tx.arqueoCaja.upsert({
        where: { tenantId_fecha: { tenantId: user.tenantId, fecha: fechaInicio } },
        create: {
          fecha: fechaInicio,
          responsableId: user.id,
          saldoInicialCentavos: saldoInicial,
          saldoEsperadoCentavos: saldoEsperado,
          saldoRealCentavos: input.saldoRealCentavos,
          diferenciaCentavos: diferencia,
          justificacionDiferencia: input.justificacionDiferencia,
          cerradoAt: new Date(),
        },
        update: {
          saldoInicialCentavos: saldoInicial,
          saldoEsperadoCentavos: saldoEsperado,
          saldoRealCentavos: input.saldoRealCentavos,
          diferenciaCentavos: diferencia,
          justificacionDiferencia: input.justificacionDiferencia,
          cerradoAt: new Date(),
        },
      });

      // Vincular movimientos al arqueo
      await tx.movimientoCaja.updateMany({
        where: { fechaMovimiento: { gte: fechaInicio, lte: fechaFin } },
        data: { arqueoId: arqueo.id },
      });

      return arqueo;
    });
  }

  async getArqueoDia(fecha: Date) {
    const inicio = new Date(fecha); inicio.setHours(0, 0, 0, 0);
    return this.prisma.arqueoCaja.findFirst({ where: { fecha: inicio } });
  }

  private async generarCodigo() {
    const year = new Date().getFullYear();
    const prefix = `CM-${year}-`;
    const last = await this.prisma.movimientoCaja.findFirst({
      where: { codigo: { startsWith: prefix } },
      orderBy: { codigo: 'desc' },
    });
    const lastNum = last ? parseInt(last.codigo.split('-')[2], 10) : 0;
    return `${prefix}${(lastNum + 1).toString().padStart(4, '0')}`;
  }
}

@ApiTags('caja')
@ApiBearerAuth()
@Controller('caja')
class CajaController {
  constructor(private svc: CajaService) {}

  @Get('movimientos')
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) p: PaginationQuery) {
    return this.svc.listMovimientos(p);
  }

  @Post('movimientos')
  @RequireRoles('caja', 'admin')
  crear(
    @Body(new ZodValidationPipe(createMovimientoCajaSchema)) body: CreateMovimientoCajaInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.crearMovimiento(body, user);
  }

  @Get('arqueo/:fecha')
  getArqueo(@Param('fecha') fecha: string) {
    return this.svc.getArqueoDia(new Date(fecha));
  }

  @Post('arqueo')
  @RequireRoles('caja')
  cerrarArqueo(
    @Body(new ZodValidationPipe(cerrarArqueoSchema)) body: CerrarArqueoInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.cerrarArqueo(body, user);
  }
}

@Module({
  providers: [CajaService],
  controllers: [CajaController],
  exports: [CajaService],
})
export class CajaModule {}
