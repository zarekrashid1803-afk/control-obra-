import { ConflictException } from '@nestjs/common';
import { CajaService } from './caja.module';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests de CajaService — la lógica de dinero del sistema.
 * Prisma se mockea por completo; verificamos la aritmética del arqueo
 * (saldo esperado = saldo inicial + entradas − salidas), la detección de
 * diferencias, la exigencia de justificación y la idempotencia de movimientos.
 */

const USER: AuthUser = {
  id: 'u-caja',
  tenantId: 7,
  roles: ['caja'],
} as AuthUser;

// Mock de Prisma. `$transaction(cb)` ejecuta el callback con el propio mock
// como `tx`, de modo que findMany/upsert/updateMany apunten a los mismos jest.fn().
function makePrisma() {
  const prisma: any = {
    movimientoCaja: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    arqueoCaja: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    frenteObra: {
      update: jest.fn(),
    },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return prisma;
}

describe('CajaService.crearMovimiento — idempotencia', () => {
  it('devuelve el movimiento existente sin crear otro cuando la idempotencyKey ya existe', async () => {
    const prisma = makePrisma();
    const existente = { id: 'mov-1', codigo: 'CM-2026-0001' };
    prisma.movimientoCaja.findUnique.mockResolvedValue(existente);

    const svc = new CajaService(prisma);
    const r = await svc.crearMovimiento(
      { tipo: 'entrada', concepto: 'x', montoCentavos: 1000n, idempotencyKey: 'key-abc' } as any,
      USER,
    );

    expect(r).toBe(existente);
    expect(prisma.movimientoCaja.create).not.toHaveBeenCalled();
  });

  it('crea un movimiento nuevo y genera código correlativo cuando no hay duplicado', async () => {
    const prisma = makePrisma();
    prisma.movimientoCaja.findUnique.mockResolvedValue(null);
    prisma.movimientoCaja.findFirst.mockResolvedValue(null); // no hay correlativo previo
    prisma.movimientoCaja.create.mockImplementation(({ data }: any) => ({ id: 'mov-new', ...data }));

    const svc = new CajaService(prisma);
    const r: any = await svc.crearMovimiento(
      { tipo: 'entrada', concepto: 'ingreso', montoCentavos: 1000n } as any,
      USER,
    );

    expect(prisma.movimientoCaja.create).toHaveBeenCalledTimes(1);
    const year = new Date().getFullYear();
    expect(r.codigo).toBe(`CM-${year}-0001`);
    expect(r.tenantId).toBe(7);
  });

  it('incrementa el consumido del frente cuando el movimiento es una salida con frente', async () => {
    const prisma = makePrisma();
    prisma.movimientoCaja.findUnique.mockResolvedValue(null);
    prisma.movimientoCaja.findFirst.mockResolvedValue(null);
    prisma.movimientoCaja.create.mockImplementation(({ data }: any) => ({ id: 'm', ...data }));

    const svc = new CajaService(prisma);
    await svc.crearMovimiento(
      { tipo: 'salida', concepto: 'pago', montoCentavos: 2500n, frenteId: 'f-1' } as any,
      USER,
    );

    expect(prisma.frenteObra.update).toHaveBeenCalledWith({
      where: { id: 'f-1' },
      data: { consumidoCentavos: { increment: 2500n } },
    });
  });

  it('NO toca el consumido del frente en una entrada', async () => {
    const prisma = makePrisma();
    prisma.movimientoCaja.findUnique.mockResolvedValue(null);
    prisma.movimientoCaja.findFirst.mockResolvedValue(null);
    prisma.movimientoCaja.create.mockImplementation(({ data }: any) => ({ id: 'm', ...data }));

    const svc = new CajaService(prisma);
    await svc.crearMovimiento(
      { tipo: 'entrada', concepto: 'ingreso', montoCentavos: 2500n, frenteId: 'f-1' } as any,
      USER,
    );

    expect(prisma.frenteObra.update).not.toHaveBeenCalled();
  });
});

describe('CajaService.cerrarArqueo — aritmética del saldo', () => {
  const INPUT_BASE = { fecha: '2026-05-27', saldoRealCentavos: 0n } as any;

  it('saldo esperado = entradas − salidas cuando no hay día anterior y cuadra exacto', async () => {
    const prisma = makePrisma();
    prisma.arqueoCaja.findUnique.mockResolvedValue(null); // no cerrado aún
    prisma.arqueoCaja.findFirst.mockResolvedValue(null); // sin arqueo de ayer
    prisma.movimientoCaja.findMany.mockResolvedValue([
      { tipo: 'entrada', montoCentavos: 5000n },
      { tipo: 'salida', montoCentavos: 2000n },
    ]);
    prisma.arqueoCaja.upsert.mockImplementation(({ create }: any) => ({ id: 'arq-1', ...create }));

    const svc = new CajaService(prisma);
    const r: any = await svc.cerrarArqueo({ ...INPUT_BASE, saldoRealCentavos: 3000n }, USER);

    expect(r.saldoEsperadoCentavos).toBe(3000n);
    expect(r.diferenciaCentavos).toBe(0n);
    expect(prisma.movimientoCaja.updateMany).toHaveBeenCalled();
  });

  it('arrastra el saldo real del día anterior como saldo inicial', async () => {
    const prisma = makePrisma();
    prisma.arqueoCaja.findUnique.mockResolvedValue(null);
    prisma.arqueoCaja.findFirst.mockResolvedValue({ saldoRealCentavos: 10000n }); // saldo de ayer
    prisma.movimientoCaja.findMany.mockResolvedValue([{ tipo: 'salida', montoCentavos: 4000n }]);
    prisma.arqueoCaja.upsert.mockImplementation(({ create }: any) => ({ id: 'arq', ...create }));

    const svc = new CajaService(prisma);
    const r: any = await svc.cerrarArqueo({ ...INPUT_BASE, saldoRealCentavos: 6000n }, USER);

    expect(r.saldoInicialCentavos).toBe(10000n);
    expect(r.saldoEsperadoCentavos).toBe(6000n); // 10000 - 4000
    expect(r.diferenciaCentavos).toBe(0n);
  });

  it('exige justificación cuando hay diferencia y la rechaza si falta', async () => {
    const prisma = makePrisma();
    prisma.arqueoCaja.findUnique.mockResolvedValue(null);
    prisma.arqueoCaja.findFirst.mockResolvedValue(null);
    prisma.movimientoCaja.findMany.mockResolvedValue([{ tipo: 'entrada', montoCentavos: 5000n }]);

    const svc = new CajaService(prisma);
    // saldoReal 4500 vs esperado 5000 → diferencia -500, sin justificación
    await expect(svc.cerrarArqueo({ ...INPUT_BASE, saldoRealCentavos: 4500n }, USER)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.arqueoCaja.upsert).not.toHaveBeenCalled();
  });

  it('acepta la diferencia cuando viene justificada', async () => {
    const prisma = makePrisma();
    prisma.arqueoCaja.findUnique.mockResolvedValue(null);
    prisma.arqueoCaja.findFirst.mockResolvedValue(null);
    prisma.movimientoCaja.findMany.mockResolvedValue([{ tipo: 'entrada', montoCentavos: 5000n }]);
    prisma.arqueoCaja.upsert.mockImplementation(({ create }: any) => ({ id: 'arq', ...create }));

    const svc = new CajaService(prisma);
    const r: any = await svc.cerrarArqueo(
      { fecha: '2026-05-27', saldoRealCentavos: 4500n, justificacionDiferencia: 'faltante en efectivo' } as any,
      USER,
    );

    expect(r.diferenciaCentavos).toBe(-500n);
    expect(r.justificacionDiferencia).toBe('faltante en efectivo');
  });

  it('rechaza cerrar un arqueo que ya está cerrado para esa fecha', async () => {
    const prisma = makePrisma();
    prisma.arqueoCaja.findUnique.mockResolvedValue({ cerradoAt: new Date() }); // ya cerrado

    const svc = new CajaService(prisma);
    await expect(svc.cerrarArqueo({ ...INPUT_BASE, saldoRealCentavos: 0n }, USER)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.arqueoCaja.upsert).not.toHaveBeenCalled();
  });
});
