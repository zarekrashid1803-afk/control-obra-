import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import type { GenerarOCInput } from '@control-obra/shared';
import { RequisicionesService } from '../requisiciones/requisiciones.service';
import { EmailService } from '../notifications/notifications.module';
import { generarOCPdf } from './oc-pdf';

const IVA = 0.19;

@Injectable()
export class OrdenesCompraService {
  constructor(
    private prisma: PrismaService,
    private requisiciones: RequisicionesService,
    private email: EmailService,
  ) {}

  async generarPdf(id: string, tenantId: number): Promise<{ buffer: Buffer; filename: string }> {
    const oc = await this.getById(id, tenantId);
    const buffer = await generarOCPdf(oc);
    return { buffer, filename: `${oc.codigo || 'OC'}.pdf` };
  }

  async enviarConEmail(id: string, tenantId: number) {
    const oc = await this.getById(id, tenantId);
    if (oc.estado !== 'borrador') {
      throw new ConflictException(`Solo se puede enviar una OC en estado borrador. Actual: ${oc.estado}`);
    }
    if (!oc.proveedor?.email) {
      throw new BadRequestException(
        `El proveedor ${oc.proveedor?.razonSocial} no tiene email registrado. Agrégalo en /admin/proveedores antes de enviar.`,
      );
    }

    // Generar PDF
    const buffer = await generarOCPdf(oc);
    const filename = `${oc.codigo}.pdf`;

    // Enviar email con PDF adjunto
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://control-obra-web.vercel.app';
    const totalFmt = new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(Number(oc.totalCentavos) / 100);

    await this.email.send({
      to: oc.proveedor.email,
      subject: `Orden de Compra ${oc.codigo}`,
      html: `
<div style="font-family:Inter,Arial,sans-serif;background:#f5f6f7;padding:24px;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <div style="background:#000;color:#fff;padding:20px 24px;">
      <div style="font-size:11px;letter-spacing:2px;opacity:0.7;">ORDEN DE COMPRA</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px;font-family:monospace;">${oc.codigo}</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px 0;">Estimados <strong>${oc.proveedor.razonSocial}</strong>,</p>
      <p style="margin:0 0 16px 0;">
        Adjunto a este correo encontrarán nuestra orden de compra <strong>${oc.codigo}</strong> por un valor total de <strong>${totalFmt}</strong>.
      </p>
      <p style="margin:0 0 16px 0;">Por favor confirmar recepción de esta orden a la mayor brevedad posible.</p>
      <p style="margin:24px 0 8px 0;color:#686B6C;font-size:13px;">Quedamos atentos.</p>
    </div>
    <div style="padding:16px 24px;background:#f5f6f7;font-size:11px;color:#686B6C;text-align:center;">
      Project by Orion · ${FRONTEND_URL}
    </div>
  </div>
</div>`,
      attachments: [{ filename, content: buffer }],
    });

    return this.prisma.ordenCompra.update({
      where: { id },
      data: { estado: 'enviada', enviadaAt: new Date() },
    });
  }

  async list(params: { page: number; pageSize: number; estado?: string }, tenantId: number) {
    const { page, pageSize, estado } = params;
    const where: any = { tenantId };
    if (estado) where.estado = estado;

    const [total, data] = await Promise.all([
      this.prisma.ordenCompra.count({ where }),
      this.prisma.ordenCompra.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          proveedor: { select: { id: true, razonSocial: true, nit: true } },
          frente: { select: { id: true, codigo: true, nombre: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);
    return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async getById(id: string, tenantId?: number) {
    const oc = await this.prisma.ordenCompra.findUnique({
      where: { id },
      include: {
        proveedor: true,
        frente: true,
        generadaPor: { select: { id: true, nombres: true, apellidos: true, iniciales: true } },
        items: { include: { material: true }, orderBy: { orden: 'asc' } },
        requisicion: { select: { id: true, codigo: true, descripcion: true } },
      },
    });
    if (!oc) throw new NotFoundException();
    if (tenantId !== undefined && oc.tenantId !== tenantId) throw new NotFoundException();
    return oc;
  }

  async generar(input: GenerarOCInput, user: AuthUser) {
    const req = await this.prisma.requisicion.findUnique({
      where: { id: input.requisicionId },
      select: { id: true, estado: true, frenteId: true, ordenCompraId: true, codigo: true, tenantId: true },
    });
    if (!req || req.tenantId !== user.tenantId) throw new NotFoundException('Requisición no encontrada');
    if (req.estado !== 'aprobada') {
      throw new ConflictException(
        `Solo se puede generar OC de requisiciones aprobadas. Estado actual: ${req.estado}`,
      );
    }
    if (req.ordenCompraId) {
      throw new ConflictException(`Esta requisición ya tiene una OC asociada.`);
    }

    const proveedor = await this.prisma.proveedor.findUnique({ where: { id: input.proveedorId } });
    if (!proveedor || proveedor.tenantId !== user.tenantId) throw new NotFoundException('Proveedor no encontrado');

    const itemsData = input.items.map((it, idx) => {
      const sinDesc = BigInt(Math.round(it.cantidad * Number(it.precioUnitarioCentavos)));
      const subtotal = (sinDesc * BigInt(100 - Math.round(it.descuentoPct * 100))) / 100n;
      return {
        orden: idx,
        materialId: it.materialId,
        descripcion: it.descripcion,
        unidad: it.unidad,
        cantidad: it.cantidad,
        precioUnitarioCentavos: it.precioUnitarioCentavos,
        descuentoPct: it.descuentoPct,
        subtotalCentavos: subtotal,
      };
    });

    const subtotal = itemsData.reduce((s, x) => s + x.subtotalCentavos, 0n);
    const iva = BigInt(Math.round(Number(subtotal) * IVA));

    // Retenciones según régimen del proveedor (simplificado para v1)
    const reteFuente = proveedor.regimenIva === 'responsable_iva'
      ? BigInt(Math.round(Number(subtotal) * 0.025))
      : 0n;
    const reteIva = proveedor.regimenIva === 'responsable_iva' && !proveedor.granContribuyente
      ? BigInt(Math.round(Number(iva) * 0.15))
      : 0n;
    const reteIca = BigInt(Math.round(Number(subtotal) * 0.00966));

    const total = subtotal + iva - reteFuente - reteIva - reteIca;
    const codigo = await this.generarCodigo(user.tenantId);

    return this.prisma.$transaction(async (tx) => {
      const oc = await tx.ordenCompra.create({
        data: {
          codigo,
          tenantId: user.tenantId,
          proveedorId: input.proveedorId,
          frenteId: req.frenteId,
          generadaPorId: user.id,
          estado: 'borrador',
          condicionesPago: input.condicionesPago,
          fechaEmision: new Date(),
          fechaEntregaPrometida: input.fechaEntregaPrometida,
          subtotalCentavos: subtotal,
          ivaCentavos: iva,
          retencionFuenteCentavos: reteFuente,
          retencionIvaCentavos: reteIva,
          retencionIcaCentavos: reteIca,
          totalCentavos: total,
          notas: input.notas,
          items: { create: itemsData },
        },
        include: { items: true },
      });

      // Vincular OC a la requisición y cambiar estado de la req a 'compras'
      await tx.requisicion.update({
        where: { id: req.id },
        data: { ordenCompraId: oc.id, estado: 'compras' },
      });

      await tx.requisicionEstadoHistorial.create({
        data: {
          requisicionId: req.id,
          estadoAnterior: 'aprobada',
          estadoNuevo: 'compras',
          actorId: user.id,
          observacion: `OC ${oc.codigo} generada`,
        },
      });

      return oc;
    });
  }

  async enviar(id: string, tenantId: number) {
    const oc = await this.getById(id, tenantId);
    if (oc.estado !== 'borrador') {
      throw new ConflictException(`Solo se puede enviar una OC en estado borrador. Actual: ${oc.estado}`);
    }
    return this.prisma.ordenCompra.update({
      where: { id },
      data: { estado: 'enviada', enviadaAt: new Date() },
    });
  }

  async anular(id: string, motivo: string, tenantId: number) {
    const oc = await this.getById(id, tenantId);
    if (['recibida_total', 'anulada'].includes(oc.estado)) {
      throw new ConflictException(`No se puede anular una OC en estado ${oc.estado}`);
    }
    return this.prisma.ordenCompra.update({
      where: { id },
      data: { estado: 'anulada', notas: `[ANULADA] ${motivo}\n\n${oc.notas || ''}` },
    });
  }

  private async generarCodigo(tenantId: number) {
    const year = new Date().getFullYear();
    const prefix = `OC-${year}-`;
    const last = await this.prisma.ordenCompra.findFirst({
      where: { codigo: { startsWith: prefix }, tenantId },
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    });
    const lastNum = last ? parseInt(last.codigo.split('-')[2], 10) : 0;
    return `${prefix}${(lastNum + 1).toString().padStart(4, '0')}`;
  }
}
