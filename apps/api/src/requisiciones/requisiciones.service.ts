import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.module';
import { evaluarTransicion, AccionRequisicion } from './state-machine';
import type {
  CreateRequisicionInput,
  RequisicionFilter,
  TransicionInput,
} from '@control-obra/shared';

const IVA = 0.19;

@Injectable()
export class RequisicionesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async list(filter: RequisicionFilter, pagination: { page: number; pageSize: number; search?: string }, user: AuthUser) {
    const where: any = { deletedAt: null, tenantId: user.tenantId };
    if (filter.estado) where.estado = filter.estado;
    if (filter.frenteId) where.frenteId = filter.frenteId;
    if (filter.solicitanteId) where.solicitanteId = filter.solicitanteId;
    if (filter.prioridad) where.prioridad = filter.prioridad;
    if (filter.desde || filter.hasta) {
      where.fechaCreacion = {};
      if (filter.desde) where.fechaCreacion.gte = filter.desde;
      if (filter.hasta) where.fechaCreacion.lte = filter.hasta;
    }
    if (pagination.search) {
      where.OR = [
        { codigo: { contains: pagination.search, mode: 'insensitive' } },
        { descripcion: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    // Residente solo ve las propias y las del mismo frente
    if (user.roles.includes('residente') && !user.roles.some(r => ['director','compras','caja','bodega','admin','auditor'].includes(r))) {
      where.OR = [
        { solicitanteId: user.id },
        { frenteId: { in: user.frentesAsignados } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.requisicion.count({ where }),
      this.prisma.requisicion.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { fechaCreacion: 'desc' },
        include: {
          frente: { select: { id: true, codigo: true, nombre: true, colorHex: true } },
          solicitante: { select: { id: true, nombres: true, apellidos: true, iniciales: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

    return {
      data,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    };
  }

  async getById(id: string, tenantId?: number) {
    const r = await this.prisma.requisicion.findUnique({
      where: { id },
      include: {
        frente: true,
        solicitante: { select: { id: true, nombres: true, apellidos: true, iniciales: true } },
        avalador: { select: { id: true, nombres: true, apellidos: true, iniciales: true } },
        aprobador: { select: { id: true, nombres: true, apellidos: true, iniciales: true } },
        items: { include: { material: true }, orderBy: { orden: 'asc' } },
        historial: { include: { actor: { select: { id: true, iniciales: true, nombres: true, apellidos: true } } }, orderBy: { creadoAt: 'asc' } },
        observaciones: { include: { autor: { select: { id: true, iniciales: true } } }, orderBy: { creadoAt: 'desc' } },
        ordenCompra: true,
      },
    });
    if (!r || r.deletedAt) throw new NotFoundException();
    if (tenantId !== undefined && r.tenantId !== tenantId) throw new NotFoundException();
    return r;
  }

  async create(input: CreateRequisicionInput, user: AuthUser) {
    // Validar frente existe Y pertenece al tenant del usuario
    const frente = await this.prisma.frenteObra.findUnique({ where: { id: input.frenteId } });
    if (!frente || frente.deletedAt || frente.tenantId !== user.tenantId) throw new NotFoundException('Frente no encontrado');

    // Snapshot precios y calcular subtotales
    const itemsData = input.items.map((it, idx) => {
      const subtotal = BigInt(Math.round(it.cantidad * Number(it.precioUnitarioCentavos)));
      return {
        orden: idx,
        materialId: it.materialId || null,
        descripcionSnapshot: it.descripcion,
        unidadSnapshot: it.unidad,
        cantidad: it.cantidad,
        precioUnitarioCentavosSnapshot: it.precioUnitarioCentavos,
        subtotalCentavos: subtotal,
        notas: it.notas,
      };
    });
    const subtotal = itemsData.reduce((s, x) => s + x.subtotalCentavos, 0n);
    const iva = BigInt(Math.round(Number(subtotal) * IVA));
    const total = subtotal + iva;

    // Verificar presupuesto
    const sobre = frente.consumidoCentavos + total > frente.presupuestoTotalCentavos;

    // Generar código secuencial (por tenant)
    const codigo = await this.generarCodigo(user.tenantId);

    const req = await this.prisma.requisicion.create({
      data: {
        codigo,
        tenantId: user.tenantId,
        frenteId: input.frenteId,
        solicitanteId: user.id,
        descripcion: input.descripcion,
        prioridad: input.prioridad,
        subtotalCentavos: subtotal,
        ivaCentavos: iva,
        totalCentavos: total,
        sobrePresupuesto: sobre,
        items: { create: itemsData },
        historial: {
          create: {
            estadoAnterior: null,
            estadoNuevo: 'borrador',
            actorId: user.id,
            observacion: 'Requisición creada',
          },
        },
      },
      include: { items: true, historial: true },
    });
    return req;
  }

  async transicionar(id: string, input: TransicionInput, user: AuthUser) {
    const r = await this.prisma.requisicion.findUnique({
      where: { id },
      select: {
        id: true, estado: true, solicitanteId: true, frenteId: true,
        codigo: true, descripcion: true, totalCentavos: true, tenantId: true,
        solicitante: { select: { nombres: true, apellidos: true } },
        frente: { select: { nombre: true } },
      },
    });
    if (!r || r.tenantId !== user.tenantId) throw new NotFoundException();

    const { estadoNuevo } = evaluarTransicion(input.accion as AccionRequisicion, {
      estadoActual: r.estado as any,
      rolesUsuario: user.roles,
      usuarioId: user.id,
      solicitanteId: r.solicitanteId,
      frenteIdRequisicion: r.frenteId,
      frentesAsignadosUsuario: user.frentesAsignados,
    });

    // Validar motivoRechazo cuando rechaza
    if (estadoNuevo === 'rechazada' && !input.motivoRechazo) {
      throw new ConflictException('Debe indicar motivo de rechazo');
    }

    const updatedData: any = { estado: estadoNuevo };
    if (estadoNuevo === 'avalada') updatedData.avaladorId = user.id;
    if (estadoNuevo === 'aprobada') {
      updatedData.aprobadorId = user.id;
      updatedData.fechaAprobacion = new Date();
    }
    if (estadoNuevo === 'rechazada') {
      updatedData.motivoRechazo = input.motivoRechazo;
    }
    if (estadoNuevo === 'recibida') {
      updatedData.fechaCierre = new Date();
    }

    // Transacción atómica: actualizar estado + insertar historial + observación opcional
    const updated = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.requisicion.update({
        where: { id },
        data: updatedData,
      });
      await tx.requisicionEstadoHistorial.create({
        data: {
          requisicionId: id,
          estadoAnterior: r.estado,
          estadoNuevo,
          actorId: user.id,
          observacion: input.observacion || input.motivoRechazo,
        },
      });
      if (input.observacion) {
        await tx.requisicionObservacion.create({
          data: { requisicionId: id, autorId: user.id, texto: input.observacion },
        });
      }
      return upd;
    });

    // Notificaciones fire-and-forget — no bloquear la respuesta del endpoint.
    // void hace explícito que ignoramos la promesa.
    if (estadoNuevo === 'pendiente') {
      void this.notifications.notificarRequisicionPendiente({
        requisicionId: r.id,
        codigo: r.codigo,
        descripcion: r.descripcion,
        montoCentavos: r.totalCentavos,
        tenantId: r.tenantId,
        solicitanteNombre: `${r.solicitante.nombres} ${r.solicitante.apellidos}`,
        frenteNombre: r.frente?.nombre,
      });
    }
    if (estadoNuevo === 'aprobada' || estadoNuevo === 'rechazada') {
      void this.notifications.notificarRequisicionResuelta({
        requisicionId: r.id,
        codigo: r.codigo,
        estado: estadoNuevo,
        motivo: input.motivoRechazo,
        solicitanteId: r.solicitanteId,
      });
    }

    return updated;
  }

  /** Genera código RQ-YYYY-NNNN basado en el último del año en curso, por tenant */
  private async generarCodigo(tenantId: number): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `RQ-${year}-`;
    const last = await this.prisma.requisicion.findFirst({
      where: { codigo: { startsWith: prefix }, tenantId },
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    });
    const lastNum = last ? parseInt(last.codigo.split('-')[2], 10) : 0;
    const next = (lastNum + 1).toString().padStart(4, '0');
    return `${prefix}${next}`;
  }
}
