// ============================================================
// Constantes del dominio — fuente de verdad compartida
// ============================================================

/** Los 7 estados de la requisición — orden importa para el timeline */
export const ESTADOS_REQUISICION = [
  'borrador',
  'pendiente',
  'avalada',
  'aprobada',
  'compras',
  'recibida',
  'rechazada',
] as const;
export type EstadoRequisicion = (typeof ESTADOS_REQUISICION)[number];

/** Transiciones permitidas (máquina de estados) */
export const TRANSICIONES_REQUISICION: Record<EstadoRequisicion, EstadoRequisicion[]> = {
  borrador: ['pendiente', 'rechazada'],
  pendiente: ['avalada', 'rechazada'],
  avalada: ['aprobada', 'rechazada'],
  aprobada: ['compras', 'rechazada'],
  compras: ['recibida'],
  recibida: [],
  rechazada: [],
};

/** Roles del sistema */
export const ROLES = [
  'director',
  'residente',
  'compras',
  'caja',
  'bodega',
  'admin',
  'auditor',
] as const;
export type Rol = (typeof ROLES)[number];

/** Roles que requieren MFA obligatorio */
export const ROLES_CON_MFA_OBLIGATORIO: Rol[] = ['director', 'caja', 'admin'];

/** Estados de la OC */
export const ESTADOS_OC = [
  'borrador',
  'enviada',
  'en_transito',
  'recibida_parcial',
  'recibida_total',
  'anulada',
] as const;
export type EstadoOC = (typeof ESTADOS_OC)[number];

/** Unidades de medida válidas */
export const UNIDADES = [
  'und',
  'rollo',
  'galon',
  'm3',
  'kg',
  'm',
  'm2',
  'paquete',
  'caja',
  'lt',
  'ton',
] as const;
export type Unidad = (typeof UNIDADES)[number];

/** Prioridad */
export const PRIORIDADES = ['normal', 'urgente'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

/** Tipos de movimiento de caja */
export const TIPOS_MOVIMIENTO_CAJA = ['entrada', 'salida', 'ajuste'] as const;
export type TipoMovimientoCaja = (typeof TIPOS_MOVIMIENTO_CAJA)[number];

/** Condiciones de pago */
export const CONDICIONES_PAGO = [
  'contado',
  'credito_15',
  'credito_30',
  'credito_60',
  'credito_90',
] as const;
export type CondicionPago = (typeof CONDICIONES_PAGO)[number];

/** Helpers de dinero */
export const CENTAVOS_POR_PESO = 100;
export const toCentavos = (pesos: number): bigint => BigInt(Math.round(pesos * CENTAVOS_POR_PESO));
export const toPesos = (centavos: bigint | number): number =>
  Number(centavos) / CENTAVOS_POR_PESO;

/** Permisos granulares */
export const PERMISOS = [
  'requisicion:create',
  'requisicion:read:all',
  'requisicion:read:own',
  'requisicion:endorse',
  'requisicion:approve',
  'requisicion:reject',
  'oc:create',
  'oc:read',
  'oc:approve',
  'oc:anular',
  'caja:movimiento:create',
  'caja:movimiento:read',
  'caja:arqueo:cerrar',
  'bodega:entrada',
  'bodega:salida',
  'inventario:read',
  'inventario:ajustar',
  'presupuesto:ajustar',
  'frente:create',
  'frente:update',
  'usuario:gestionar',
  'auditoria:leer',
  'config:editar',
] as const;
export type Permiso = (typeof PERMISOS)[number];

/** Mapa de permisos por rol — fuente única de verdad para RBAC */
export const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  director: [
    'requisicion:read:all',
    'requisicion:approve',
    'requisicion:reject',
    'oc:read',
    'oc:approve',
    'oc:anular',
    'caja:movimiento:read',
    'inventario:read',
    'presupuesto:ajustar',
    'frente:update',
    'auditoria:leer',
  ],
  residente: [
    'requisicion:create',
    'requisicion:read:own',
    'requisicion:endorse',
    'requisicion:reject',
    'inventario:read',
  ],
  compras: [
    'requisicion:read:all',
    'oc:create',
    'oc:read',
    'oc:anular',
    'inventario:read',
  ],
  caja: [
    'requisicion:read:all',
    'oc:read',
    'caja:movimiento:create',
    'caja:movimiento:read',
    'caja:arqueo:cerrar',
  ],
  bodega: [
    'requisicion:read:all',
    'oc:read',
    'bodega:entrada',
    'bodega:salida',
    'inventario:read',
    'inventario:ajustar',
  ],
  admin: [
    'requisicion:read:all',
    'oc:read',
    'caja:movimiento:read',
    'inventario:read',
    'presupuesto:ajustar',
    'frente:create',
    'frente:update',
    'usuario:gestionar',
    'auditoria:leer',
    'config:editar',
  ],
  auditor: [
    'requisicion:read:all',
    'oc:read',
    'caja:movimiento:read',
    'inventario:read',
    'auditoria:leer',
  ],
};
