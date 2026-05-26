import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { Rol } from '@control-obra/shared';

interface JwtPayload {
  sub: string; // userId
  email: string;
  tenantId: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-change-me',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { rol: true } } },
    });

    if (!user || !user.activo || user.deletedAt) {
      throw new UnauthorizedException('Usuario inválido o desactivado');
    }

    return {
      id: user.id,
      email: user.email,
      nombres: user.nombres,
      apellidos: user.apellidos,
      iniciales: user.iniciales,
      tenantId: user.tenantId,
      roles: user.roles.map((r) => r.rolId) as Rol[],
      frentesAsignados: user.frentesAsignados,
    };
  }
}
