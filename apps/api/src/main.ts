import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

// BigInt serialization in JSON responses
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const prefix = process.env.API_PREFIX || '/api/v1';
  app.setGlobalPrefix(prefix);

  // CORS — soporta múltiples orígenes separados por coma + previews de Vercel (*.vercel.app)
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);
      // Match exacto
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Match wildcard *.vercel.app para preview deploys
      if (allowedOrigins.some((o) => o === '*.vercel.app') && origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      callback(new Error(`CORS bloqueó origen: ${origin}`));
    },
    credentials: true,
  });

  // Validación: usamos ZodValidationPipe per-route, no necesitamos ValidationPipe global

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Control de Obra · API')
    .setDescription('Sistema Integral de Gestión y Control de Obra')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${prefix}/docs`, app, doc);

  // Puerto: Render usa env PORT. Fallback API_PORT para compatibilidad local.
  const port = Number(process.env.PORT) || Number(process.env.API_PORT) || 3001;
  await app.listen(port, '0.0.0.0');

  // eslint-disable-next-line no-console
  console.log(`\n  ▸ API escuchando en :${port}${prefix}`);
  // eslint-disable-next-line no-console
  console.log(`  ▸ Docs:  ${prefix}/docs`);
  // eslint-disable-next-line no-console
  console.log(`  ▸ CORS origins: ${allowedOrigins.join(', ')}\n`);
}

bootstrap();
