import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { LoginInput, ChangePasswordInput } from '@control-obra/shared';

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

    // MFA — si está habilitado, requerir y verificar el código TOTP
    if (user.mfaEnabled) {
      if (!input.mfaCode) {
        // Cuerpo distinguible para que el front muestre el campo de código
        throw new UnauthorizedException({ error: 'MFA_REQUIRED', message: 'Se requiere código de verificación' });
      }
      const ok2fa = user.mfaSecret
        ? authenticator.verify({ token: input.mfaCode, secret: user.mfaSecret })
        : false;
      if (!ok2fa) {
        throw new UnauthorizedException({ error: 'MFA_INVALID', message: 'Código de verificación inválido' });
      }
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
        passwordChangeRequired: user.passwordChangeRequired,
      },
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!user || !user.activo || user.deletedAt) {
      throw new UnauthorizedException('Usuario inválido');
    }
    const ok = await argon2.verify(user.passwordHash, input.currentPassword);
    if (!ok) throw new BadRequestException('Contraseña actual incorrecta');

    if (input.currentPassword === input.newPassword) {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual');
    }

    const newHash = await argon2.hash(input.newPassword);
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { passwordHash: newHash, passwordChangeRequired: false },
    });

    // Revocar todas las sesiones excepto cualquiera futura — fuerza re-login en otros dispositivos
    await this.prisma.sesion.updateMany({
      where: { usuarioId: userId, revocadoAt: null },
      data: { revocadoAt: new Date() },
    });

    return { ok: true };
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

  // ============================================================
  // MFA / 2FA (TOTP)
  // ============================================================

  /** Genera un secreto TOTP nuevo (aún no habilitado) y devuelve el QR para escanear. */
  async mfaSetup(userId: string) {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'Control de Obra', secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    // Guardamos el secreto pero NO habilitamos hasta que confirme con un código válido
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    return { secret, otpauthUrl: otpauth, qrDataUrl };
  }

  /** Verifica el primer código y activa MFA. */
  async mfaEnable(userId: string, code: string) {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      throw new BadRequestException('Primero genera el código QR (setup)');
    }
    const ok = authenticator.verify({ token: code, secret: user.mfaSecret });
    if (!ok) throw new BadRequestException('Código inválido. Verifica la hora de tu dispositivo.');

    await this.prisma.usuario.update({ where: { id: userId }, data: { mfaEnabled: true } });
    return { ok: true, mfaEnabled: true };
  }

  /** Desactiva MFA (requiere un código válido para confirmar identidad). */
  async mfaDisable(userId: string, code: string) {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA no está activo');
    }
    const ok = authenticator.verify({ token: code, secret: user.mfaSecret });
    if (!ok) throw new BadRequestException('Código inválido');

    await this.prisma.usuario.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    return { ok: true, mfaEnabled: false };
  }

  async mfaStatus(userId: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });
    return { mfaEnabled: !!user?.mfaEnabled };
  }
}
