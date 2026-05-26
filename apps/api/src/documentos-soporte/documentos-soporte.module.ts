import {
  Body, Controller, Get, Injectable, Module, NotFoundException, ConflictException,
  Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  createDocumentoSoporteSchema, updateDocumentoSoporteSchema, docSoporteFilterSchema,
  CreateDocumentoSoporteInput, UpdateDocumentoSoporteInput, DocSoporteFilter,
  paginationQuerySchema, PaginationQuery,
} from '@control-obra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Injectable()
class DocumentosSoporteService {
  constructor(private prisma: PrismaService) {}

  async list(filter: DocSoporteFilter, pag: { page: number; pageSize: number; search?: string }) {
    const where: any = { deletedAt: null };
    if (filter.estado) where.estado = filter.estado;
    if (filter.proveedorId) where.proveedorId = filter.proveedorId;
    if (filter.frenteId) where.frenteId = filter.frenteId;
    if (filter.desde || filter.hasta) {
      where.fechaDocumento = {};
      if (filter.desde) where.fechaDocumento.gte = filter.desde;
      if (filter.hasta) where.fechaDocumento.lte = filter.hasta;
    }
    if (pag.search) {
      where.OR = [
        { codigo: { contains: pag.search, mode: 'insensitive' } },
        { numeroDocumento: { contains: pag.search } },
        { nombreProveedor: { contains: pag.search, mode: 'insensitive' } },
        { servicioPrestado: { contains: pag.search, mode: 'insensitive' } },
      ];
    }
    const [total, data] = await Promise.all([
      this.prisma.documentoSoporte.count({ where }),
      this.prisma.documentoSoporte.findMany({
        where,
        skip: (pag.page - 1) * pag.pageSize, take: pag.pageSize,
        orderBy: { fechaDocumento: 'desc' },
        include: {
          proveedor: { select: { id: true, razonSocial: true, nit: true } },
          frente: { select: { id: true, codigo: true, nombre: true } },
          creadoPor: { select: { id: true, iniciales: true, nombres: true, apellidos: true } },
        },
      }),
    ]);
    return { data, pagination: { page: pag.page, pageSize: pag.pageSize, total, totalPages: Math.ceil(total / pag.pageSize) } };
  }

  async getById(id: string) {
    const d = await this.prisma.documentoSoporte.findUnique({
      where: { id },
      include: {
        proveedor: true,
        frente: true,
        creadoPor: { select: { id: true, nombres: true, apellidos: true, iniciales: true } },
      },
    });
    if (!d || d.deletedAt) throw new NotFoundException('Documento soporte no encontrado');
    // Si tiene adjunto, traerlo aparte
    let identificacionAdjunto: any = null;
    if (d.identificacionAdjuntoId) {
      identificacionAdjunto = await this.prisma.adjunto.findUnique({ where: { id: d.identificacionAdjuntoId } });
    }
    return { ...d, identificacionAdjunto };
  }

  async create(input: CreateDocumentoSoporteInput, user: AuthUser) {
    // Si trae proveedorId, snapshot de sus datos
    let snapshot = {
      tipoDocumento: input.tipoDocumento,
      numeroDocumento: input.numeroDocumento,
      nombreProveedor: input.nombreProveedor,
      direccion: input.direccion,
      ciudad: input.ciudad,
      telefono: input.telefono,
      email: input.email || null,
    };
    if (input.proveedorId && !input.esAdHoc) {
      const p = await this.prisma.proveedor.findUnique({ where: { id: input.proveedorId } });
      if (p) {
        snapshot = {
          tipoDocumento: input.tipoDocumento || (p.tipoPersona === 'natural' ? 'CC' : 'NIT'),
          numeroDocumento: p.nit,
          nombreProveedor: p.razonSocial,
          direccion: p.direccion || input.direccion,
          ciudad: p.ciudad || input.ciudad,
          telefono: p.telefono || input.telefono,
          email: p.email || input.email || null,
        };
      }
    }

    const subtotal = BigInt(input.subtotalCentavos as any);
    const iva = BigInt((input.ivaCentavos || 0n) as any);
    const rfu = BigInt((input.retencionFuenteCentavos || 0n) as any);
    const riv = BigInt((input.retencionIvaCentavos || 0n) as any);
    const ric = BigInt((input.retencionIcaCentavos || 0n) as any);
    const total = subtotal + iva - rfu - riv - ric;

    const codigo = await this.generarCodigo();

    return this.prisma.documentoSoporte.create({
      data: {
        codigo,
        proveedorId: input.proveedorId || null,
        esAdHoc: input.esAdHoc,
        ...snapshot,
        email: snapshot.email || undefined,
        servicioPrestado: input.servicioPrestado,
        frenteId: input.frenteId || null,
        fechaDocumento: input.fechaDocumento,
        formaPago: input.formaPago,
        subtotalCentavos: subtotal,
        ivaCentavos: iva,
        retencionFuenteCentavos: rfu,
        retencionIvaCentavos: riv,
        retencionIcaCentavos: ric,
        totalCentavos: total,
        identificacionAdjuntoId: input.identificacionAdjuntoId || null,
        creadoPorId: user.id,
        estado: 'borrador',
      },
      include: { proveedor: true, frente: true },
    });
  }

  async update(id: string, input: UpdateDocumentoSoporteInput) {
    const exists = await this.prisma.documentoSoporte.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException();
    if (exists.estado !== 'borrador') {
      throw new ConflictException(`No se puede modificar un documento en estado ${exists.estado}`);
    }
    return this.prisma.documentoSoporte.update({ where: { id }, data: input as any });
  }

  async emitir(id: string) {
    const exists = await this.prisma.documentoSoporte.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException();
    if (exists.estado !== 'borrador') throw new ConflictException(`Solo se emiten borradores. Estado actual: ${exists.estado}`);
    // Generar CUDS placeholder (en producción → integración DIAN)
    const cuds = `CUDS-${Date.now().toString(36).toUpperCase()}`;
    return this.prisma.documentoSoporte.update({
      where: { id },
      data: { estado: 'emitido', emitidoAt: new Date(), cuds },
    });
  }

  async anular(id: string, motivo: string) {
    const exists = await this.prisma.documentoSoporte.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException();
    if (exists.estado === 'anulado') throw new ConflictException('Ya está anulado');
    return this.prisma.documentoSoporte.update({
      where: { id },
      data: { estado: 'anulado', anuladoAt: new Date(), motivoAnulacion: motivo },
    });
  }

  private async generarCodigo() {
    const year = new Date().getFullYear();
    const prefix = `DS-${year}-`;
    const last = await this.prisma.documentoSoporte.findFirst({
      where: { codigo: { startsWith: prefix } },
      orderBy: { codigo: 'desc' },
    });
    const lastNum = last ? parseInt(last.codigo.split('-')[2], 10) : 0;
    return `${prefix}${(lastNum + 1).toString().padStart(4, '0')}`;
  }
}

@ApiTags('documentos-soporte')
@ApiBearerAuth()
@Controller('documentos-soporte')
class DocumentosSoporteController {
  constructor(private svc: DocumentosSoporteService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(docSoporteFilterSchema)) filter: DocSoporteFilter,
    @Query(new ZodValidationPipe(paginationQuerySchema)) pag: PaginationQuery,
  ) {
    return this.svc.list(filter, pag);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.svc.getById(id); }

  @Post()
  @RequireRoles('admin', 'compras', 'caja', 'director')
  @ApiOperation({ summary: 'Crear documento soporte (DSNE)' })
  create(
    @Body(new ZodValidationPipe(createDocumentoSoporteSchema)) body: CreateDocumentoSoporteInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.create(body, user);
  }

  @Patch(':id')
  @RequireRoles('admin', 'compras', 'caja', 'director')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateDocumentoSoporteSchema)) body: UpdateDocumentoSoporteInput,
  ) {
    return this.svc.update(id, body);
  }

  @Post(':id/emitir')
  @RequireRoles('admin', 'compras', 'caja', 'director')
  emitir(@Param('id', ParseUUIDPipe) id: string) { return this.svc.emitir(id); }

  @Post(':id/anular')
  @RequireRoles('admin', 'director')
  anular(@Param('id', ParseUUIDPipe) id: string, @Body('motivo') motivo: string) {
    return this.svc.anular(id, motivo || 'Sin motivo registrado');
  }
}

@Module({
  providers: [DocumentosSoporteService],
  controllers: [DocumentosSoporteController],
  exports: [DocumentosSoporteService],
})
export class DocumentosSoporteModule {}
