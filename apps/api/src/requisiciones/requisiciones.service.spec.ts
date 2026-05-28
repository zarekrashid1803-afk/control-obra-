import { ConflictException, NotFoundException } from '@nestjs/common';
import { RequisicionesService } from './requisiciones.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests de RequisicionesService.transicionar con Prisma mockeado. Cubre el
 * optimistic lock (WHERE estado = estadoLeído) que evita la doble aplicación
 * por requests concurrentes, además del check de tenant.
 */

const RESIDENTE: AuthUser = {
  id: 'u-residente',
  tenantId: 7,
  roles: ['residente'],
  frentesAsignados: ['f-1'],
} as AuthUser;

// Requisición base en estado borrador del mismo tenant/solicitante.
function reqBase(overrides: Record<string, any> = {}) {
  return {
    id: 'req-1',
    estado: 'borrador',
    solicitanteId: 'u-residente',
    frenteId: 'f-1',
    codigo: 'RQ-2026-0001',
    descripcion: 'Materiales',
    totalCentavos: 0n,
    tenantId: 7,
    solicitante: { nombres: 'Ana', apellidos: 'Pérez' },
    frente: { nombre: 'Frente 1' },
    ...overrides,
  };
}

function makePrisma(req: any, updateCount: number) {
  const prisma: any = {
    requisicion: {
      findUnique: jest.fn().mockResolvedValue(req),
      updateMany: jest.fn().mockResolvedValue({ count: updateCount }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...req, estado: 'pendiente' }),
    },
    requisicionEstadoHistorial: { create: jest.fn() },
    requisicionObservacion: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return prisma;
}

const notifications: any = {
  notificarRequisicionPendiente: jest.fn(),
  notificarRequisicionResuelta: jest.fn(),
};

describe('RequisicionesService.transicionar', () => {
  it('enviar: borrador → pendiente cuando el optimistic lock toma (count=1)', async () => {
    const prisma = makePrisma(reqBase(), 1);
    const svc = new RequisicionesService(prisma, notifications);

    const r: any = await svc.transicionar('req-1', { accion: 'enviar' } as any, RESIDENTE);

    expect(prisma.requisicion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'req-1', estado: 'borrador' } }),
    );
    expect(r.estado).toBe('pendiente');
  });

  it('rechaza con Conflict cuando otra operación ya cambió el estado (count=0)', async () => {
    const prisma = makePrisma(reqBase(), 0);
    const svc = new RequisicionesService(prisma, notifications);

    await expect(svc.transicionar('req-1', { accion: 'enviar' } as any, RESIDENTE)).rejects.toBeInstanceOf(
      ConflictException,
    );
    // No debe registrar historial si el lock no tomó.
    expect(prisma.requisicionEstadoHistorial.create).not.toHaveBeenCalled();
  });

  it('rechaza con NotFound si la requisición es de otro tenant', async () => {
    const prisma = makePrisma(reqBase({ tenantId: 999 }), 1);
    const svc = new RequisicionesService(prisma, notifications);

    await expect(svc.transicionar('req-1', { accion: 'enviar' } as any, RESIDENTE)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.requisicion.updateMany).not.toHaveBeenCalled();
  });
});
