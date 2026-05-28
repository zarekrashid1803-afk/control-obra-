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
import { encryptSecret, decryptSecret } from './crypto.util';
import { NotificationsService } from '../notifications/notifications.module';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private notifications: NotificationsService,
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
        ? authenticator.verify({ token: input.mfaCode, secret: decryptSecret(user.mfaSecret) })
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

    const { token: refreshToken, selector, secretHash } = await this.issueRefreshToken();
    const expiraAt = new Date();
    expiraAt.setDate(expiraAt.getDate() + 30);

    await this.prisma.sesion.create({
      data: {
        usuarioId: user.id,
        selector,
        refreshTokenHash: secretHash,
        ip: meta.ip,
        userAgent: meta.userAgent,
        expiraAt,
      },
    });

    await this.prisma.usuario.update({
      where: { id: user.id },
      data: { ultimoLoginAt: new Date() },
    });

    // Limpieza oportunista de sesiones viejas (no bloquea el login).
    void this.cleanupOldSessions(user.id);

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

  /**
   * Borra sesiones vencidas o revocadas hace más de 7 días. La rotación crea
   * una sesión nueva en cada refresh (~cada 15 min), así que sin esto la tabla
   * crecería sin límite. Se conservan las revocadas recientes para que la
   * detección de reuso de token siga funcionando.
   */
  private async cleanupOldSessions(usuarioId: string) {
    const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await this.prisma.sesion
      .deleteMany({
        where: {
          usuarioId,
          OR: [{ expiraAt: { lt: new Date() } }, { revocadoAt: { lt: hace7dias } }],
        },
      })
      .catch(() => {});
  }

  /** Genera un refresh token "selector.secret" y el hash del secreto. */
  private async issueRefreshToken() {
    const selector = crypto.randomBytes(12).toString('hex');
    const secret = crypto.randomBytes(48).toString('hex');
    const secretHash = await argon2.hash(secret);
    return { token: `${selector}.${secret}`, selector, secretHash };
  }

  async refresh(refreshToken: string) {
    const [selector, secret] = (refreshToken || '').split('.');
    if (!selector || !secret) throw new UnauthorizedException('Refresh token inválido');

    // Lookup O(1) por selector (índice único) — sin iterar argon2.
    const session = await this.prisma.sesion.findUnique({
      where: { selector },
      include: { usuario: { include: { roles: true } } },
    });
    if (!session) throw new UnauthorizedException('Refresh token inválido');

    const secretOk = await argon2.verify(session.refreshTokenHash, secret);
    if (!secretOk) throw new UnauthorizedException('Refresh token inválido');

    // Detección de reuso: secreto válido pero sesión ya revocada/vencida →
    // señal de token robado o rotado dos veces. Revocar TODAS las sesiones del
    // usuario y rechazar (el atacante y el legítimo deben re-loguear).
    if (session.revocadoAt || session.expiraAt < new Date()) {
      await this.prisma.sesion.updateMany({
        where: { usuarioId: session.usuarioId, revocadoAt: null },
        data: { revocadoAt: new Date() },
      });
      throw new UnauthorizedException('Sesión inválida. Vuelve a iniciar sesión.');
    }

    if (!session.usuario.activo || session.usuario.deletedAt) {
      throw new UnauthorizedException('Usuario inválido');
    }

    // Rotación: revocar la sesión actual y emitir una nueva. Un refresh token
    // robado solo sirve hasta el próximo refresh del usuario legítimo.
    const { token: newRefreshToken, selector: newSelector, secretHash } = await this.issueRefreshToken();
    const expiraAt = new Date();
    expiraAt.setDate(expiraAt.getDate() + 30);
    await this.prisma.$transaction([
      this.prisma.sesion.update({ where: { id: session.id }, data: { revocadoAt: new Date() } }),
      this.prisma.sesion.create({
        data: {
          usuarioId: session.usuarioId,
          selector: newSelector,
          refreshTokenHash: secretHash,
          ip: session.ip,
          userAgent: session.userAgent,
          expiraAt,
        },
      }),
    ]);

    const accessToken = await this.jwt.signAsync({
      sub: session.usuario.id,
      email: session.usuario.email,
      tenantId: session.usuario.tenantId,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
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

  // ============================================================
  // Recuperación de contraseña ("olvidé mi contraseña")
  // ============================================================

  async forgotPassword(email: string) {
    const user = await this.prisma.usuario.findUnique({ where: { email } });
    // Responder SIEMPRE ok: no revelar si el email existe (anti-enumeración).
    if (!user || !user.activo || user.deletedAt) return { ok: true };

    // Invalidar tokens previos no usados de este usuario.
    await this.prisma.passwordReset.updateMany({
      where: { usuarioId: user.id, usadoAt: null },
      data: { usadoAt: new Date() },
    });

    const selector = crypto.randomBytes(12).toString('hex');
    const secret = crypto.randomBytes(32).toString('hex');
    const tokenHash = await argon2.hash(secret);
    const expiraAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.prisma.passwordReset.create({
      data: { usuarioId: user.id, selector, tokenHash, expiraAt },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://control-obra-web.vercel.app';
    const link = `${frontendUrl}/reset-password?token=${selector}.${secret}`;
    // Si no hay RESEND_API_KEY, EmailService loguea y no manda (no rompe).
    await this.notifications.enviarResetPassword(user.email, user.nombres, link);

    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const [selector, secret] = (token || '').split('.');
    if (!selector || !secret) throw new BadRequestException('Enlace inválido');

    const pr = await this.prisma.passwordReset.findUnique({ where: { selector } });
    if (!pr || pr.usadoAt || pr.expiraAt < new Date()) {
      throw new BadRequestException('El enlace expiró o ya fue usado. Solicita uno nuevo.');
    }
    const ok = await argon2.verify(pr.tokenHash, secret);
    if (!ok) throw new BadRequestException('Enlace inválido');

    const newHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: pr.usuarioId },
        data: { passwordHash: newHash, passwordChangeRequired: false },
      }),
      this.prisma.passwordReset.update({ where: { id: pr.id }, data: { usadoAt: new Date() } }),
      // Revocar todas las sesiones: si fue un compromiso, cierra al atacante.
      this.prisma.sesion.updateMany({
        where: { usuarioId: pr.usuarioId, revocadoAt: null },
        data: { revocadoAt: new Date() },
      }),
    ]);

    return { ok: true };
  }

  // ============================================================
  // Verificación de correo
  // ============================================================

  async verificarEmail(token: string) {
    const [selector, secret] = (token || '').split('.');
    if (!selector || !secret) throw new BadRequestException('Enlace inválido');
    const v = await this.prisma.verificacionEmail.findUnique({ where: { selector } });
    if (!v || v.usadoAt || v.expiraAt < new Date()) {
      throw new BadRequestException('El enlace expiró o ya fue usado. Pide uno nuevo.');
    }
    const ok = await argon2.verify(v.tokenHash, secret);
    if (!ok) throw new BadRequestException('Enlace inválido');
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: v.usuarioId },
        data: { emailVerificado: true, emailVerificadoAt: new Date() },
      }),
      this.prisma.verificacionEmail.update({ where: { id: v.id }, data: { usadoAt: new Date() } }),
    ]);
    return { ok: true };
  }

  async reenviarVerificacion(userId: string) {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.emailVerificado) return { ok: true, yaVerificado: true };
    await this.notifications.crearYEnviarVerificacion(user.id, user.email, user.nombres);
    return { ok: true };
  }

  async emailStatus(userId: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { emailVerificado: true },
    });
    return { emailVerificado: !!user?.emailVerificado };
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

    // Guardamos el secreto CIFRADO pero NO habilitamos hasta que confirme con
    // un código válido. Si la DB se filtra, el secreto TOTP no queda expuesto.
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { mfaSecret: encryptSecret(secret) },
    });

    return { secret, otpauthUrl: otpauth, qrDataUrl };
  }

  /** Verifica el primer código y activa MFA. */
  async mfaEnable(userId: string, code: string) {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      throw new BadRequestException('Primero genera el código QR (setup)');
    }
    const ok = authenticator.verify({ token: code, secret: decryptSecret(user.mfaSecret) });
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
    const ok = authenticator.verify({ token: code, secret: decryptSecret(user.mfaSecret) });
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
