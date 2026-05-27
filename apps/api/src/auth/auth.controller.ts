import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Ip,
  Post,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { loginSchema, refreshSchema, changePasswordSchema, LoginInput, RefreshInput, ChangePasswordInput } from '@control-obra/shared';
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
}
