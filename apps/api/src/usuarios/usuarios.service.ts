import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import type { CreateUsuarioInput, UpdateUsuarioInput } from '@control-obra/shared';

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService, private auth: AuthService) {}

  async list(params: { page: number; pageSize: number; search?: string }, tenantId: number) {
    const { page, pageSize, search } = params;
    const where = {
      deletedAt: null,
      tenantId,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { nombres: { contains: search, mode: 'insensitive' as const } },
              { apellidos: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { roles: true },
      }),
    ]);
    return {
      data: data.map(this.toPublic),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getById(id: string, tenantId: number) {
    const u = await this.prisma.usuario.findUnique({
      where: { id },
      include: { roles: true },
    });
    if (!u || u.deletedAt || u.tenantId !== tenantId) throw new NotFoundException('Usuario no encontrado');
    return this.toPublic(u);
  }

  async create(input: CreateUsuarioInput, tenantId: number) {
    // El email es único GLOBAL (el login es por email entre todos los tenants)
    const exists = await this.prisma.usuario.findUnique({ where: { email: input.email } });
    if (exists) throw new ConflictException('Email ya registrado');

    const iniciales = (input.nombres.charAt(0) + input.apellidos.charAt(0)).toUpperCase();
    const passwordHash = await this.auth.hashPassword(input.password);

    const u = await this.prisma.usuario.create({
      data: {
        tenantId,
        email: input.email,
        nombres: input.nombres,
        apellidos: input.apellidos,
        iniciales,
        passwordHash,
        mfaEnabled: input.mfaEnabled,
        frentesAsignados: input.frentesAsignados,
        roles: { create: input.roles.map((r) => ({ rolId: r })) },
      },
      include: { roles: true },
    });
    return this.toPublic(u);
  }

  async update(id: string, input: UpdateUsuarioInput, tenantId: number) {
    const exists = await this.prisma.usuario.findUnique({ where: { id } });
    if (!exists || exists.tenantId !== tenantId) throw new NotFoundException();
    const { roles, ...rest } = input;
    const u = await this.prisma.usuario.update({
      where: { id },
      data: {
        ...rest,
        ...(roles
          ? {
              roles: {
                deleteMany: {},
                create: roles.map((r) => ({ rolId: r })),
              },
            }
          : {}),
      },
      include: { roles: true },
    });
    return this.toPublic(u);
  }

  async softDelete(id: string, tenantId: number) {
    await this.getById(id, tenantId); // valida pertenencia al tenant
    await this.prisma.usuario.update({
      where: { id },
      data: { deletedAt: new Date(), activo: false },
    });
    return { ok: true };
  }

  /**
   * Resetea el 2FA de un usuario (red de seguridad: si pierde el teléfono y
   * queda bloqueado, un admin puede desactivárselo). Borra el secreto TOTP.
   */
  async resetMfa(id: string, tenantId: number) {
    await this.getById(id, tenantId); // valida pertenencia al tenant
    await this.prisma.usuario.update({
      where: { id },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    return { ok: true, mfaEnabled: false };
  }

  private toPublic(u: any) {
    return {
      id: u.id,
      email: u.email,
      nombres: u.nombres,
      apellidos: u.apellidos,
      iniciales: u.iniciales,
      roles: u.roles?.map((r: any) => r.rolId) || [],
      frentesAsignados: u.frentesAsignados || [],
      mfaEnabled: u.mfaEnabled,
      activo: u.activo,
      ultimoLoginAt: u.ultimoLoginAt,
      createdAt: u.createdAt,
    };
  }
}
