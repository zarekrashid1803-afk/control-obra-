import { BodegaService } from './bodega.module';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests de la recepción de bodega. Lo crítico: el estado de la OC
 * (recibida_parcial vs recibida_total) debe basarse en la recepción ACUMULADA
 * de TODOS los ítems de la OC, no solo en los que vienen en un payload.
 */

const USER: AuthUser = { id: 'u-bodega', tenantId: 7, roles: ['bodega'] } as AuthUser;

// OC con 2 ítems: i1 (10) e i2 (5).
const OC_ITEMS = [
  { id: 'i1', cantidad: 10 },
  { id: 'i2', cantidad: 5 },
];

/**
 * Mock de Prisma. `entradasExistentes` simula lo ya recibido en entradas previas;
 * la entrada nueva creada en esta llamada se agrega a esa lista para el cálculo
 * acumulado (replicando lo que hace el servicio al releer todas las entradas).
 */
function makePrisma(entradasPrevias: any[]) {
  const creadas: any[] = [...entradasPrevias];
  const prisma: any = {
    ordenCompra: {
      findUnique: jest.fn().mockResolvedValue({ tenantId: 7 }),
      update: jest.fn(),
    },
    bodegaEntrada: {
      findFirst: jest.fn().mockResolvedValue(null), // para generar código
      create: jest.fn().mockImplementation(({ data }: any) => {
        const entrada = { id: `be-${creadas.length}`, items: data.items.create };
        creadas.push(entrada);
        return entrada;
      }),
      // Devuelve todas las entradas (previas + la recién creada).
      findMany: jest.fn().mockImplementation(() => creadas),
    },
    ordenCompraItem: {
      findMany: jest.fn().mockResolvedValue(OC_ITEMS),
    },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return prisma;
}

function entrada(items: { ocItemId: string; cantidadRecibida: number }[]) {
  return { ordenCompraId: 'oc-1', items: items.map((i) => ({ ...i, estadoItem: 'completo' })) };
}

describe('BodegaService.crearEntrada — estado de la OC', () => {
  it('marca recibida_parcial cuando un payload omite ítems de la OC', async () => {
    const prisma = makePrisma([]);
    const svc = new BodegaService(prisma);
    // Solo recibe i1 completo; i2 (5) no viene → NO debe marcarse total.
    await svc.crearEntrada(entrada([{ ocItemId: 'i1', cantidadRecibida: 10 }]) as any, USER);

    expect(prisma.ordenCompra.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'recibida_parcial' }) }),
    );
  });

  it('marca recibida_total cuando se recibe todo en una sola entrada', async () => {
    const prisma = makePrisma([]);
    const svc = new BodegaService(prisma);
    await svc.crearEntrada(
      entrada([
        { ocItemId: 'i1', cantidadRecibida: 10 },
        { ocItemId: 'i2', cantidadRecibida: 5 },
      ]) as any,
      USER,
    );

    expect(prisma.ordenCompra.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'recibida_total' }) }),
    );
  });

  it('marca recibida_total al COMPLETAR con una segunda entrada (acumulado)', async () => {
    // Entrada previa: i1 completo (10). Ahora llega i2 (5) → acumulado completo.
    const prisma = makePrisma([entrada([{ ocItemId: 'i1', cantidadRecibida: 10 }])]);
    const svc = new BodegaService(prisma);
    await svc.crearEntrada(entrada([{ ocItemId: 'i2', cantidadRecibida: 5 }]) as any, USER);

    expect(prisma.ordenCompra.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'recibida_total' }) }),
    );
  });
});
