import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Post,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { loginSchema, refreshSchema, changePasswordSchema, mfaCodeSchema, forgotPasswordSchema, resetPasswordSchema, LoginInput, RefreshInput, ChangePasswordInput, MfaCodeInput, ForgotPasswordInput, ResetPasswordInput } from '@control-obra/shared';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  // Rate-limit: 10 intentos por minuto por IP en /auth/login
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(
    @Body() body: LoginInput,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.auth.login(body, { ip, userAgent: ua });
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renovar access token' })
  @UsePipes(new ZodValidationPipe(refreshSchema))
  refresh(@Body() body: RefreshInput) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cerrar sesión' })
  logout(@CurrentUser() user: AuthUser) {
    return this.auth.logout(user.id);
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cambiar contraseña (autenticado)' })
  @UsePipes(new ZodValidationPipe(changePasswordSchema))
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: ChangePasswordInput,
  ) {
    return this.auth.changePassword(user.id, body);
  }

  // === Recuperación de contraseña ===

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Solicitar enlace de recuperación de contraseña' })
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  forgotPassword(@Body() body: ForgotPasswordInput) {
    return this.auth.forgotPassword(body.email);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restablecer contraseña con token' })
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  resetPassword(@Body() body: ResetPasswordInput) {
    return this.auth.resetPassword(body.token, body.newPassword);
  }

  // === MFA / 2FA ===

  @Get('mfa/status')
  @ApiOperation({ summary: 'Estado de MFA del usuario actual' })
  mfaStatus(@CurrentUser() user: AuthUser) {
    return this.auth.mfaStatus(user.id);
  }

  @Post('mfa/setup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generar secreto + QR para configurar 2FA' })
  mfaSetup(@CurrentUser() user: AuthUser) {
    return this.auth.mfaSetup(user.id);
  }

  // Rate-limit estricto: verificar un código de 6 dígitos no debe poder
  // brute-forcearse. 10 intentos/min por IP.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('mfa/enable')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verificar primer código y activar 2FA' })
  @UsePipes(new ZodValidationPipe(mfaCodeSchema))
  mfaEnable(@CurrentUser() user: AuthUser, @Body() body: MfaCodeInput) {
    return this.auth.mfaEnable(user.id, body.code);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('mfa/disable')
  @HttpCode(200)
  @ApiOperation({ summary: 'Desactivar 2FA (requiere código)' })
  @UsePipes(new ZodValidationPipe(mfaCodeSchema))
  mfaDisable(@CurrentUser() user: AuthUser, @Body() body: MfaCodeInput) {
    return this.auth.mfaDisable(user.id, body.code);
  }
}
