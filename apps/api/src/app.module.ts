import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { FrentesModule } from './frentes/frentes.module';
import { MaterialesModule } from './materiales/materiales.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { RequisicionesModule } from './requisiciones/requisiciones.module';
import { OrdenesCompraModule } from './ordenes-compra/ordenes-compra.module';
import { CajaModule } from './caja/caja.module';
import { BodegaModule } from './bodega/bodega.module';
import { InventarioModule } from './inventario/inventario.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { DocumentosSoporteModule } from './documentos-soporte/documentos-soporte.module';
import { AdjuntosModule } from './adjuntos/adjuntos.module';
import { ReportesModule } from './reportes/reportes.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env', '../.env'],
    }),
    // Rate-limit global. Default: 60 req/min por IP en TODA la API.
    // Endpoints sensibles overridean con @Throttle({...}) más estricto.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.LOG_PRETTY === 'true'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
      },
    }),

    PrismaModule,
    AuthModule,
    UsuariosModule,
    FrentesModule,
    MaterialesModule,
    ProveedoresModule,
    RequisicionesModule,
    OrdenesCompraModule,
    CajaModule,
    BodegaModule,
    InventarioModule,
    AuditModule,
    HealthModule,
    DocumentosSoporteModule,
    AdjuntosModule,
    ReportesModule,
    PromoCodesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
