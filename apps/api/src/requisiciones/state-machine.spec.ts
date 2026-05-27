import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { evaluarTransicion, AccionRequisicion, TransicionContexto } from './state-machine';
import { EstadoRequisicion, Rol } from '@control-obra/shared';

/**
 * Tests de la máquina de estados de requisiciones.
 * Función pura `evaluarTransicion` — sin DB, sin mocks. Cubre:
 *  - El flujo feliz completo (borrador → … → recibida)
 *  - Transiciones inválidas según estado
 *  - Autorización por rol
 *  - Segregación de funciones (director no aprueba lo suyo)
 *  - Reglas de aval (mismo frente, no propio)
 */

// Constructor de contexto con valores por defecto razonables; cada test
// sobreescribe solo lo que le importa.
function ctx(overrides: Partial<TransicionContexto> = {}): TransicionContexto {
  return {
    estadoActual: 'borrador',
    rolesUsuario: ['residente'],
    usuarioId: 'u-solicitante',
    solicitanteId: 'u-solicitante',
    frenteIdRequisicion: 'f-1',
    frentesAsignadosUsuario: ['f-1'],
    ...overrides,
  };
}

describe('evaluarTransicion — flujo feliz', () => {
  it('enviar: borrador → pendiente (residente)', () => {
    const r = evaluarTransicion('enviar', ctx({ estadoActual: 'borrador', rolesUsuario: ['residente'] }));
    expect(r.estadoNuevo).toBe('pendiente');
  });

  it('avalar: pendiente → avalada (otro residente del mismo frente)', () => {
    const r = evaluarTransicion(
      'avalar',
      ctx({
        estadoActual: 'pendiente',
        rolesUsuario: ['residente'],
        usuarioId: 'u-otro',
        solicitanteId: 'u-solicitante',
        frenteIdRequisicion: 'f-1',
        frentesAsignadosUsuario: ['f-1'],
      }),
    );
    expect(r.estadoNuevo).toBe('avalada');
  });

  it('aprobar: avalada → aprobada (director distinto al solicitante)', () => {
    const r = evaluarTransicion(
      'aprobar',
      ctx({ estadoActual: 'avalada', rolesUsuario: ['director'], usuarioId: 'u-dir', solicitanteId: 'u-solicitante' }),
    );
    expect(r.estadoNuevo).toBe('aprobada');
  });

  it('recibir: compras → recibida (bodega)', () => {
    const r = evaluarTransicion('recibir', ctx({ estadoActual: 'compras', rolesUsuario: ['bodega'] }));
    expect(r.estadoNuevo).toBe('recibida');
  });

  it('recibir: compras → recibida (compras)', () => {
    const r = evaluarTransicion('recibir', ctx({ estadoActual: 'compras', rolesUsuario: ['compras'] }));
    expect(r.estadoNuevo).toBe('recibida');
  });
});

describe('evaluarTransicion — rechazo', () => {
  it.each<EstadoRequisicion>(['borrador', 'pendiente', 'avalada', 'aprobada'])(
    'rechazar desde %s → rechazada (director)',
    (estado) => {
      const r = evaluarTransicion('rechazar', ctx({ estadoActual: estado, rolesUsuario: ['director'] }));
      expect(r.estadoNuevo).toBe('rechazada');
    },
  );

  it('rechazar también lo puede hacer un residente', () => {
    const r = evaluarTransicion('rechazar', ctx({ estadoActual: 'pendiente', rolesUsuario: ['residente'] }));
    expect(r.estadoNuevo).toBe('rechazada');
  });

  it('no se puede rechazar una requisición ya en compras', () => {
    expect(() => evaluarTransicion('rechazar', ctx({ estadoActual: 'compras', rolesUsuario: ['director'] }))).toThrow(
      BadRequestException,
    );
  });

  it('no se puede rechazar una requisición ya recibida', () => {
    expect(() => evaluarTransicion('rechazar', ctx({ estadoActual: 'recibida', rolesUsuario: ['director'] }))).toThrow(
      BadRequestException,
    );
  });
});

describe('evaluarTransicion — transiciones inválidas por estado', () => {
  it('no se puede enviar algo que ya está pendiente', () => {
    expect(() => evaluarTransicion('enviar', ctx({ estadoActual: 'pendiente' }))).toThrow(BadRequestException);
  });

  it('no se puede avalar un borrador (aún no enviado)', () => {
    expect(() => evaluarTransicion('avalar', ctx({ estadoActual: 'borrador', rolesUsuario: ['residente'] }))).toThrow(
      BadRequestException,
    );
  });

  it('no se puede aprobar algo pendiente sin aval previo', () => {
    expect(() =>
      evaluarTransicion('aprobar', ctx({ estadoActual: 'pendiente', rolesUsuario: ['director'], usuarioId: 'u-dir' })),
    ).toThrow(BadRequestException);
  });

  it('no se puede recibir algo que no está en compras', () => {
    expect(() => evaluarTransicion('recibir', ctx({ estadoActual: 'aprobada', rolesUsuario: ['bodega'] }))).toThrow(
      BadRequestException,
    );
  });

  it.each<EstadoRequisicion>(['recibida', 'rechazada'])(
    'no hay acciones válidas desde el estado terminal %s',
    (estado) => {
      const acciones: AccionRequisicion[] = ['enviar', 'avalar', 'aprobar', 'recibir'];
      for (const a of acciones) {
        expect(() => evaluarTransicion(a, ctx({ estadoActual: estado, rolesUsuario: ['director', 'bodega', 'residente'] }))).toThrow(
          BadRequestException,
        );
      }
    },
  );
});

describe('evaluarTransicion — autorización por rol', () => {
  it('un bodega no puede enviar (solo residente)', () => {
    expect(() => evaluarTransicion('enviar', ctx({ estadoActual: 'borrador', rolesUsuario: ['bodega'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('un residente no puede aprobar (solo director)', () => {
    expect(() =>
      evaluarTransicion('aprobar', ctx({ estadoActual: 'avalada', rolesUsuario: ['residente'], usuarioId: 'u-otro' })),
    ).toThrow(ForbiddenException);
  });

  it('un director no puede recibir (solo bodega/compras)', () => {
    expect(() => evaluarTransicion('recibir', ctx({ estadoActual: 'compras', rolesUsuario: ['director'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('un usuario con múltiples roles pasa si alguno está autorizado', () => {
    const r = evaluarTransicion(
      'aprobar',
      ctx({ estadoActual: 'avalada', rolesUsuario: ['auditor', 'director'], usuarioId: 'u-dir', solicitanteId: 'u-otro' }),
    );
    expect(r.estadoNuevo).toBe('aprobada');
  });
});

describe('evaluarTransicion — segregación de funciones', () => {
  it('el director NO puede aprobar una requisición que él mismo creó', () => {
    expect(() =>
      evaluarTransicion(
        'aprobar',
        ctx({ estadoActual: 'avalada', rolesUsuario: ['director'], usuarioId: 'u-dir', solicitanteId: 'u-dir' }),
      ),
    ).toThrow(ForbiddenException);
  });
});

describe('evaluarTransicion — reglas de aval', () => {
  it('no se puede avalar la propia requisición', () => {
    expect(() =>
      evaluarTransicion(
        'avalar',
        ctx({
          estadoActual: 'pendiente',
          rolesUsuario: ['residente'],
          usuarioId: 'u-mismo',
          solicitanteId: 'u-mismo',
          frenteIdRequisicion: 'f-1',
          frentesAsignadosUsuario: ['f-1'],
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('no se puede avalar si el residente no está asignado al frente', () => {
    expect(() =>
      evaluarTransicion(
        'avalar',
        ctx({
          estadoActual: 'pendiente',
          rolesUsuario: ['residente'],
          usuarioId: 'u-otro',
          solicitanteId: 'u-solicitante',
          frenteIdRequisicion: 'f-99',
          frentesAsignadosUsuario: ['f-1', 'f-2'],
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
