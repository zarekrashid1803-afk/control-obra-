/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding...');

  // ============================================================
  // Tenant + Roles
  // ============================================================
  await prisma.tenant.upsert({
    where: { id: 1 },
    create: { id: 1, nombre: 'Constructora Andina', nit: '900.123.456-7' },
    update: {},
  });

  const roles = [
    { id: 'director',  nombreDisplay: 'Director',   descripcion: 'Autorización estratégica y presupuestal' },
    { id: 'residente', nombreDisplay: 'Residente',  descripcion: 'Necesidad técnica en campo' },
    { id: 'compras',   nombreDisplay: 'Compras',    descripcion: 'Genera órdenes de compra' },
    { id: 'caja',      nombreDisplay: 'Caja',       descripcion: 'Tesorería, arqueo diario' },
    { id: 'bodega',    nombreDisplay: 'Bodega',     descripcion: 'Recepción y despacho de material' },
    { id: 'admin',     nombreDisplay: 'Admin',      descripcion: 'Configuración del sistema' },
    { id: 'auditor',   nombreDisplay: 'Auditor',    descripcion: 'Sólo lectura + auditoría' },
  ];
  for (const r of roles) {
    await prisma.rol.upsert({ where: { id: r.id }, create: { ...r, permisos: [] }, update: { permisos: [] } });
  }

  // ============================================================
  // Usuarios (los mismos del prototipo de Claude Design)
  // ============================================================
  const pwd = await argon2.hash('password123');

  const usuarios = [
    { id: 'jm', email: 'juan.mejia@andina.co',     nombres: 'Juan Carlos', apellidos: 'Mejía',     iniciales: 'JM', rol: 'director'  },
    { id: 'ap', email: 'andres.patino@andina.co',  nombres: 'Andrés',      apellidos: 'Patiño',    iniciales: 'AP', rol: 'residente' },
    { id: 'cr', email: 'camila.restrepo@andina.co',nombres: 'Camila',      apellidos: 'Restrepo',  iniciales: 'CR', rol: 'residente' },
    { id: 'lg', email: 'luis.gomez@andina.co',     nombres: 'Luis Fernando', apellidos: 'Gómez',   iniciales: 'LG', rol: 'residente' },
    { id: 'sv', email: 'sofia.vargas@andina.co',   nombres: 'Sofía',       apellidos: 'Vargas',    iniciales: 'SV', rol: 'compras'   },
    { id: 'ph', email: 'patricia.holguin@andina.co', nombres: 'Patricia',  apellidos: 'Holguín',   iniciales: 'PH', rol: 'caja'      },
    { id: 'rb', email: 'ricardo.bermudez@andina.co', nombres: 'Ricardo',   apellidos: 'Bermúdez',  iniciales: 'RB', rol: 'bodega'    },
    { id: 'admin', email: 'admin@andina.co',       nombres: 'Admin',       apellidos: 'Sistema',   iniciales: 'AS', rol: 'admin'     },
  ];

  const userIds: Record<string, string> = {};
  for (const u of usuarios) {
    const created = await prisma.usuario.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        nombres: u.nombres,
        apellidos: u.apellidos,
        iniciales: u.iniciales,
        passwordHash: pwd,
        passwordChangeRequired: false,
        activo: true,
        roles: { create: { rolId: u.rol } },
      },
      update: {},
      include: { roles: true },
    });
    userIds[u.id] = created.id;
  }

  // ============================================================
  // Frentes de obra
  // ============================================================
  const frentes = [
    { codigo: 'FR-001', nombre: 'Torre Aurora',     presupuesto: 850_000_000_00n, consumido: 527_000_000_00n, color: '#2f5d8a', responsableSlug: 'ap' },
    { codigo: 'FR-002', nombre: 'Centro Pacífico',  presupuesto: 1_200_000_000_00n, consumido: 492_000_000_00n, color: '#c9a64a', responsableSlug: 'cr' },
    { codigo: 'FR-003', nombre: 'Vía Mariposa',     presupuesto: 480_000_000_00n, consumido: 422_400_000_00n, color: '#dc2626', responsableSlug: 'lg' },
  ];
  const frenteIds: Record<string, string> = {};
  for (const f of frentes) {
    const created = await prisma.frenteObra.upsert({
      where: { codigo: f.codigo },
      create: {
        codigo: f.codigo,
        nombre: f.nombre,
        presupuestoTotalCentavos: f.presupuesto,
        consumidoCentavos: f.consumido,
        colorHex: f.color,
        responsableId: userIds[f.responsableSlug],
        estado: 'activo',
      },
      update: {},
    });
    frenteIds[f.codigo] = created.id;
  }

  // Asignar frentes a residentes
  await prisma.usuario.update({ where: { id: userIds.ap }, data: { frentesAsignados: [frenteIds['FR-001']] } });
  await prisma.usuario.update({ where: { id: userIds.cr }, data: { frentesAsignados: [frenteIds['FR-002'], frenteIds['FR-001']] } });
  await prisma.usuario.update({ where: { id: userIds.lg }, data: { frentesAsignados: [frenteIds['FR-003']] } });

  // ============================================================
  // Proveedores (reales del sector colombiano)
  // ============================================================
  const proveedores = [
    { codigo: 'P-001', nit: '900.123.456-1', razonSocial: 'Cemex Colombia S.A.',      rating: 4.7 },
    { codigo: 'P-002', nit: '890.300.123-2', razonSocial: 'Argos S.A.',                rating: 4.9 },
    { codigo: 'P-003', nit: '900.456.789-3', razonSocial: 'Aceros del Pacífico',      rating: 4.4 },
    { codigo: 'P-004', nit: '800.111.222-4', razonSocial: 'Ferretería Industrial Sur', rating: 4.2 },
    { codigo: 'P-005', nit: '900.222.333-5', razonSocial: 'Eléctricos Cali Ltda.',    rating: 4.5 },
    { codigo: 'P-006', nit: '890.901.123-6', razonSocial: 'Pinturas Pintuco',          rating: 4.8 },
    { codigo: 'P-007', nit: '890.105.290-7', razonSocial: 'Holcim Colombia',           rating: 4.6 },
  ];
  const provIds: Record<string, string> = {};
  for (const p of proveedores) {
    const created = await prisma.proveedor.upsert({
      where: { nit: p.nit },
      create: { ...p, ciudad: 'Cali', condicionesPago: 'credito_30' },
      update: {},
    });
    provIds[p.codigo] = created.id;
  }

  // ============================================================
  // Materiales
  // ============================================================
  const materiales = [
    { sku: 'MAT-0001', descripcion: 'Cemento gris 50 kg',                 unidad: 'und',   precio: 32500_00n, min: 200, categoria: 'cemento' },
    { sku: 'MAT-0002', descripcion: 'Varilla corrugada 1/2" x 6m',         unidad: 'und',   precio: 48900_00n, min: 150, categoria: 'acero' },
    { sku: 'MAT-0003', descripcion: 'Bloque #5 hueco',                     unidad: 'und',   precio: 2350_00n,  min: 1000, categoria: 'mamposteria' },
    { sku: 'MAT-0004', descripcion: 'Cable encauchetado 12 AWG x 100m',    unidad: 'rollo', precio: 425000_00n, min: 4, categoria: 'electrico' },
    { sku: 'MAT-0005', descripcion: 'Pintura vinilo blanco interior',      unidad: 'galon', precio: 89500_00n, min: 12, categoria: 'pintura' },
    { sku: 'MAT-0006', descripcion: 'Tubería PVC 2" presión',              unidad: 'und',   precio: 18900_00n, min: 40, categoria: 'hidraulico' },
    { sku: 'MAT-0007', descripcion: 'Arena de río',                        unidad: 'm3',    precio: 78000_00n, min: 20, categoria: 'agregados' },
    { sku: 'MAT-0008', descripcion: 'Triturado 3/4"',                      unidad: 'm3',    precio: 95000_00n, min: 25, categoria: 'agregados' },
    { sku: 'MAT-0009', descripcion: 'EPP — casco con barboquejo',          unidad: 'und',   precio: 28500_00n, min: 30, categoria: 'epp' },
    { sku: 'MAT-0010', descripcion: 'Soldadura E6013 1/8"',                unidad: 'kg',    precio: 16900_00n, min: 30, categoria: 'soldadura' },
  ];
  const matIds: Record<string, string> = {};
  for (const m of materiales) {
    const created = await prisma.material.upsert({
      where: { sku: m.sku },
      create: {
        sku: m.sku,
        descripcion: m.descripcion,
        unidad: m.unidad,
        precioReferenciaCentavos: m.precio,
        stockMinimo: m.min,
        categoria: m.categoria,
      },
      update: {},
    });
    matIds[m.sku] = created.id;
  }

  // ============================================================
  // Requisiciones (las del prototipo)
  // ============================================================
  const reqsExisten = await prisma.requisicion.count();
  if (reqsExisten === 0) {
    const hoy = new Date();
    const hace = (h: number) => new Date(hoy.getTime() - h * 3600_000);
    const IVA = 0.19;

    const reqs = [
      {
        codigo: 'RQ-2026-0142', frente: 'FR-001', solicitante: 'ap', estado: 'avalada',
        descripcion: 'Refuerzo estructural placa 5 — cemento y varilla',
        prioridad: 'urgente', creada: hace(3),
        items: [
          { mat: 'MAT-0001', cant: 120 },
          { mat: 'MAT-0002', cant: 80 },
          { mat: 'MAT-0007', cant: 8 },
        ],
      },
      {
        codigo: 'RQ-2026-0141', frente: 'FR-002', solicitante: 'cr', estado: 'pendiente',
        descripcion: 'Eléctricos torre B — primer piso',
        prioridad: 'normal', creada: hace(6),
        items: [{ mat: 'MAT-0004', cant: 4 }],
      },
      {
        codigo: 'RQ-2026-0140', frente: 'FR-001', solicitante: 'ap', estado: 'aprobada',
        descripcion: 'Mampostería piso 3 — bloques #5',
        prioridad: 'normal', creada: hace(24),
        items: [{ mat: 'MAT-0003', cant: 4500 }],
      },
      {
        codigo: 'RQ-2026-0139', frente: 'FR-003', solicitante: 'lg', estado: 'avalada',
        descripcion: 'Pintura fachada — vinilo blanco',
        prioridad: 'normal', creada: hace(28), sobre: true,
        items: [{ mat: 'MAT-0005', cant: 60 }],
      },
      {
        codigo: 'RQ-2026-0138', frente: 'FR-002', solicitante: 'cr', estado: 'compras',
        descripcion: 'Tubería PVC sanitaria torre B',
        prioridad: 'normal', creada: hace(48),
        items: [{ mat: 'MAT-0006', cant: 240 }],
      },
      {
        codigo: 'RQ-2026-0137', frente: 'FR-001', solicitante: 'ap', estado: 'recibida',
        descripcion: 'Material vario — fundición columnas',
        prioridad: 'normal', creada: hace(72),
        items: [{ mat: 'MAT-0001', cant: 80 }, { mat: 'MAT-0008', cant: 12 }],
      },
      {
        codigo: 'RQ-2026-0136', frente: 'FR-003', solicitante: 'lg', estado: 'pendiente',
        descripcion: 'EPP frente Mariposa — cascos y guantes',
        prioridad: 'urgente', creada: hace(1),
        items: [{ mat: 'MAT-0009', cant: 25 }],
      },
      {
        codigo: 'RQ-2026-0135', frente: 'FR-002', solicitante: 'cr', estado: 'rechazada',
        descripcion: 'Soldadura especial — estructura metálica',
        prioridad: 'normal', creada: hace(96),
        motivo: 'Especificación incorrecta. Se requiere E7018 según norma estructural.',
        items: [{ mat: 'MAT-0010', cant: 80 }],
      },
    ];

    for (const r of reqs) {
      const m = await prisma.material.findMany({ where: { id: { in: r.items.map(it => matIds[it.mat]) } } });
      const matMap = new Map(m.map(x => [x.id, x]));

      const itemsData = r.items.map((it, idx) => {
        const mat = matMap.get(matIds[it.mat])!;
        const sub = BigInt(Math.round(it.cant * Number(mat.precioReferenciaCentavos)));
        return {
          orden: idx,
          materialId: mat.id,
          descripcionSnapshot: mat.descripcion,
          unidadSnapshot: mat.unidad,
          cantidad: it.cant,
          precioUnitarioCentavosSnapshot: mat.precioReferenciaCentavos,
          subtotalCentavos: sub,
        };
      });
      const subtotal = itemsData.reduce((s, x) => s + x.subtotalCentavos, 0n);
      const iva = BigInt(Math.round(Number(subtotal) * IVA));

      await prisma.requisicion.create({
        data: {
          codigo: r.codigo,
          frenteId: frenteIds[r.frente],
          solicitanteId: userIds[r.solicitante],
          descripcion: r.descripcion,
          prioridad: r.prioridad,
          estado: r.estado,
          motivoRechazo: r.motivo,
          fechaCreacion: r.creada,
          subtotalCentavos: subtotal,
          ivaCentavos: iva,
          totalCentavos: subtotal + iva,
          sobrePresupuesto: !!r.sobre,
          aprobadorId: ['aprobada', 'compras', 'recibida'].includes(r.estado) ? userIds.jm : undefined,
          avaladorId: ['avalada', 'aprobada', 'compras', 'recibida'].includes(r.estado) ? userIds.cr : undefined,
          items: { create: itemsData },
          historial: {
            create: {
              estadoAnterior: null,
              estadoNuevo: r.estado,
              actorId: userIds[r.solicitante],
              observacion: r.motivo || 'Estado inicial sembrado',
            },
          },
        },
      });
    }
  }

  // ============================================================
  // Notificaciones de muestra
  // ============================================================
  const notif = await prisma.notificacion.count();
  if (notif === 0) {
    await prisma.notificacion.createMany({
      data: [
        { targetUserId: userIds.jm, tipo: 'aprob', texto: 'RQ-2026-0142 esperando tu aprobación' },
        { targetUserId: userIds.jm, tipo: 'budget', texto: 'Frente Vía Mariposa alcanzó el 88% del presupuesto' },
        { targetUserId: userIds.jm, tipo: 'stock', texto: 'Tubería PVC 2" agotada en bodega central' },
      ],
    });
  }

  // ============================================================
  // Configuración base
  // ============================================================
  const configs = [
    { clave: 'iva_rate', valor: 0.19, descripcion: 'Tarifa IVA Colombia' },
    { clave: 'retefuente_default', valor: 0.025 },
    { clave: 'reteiva_default', valor: 0.15 },
    { clave: 'reteica_default', valor: 0.00966 },
  ];
  for (const c of configs) {
    await prisma.configuracion.upsert({
      where: { tenantId_clave: { tenantId: 1, clave: c.clave } },
      create: { tenantId: 1, ...c },
      update: { valor: c.valor },
    });
  }

  console.log('✅ Seed completo');
  console.log('\n  Credenciales de prueba (password: password123):');
  console.log('    Director:   juan.mejia@andina.co');
  console.log('    Residente:  andres.patino@andina.co');
  console.log('    Compras:    sofia.vargas@andina.co');
  console.log('    Caja:       patricia.holguin@andina.co');
  console.log('    Bodega:     ricardo.bermudez@andina.co');
  console.log('    Admin:      admin@andina.co\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
