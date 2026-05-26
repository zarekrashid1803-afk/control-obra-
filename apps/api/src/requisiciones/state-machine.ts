import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  EstadoRequisicion,
  TRANSICIONES_REQUISICION,
  Rol,
} from '@control-obra/shared';

export type AccionRequisicion = 'enviar' | 'avalar' | 'aprobar' | 'rechazar' | 'recibir';

/** Mapeo acción → estado destino esperado dado el estado actual */
const ACCION_DESTINO: Record<AccionRequisicion, Record<EstadoRequisicion, EstadoRequisicion | null>> = {
  enviar:   { borrador: 'pendiente', pendiente: null, avalada: null, aprobada: null, compras: null, recibida: null, rechazada: null },
  avalar:   { borrador: null, pendiente: 'avalada',   avalada: null, aprobada: null, compras: null, recibida: null, rechazada: null },
  aprobar:  { borrador: null, pendiente: null, avalada: 'aprobada',  aprobada: null, compras: null, recibida: null, rechazada: null },
  rechazar: { borrador: 'rechazada', pendiente: 'rechazada', avalada: 'rechazada', aprobada: 'rechazada', compras: null, recibida: null, rechazada: null },
  recibir:  { borrador: null, pendiente: null, avalada: null, aprobada: null, compras: 'recibida',  recibida: null, rechazada: null },
};

/** Roles autorizados para cada acción */
const ROLES_AUTORIZADOS: Record<AccionRequisicion, Rol[]> = {
  enviar:   ['residente'],
  avalar:   ['residente'],     // residente jefe del mismo frente (validación adicional en servicio)
  aprobar:  ['director'],
  rechazar: ['director', 'residente'],
  recibir:  ['bodega', 'compras'],
};

export interface TransicionContexto {
  estadoActual: EstadoRequisicion;
  rolesUsuario: Rol[];
  usuarioId: string;
  solicitanteId: string;
  frenteIdRequisicion: string;
  frentesAsignadosUsuario: string[];
}

export interface ResultadoTransicion {
  estadoNuevo: EstadoRequisicion;
}

export function evaluarTransicion(
  accion: AccionRequisicion,
  ctx: TransicionContexto,
): ResultadoTransicion {
  const destino = ACCION_DESTINO[accion][ctx.estadoActual];
  if (!destino) {
    throw new BadRequestException(
      `Acción "${accion}" no aplicable cuando el estado es "${ctx.estadoActual}".`,
    );
  }

  const rolesPermitidos = ROLES_AUTORIZADOS[accion];
  const tieneRol = ctx.rolesUsuario.some((r) => rolesPermitidos.includes(r));
  if (!tieneRol) {
    throw new ForbiddenException(
      `Acción "${accion}" requiere rol ${rolesPermitidos.join(' o ')}.`,
    );
  }

  // Segregación de funciones: el Director NO puede aprobar su propia requisición
  if (accion === 'aprobar' && ctx.usuarioId === ctx.solicitanteId) {
    throw new ForbiddenException(
      'Un Director no puede aprobar una requisición que él mismo creó.',
    );
  }

  // Aval solo del mismo frente
  if (accion === 'avalar') {
    const enFrente = ctx.frentesAsignadosUsuario.includes(ctx.frenteIdRequisicion);
    if (!enFrente) {
      throw new ForbiddenException(
        'Solo un residente asignado al mismo frente puede avalar la requisición.',
      );
    }
    if (ctx.usuarioId === ctx.solicitanteId) {
      throw new ForbiddenException(
        'No puedes avalar tu propia requisición. Otro residente del frente debe hacerlo.',
      );
    }
  }

  // Verificar contra el mapa de transiciones permitidas (defense in depth)
  if (!TRANSICIONES_REQUISICION[ctx.estadoActual].includes(destino)) {
    throw new BadRequestException(
      `Transición no permitida: ${ctx.estadoActual} → ${destino}`,
    );
  }

  return { estadoNuevo: destino };
}
