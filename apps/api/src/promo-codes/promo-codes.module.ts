import {
  BadRequestException, Body, CanActivate, ConflictException, Controller, ExecutionContext,
  ForbiddenException, Get, HttpException, Injectable, Module, NestInterceptor, Post,
  UseGuards,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import {
  generarPromoCodesSchema, GenerarPromoCodesInput,
  signupSchema, SignupInput,
  extenderTrialSchema, ExtenderTrialInput,
} from '@control-obra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

const TRIAL_HOURS = Number(process.env.TRIAL_HOURS) || 120; // 5 días

// ============================================================
// SuperadminGuard — verifica que el usuario actual sea superadmin
// vía env SUPERADMIN_EMAILS="zarek@x.co,otro@y.co"
// ============================================================
@Injectable()
export class SuperadminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('No autenticado');

    const allowed = (process.env.SUPERADMIN_EMAILS || '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (allowed.length === 0) {
      throw new ForbiddenException('SUPERADMIN_EMAILS no configurado en el servidor');
    }
    if (!allowed.includes(user.email.toLowerCase())) {
      throw new ForbiddenException('Acceso restringido a superadmin');
    }
    return true;
  }
}

// ============================================================
// TrialInterceptor — bloquea WRITES si el tenant tiene trial vencido.
// GETs siguen pasando para que la UI pueda renderizar /trial-expired.
// ============================================================
@Injectable()
export class TrialInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(ctx: ExecutionContext, next: { handle: () => Observable<unknown> }) {
    const req = ctx.switchToHttp().getRequest();
    const method: string = req.method;

    // Solo bloqueamos escrituras
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next.handle();

    const user = req.user as AuthUser | undefined;
    if (!user) return next.handle(); // endpoint público

    // Whitelist: logout, signup, gestión de códigos por superadmin
    const path: string = req.path || req.url || '';
    const WHITELIST = ['/auth/logout', '/promo-codes/'];
    if (WHITELIST.some((p) => path.includes(p))) return next.handle();

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { trialEndsAt: true },
    });

    const trialActive = tenant?.trialEndsAt && tenant.trialEndsAt > new Date();
    if (!trialActive) {
      throw new HttpException(
        {
          error: 'TRIAL_EXPIRED',
          message: 'El periodo de prueba ha vencido. Contacta soporte para extender el acceso.',
          trialEndsAt: tenant?.trialEndsAt || null,
        },
        402, // Payment Required
      );
    }

    return next.handle();
  }
}

// ============================================================
// PromoCodesService
// ============================================================
@Injectable()
export class PromoCodesService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private generarCodigoUnico(): string {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0/I/1 para evitar confusiones
    const chars = Array.from({ length: 4 }, () => alfabeto[crypto.randomInt(alfabeto.length)]).join('');
    return `PRE-${chars}`;
  }

  async generar(input: GenerarPromoCodesInput, superadminEmail: string) {
    const generados: string[] = [];
    let intentos = 0;
    while (generados.length < input.cantidad && intentos < input.cantidad * 5) {
      intentos++;
      const codigo = this.generarCodigoUnico();
      try {
        await this.prisma.promoCode.create({
          data: { codigo, notes: input.notes, createdByEmail: superadminEmail },
        });
        generados.push(codigo);
      } catch (e: any) {
        // Choque de UNIQUE — reintenta
        if (e?.code !== 'P2002') throw e;
      }
    }
    return { generados, total: generados.length };
  }

  async list() {
    const codes = await this.prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        usedBy: { select: { id: true, email: true, nombres: true, apellidos: true } },
        tenant: { select: { id: true, nombre: true, trialEndsAt: true } },
      },
    });
    return codes.map((c) => ({
      ...c,
      estado: c.usedAt ? 'usado' : 'disponible',
      trialActivo: c.tenant?.trialEndsAt ? c.tenant.trialEndsAt > new Date() : null,
      horasRestantes: c.tenant?.trialEndsAt
        ? Math.max(0, Math.round((c.tenant.trialEndsAt.getTime() - Date.now()) / 3_600_000))
        : null,
    }));
  }

  async signup(input: SignupInput) {
    // Pre-check antes del costoso argon2.hash
    const promo = await this.prisma.promoCode.findUnique({ where: { codigo: input.codigo } });
    if (!promo) throw new BadRequestException('Código inválido');
    if (promo.usedAt) throw new BadRequestException('Este código ya fue canjeado');

    const existe = await this.prisma.usuario.findUnique({ where: { email: input.email } });
    if (existe) throw new ConflictException('Ya existe una cuenta con ese correo');

    const passwordHash = await argon2.hash(input.password);
    const iniciales = (input.nombres[0] + input.apellidos[0]).toUpperCase();
    const trialEndsAt = new Date(Date.now() + TRIAL_HOURS * 3_600_000);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1) Crear tenant nuevo con trial activo
      const tenant = await tx.tenant.create({
        data: {
          nombre: input.nombreConstructora,
          trialEndsAt,
          activo: true,
        },
      });

      // 2) Crear usuario admin del tenant
      const user = await tx.usuario.create({
        data: {
          tenantId: tenant.id,
          email: input.email,
          passwordHash,
          nombres: input.nombres,
          apellidos: input.apellidos,
          iniciales,
          activo: true,
          roles: { create: { rolId: 'admin' } },
        },
      });

      // 3) Canjear el código con compare-and-swap (race-safe)
      const updated = await tx.promoCode.updateMany({
        where: { id: promo.id, usedAt: null },
        data: { usedAt: new Date(), usedByUserId: user.id, tenantId: tenant.id },
      });
      if (updated.count === 0) {
        throw new ConflictException('El código fue canjeado por otra cuenta en el mismo instante');
      }

      return { tenant, user };
    });

    // JWT como en login
    const accessToken = await this.jwt.signAsync({
      sub: result.user.id,
      email: result.user.email,
      tenantId: result.tenant.id,
    });
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const refreshHash = await argon2.hash(refreshToken);
    const expiraAt = new Date();
    expiraAt.setDate(expiraAt.getDate() + 30);
    await this.prisma.sesion.create({
      data: { usuarioId: result.user.id, refreshTokenHash: refreshHash, expiraAt },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
      user: {
        id: result.user.id,
        email: result.user.email,
        nombres: result.user.nombres,
        apellidos: result.user.apellidos,
        iniciales: result.user.iniciales,
        roles: ['admin'],
      },
      tenant: {
        id: result.tenant.id,
        nombre: result.tenant.nombre,
        trialEndsAt: result.tenant.trialEndsAt,
      },
    };
  }

  async extenderTrial(input: ExtenderTrialInput) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) throw new BadRequestException('Tenant no existe');

    // Si trial ya pasó, contamos desde now(). Si está activo, sumamos desde la fecha actual de vencimiento.
    const base =
      tenant.trialEndsAt && tenant.trialEndsAt > new Date() ? tenant.trialEndsAt : new Date();
    const nuevoTrial = new Date(base.getTime() + input.horasAdicionales * 3_600_000);

    return this.prisma.tenant.update({
      where: { id: input.tenantId },
      data: { trialEndsAt: nuevoTrial },
      select: { id: true, nombre: true, trialEndsAt: true },
    });
  }

  async statusFor(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { trialEndsAt: true, nombre: true },
    });
    const trialEndsAt = tenant?.trialEndsAt || null;
    const trialActive = !!(trialEndsAt && trialEndsAt > new Date());
    const horasRestantes = trialEndsAt
      ? Math.max(0, Math.round((trialEndsAt.getTime() - Date.now()) / 3_600_000))
      : 0;
    return { trialActive, trialEndsAt, horasRestantes, tenantNombre: tenant?.nombre || null };
  }
}

// ============================================================
// Controller
// ============================================================
@ApiTags('promo-codes')
@Controller('promo-codes')
class PromoCodesController {
  constructor(private svc: PromoCodesService) {}

  // === Endpoints públicos ===

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Canjear código de invitación y crear tenant + cuenta' })
  signup(@Body(new ZodValidationPipe(signupSchema)) body: SignupInput) {
    return this.svc.signup(body);
  }

  // === Endpoints autenticados ===

  @ApiBearerAuth()
  @Get('status')
  @ApiOperation({ summary: 'Estado del trial del tenant actual' })
  status(@CurrentUser() user: AuthUser) {
    return this.svc.statusFor(user.tenantId);
  }

  // === Endpoints superadmin (require SUPERADMIN_EMAILS) ===

  @ApiBearerAuth()
  @UseGuards(SuperadminGuard)
  @Get()
  @ApiOperation({ summary: '[Superadmin] Listar todos los códigos de invitación' })
  list() {
    return this.svc.list();
  }

  @ApiBearerAuth()
  @UseGuards(SuperadminGuard)
  @Post('generar')
  @ApiOperation({ summary: '[Superadmin] Generar N códigos PRE-XXXX nuevos' })
  generar(
    @Body(new ZodValidationPipe(generarPromoCodesSchema)) body: GenerarPromoCodesInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.generar(body, user.email);
  }

  @ApiBearerAuth()
  @UseGuards(SuperadminGuard)
  @Post('extender-trial')
  @ApiOperation({ summary: '[Superadmin] Extender el trial de un tenant en N horas' })
  extender(@Body(new ZodValidationPipe(extenderTrialSchema)) body: ExtenderTrialInput) {
    return this.svc.extenderTrial(body);
  }
}

// ============================================================
// Module
// ============================================================
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: process.env.JWT_ACCESS_TTL || '15m' },
    }),
  ],
  providers: [
    PromoCodesService,
    SuperadminGuard,
    { provide: APP_INTERCEPTOR, useClass: TrialInterceptor },
  ],
  controllers: [PromoCodesController],
  exports: [PromoCodesService],
})
export class PromoCodesModule {}
