import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginInput } from '@control-obra/shared';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(input: LoginInput, meta: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.usuario.findUnique({
      where: { email: input.email },
      include: { roles: true },
    });

    if (!user || !user.activo || user.deletedAt) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // MFA — si está habilitado, requerir código (skip si beta)
    if (user.mfaEnabled && !input.mfaCode) {
      throw new UnauthorizedException('Se requiere código MFA');
    }

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
    });

    const refreshToken = crypto.randomBytes(48).toString('hex');
    const refreshHash = await argon2.hash(refreshToken);
    const expiraAt = new Date();
    expiraAt.setDate(expiraAt.getDate() + 30);

    await this.prisma.sesion.create({
      data: {
        usuarioId: user.id,
        refreshTokenHash: refreshHash,
        ip: meta.ip,
        userAgent: meta.userAgent,
        expiraAt,
      },
    });

    await this.prisma.usuario.update({
      where: { id: user.id },
      data: { ultimoLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
      user: {
        id: user.id,
        email: user.email,
        nombres: user.nombres,
        apellidos: user.apellidos,
        iniciales: user.iniciales,
        roles: user.roles.map((r) => r.rolId),
      },
    };
  }

  async refresh(refreshToken: string) {
    // Find candidate sessions and verify hash (argon2 verify is the bottleneck)
    const candidates = await this.prisma.sesion.findMany({
      where: { revocadoAt: null, expiraAt: { gt: new Date() } },
      orderBy: { emitidoAt: 'desc' },
      take: 100,
      include: { usuario: { include: { roles: true } } },
    });

    let session: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      if (await argon2.verify(c.refreshTokenHash, refreshToken)) {
        session = c;
        break;
      }
    }
    if (!session) throw new UnauthorizedException('Refresh token inválido');

    const accessToken = await this.jwt.signAsync({
      sub: session.usuario.id,
      email: session.usuario.email,
      tenantId: session.usuario.tenantId,
    });

    return {
      accessToken,
      expiresIn: 15 * 60,
    };
  }

  async logout(userId: string) {
    await this.prisma.sesion.updateMany({
      where: { usuarioId: userId, revocadoAt: null },
      data: { revocadoAt: new Date() },
    });
    return { ok: true };
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }
}
