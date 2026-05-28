import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

// BigInt serialization in JSON responses
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Fail-fast: en producción NUNCA arrancar con un JWT_SECRET ausente o con el
// default de desarrollo. Sin esto, un deploy sin la env var firmaría tokens
// con un secreto conocido → cualquiera podría falsificar sesiones.
function assertProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret === 'dev-secret-change-me') {
    throw new Error(
      'JWT_SECRET ausente, demasiado corto (<32) o usando el default de dev. ' +
        'Configurar un secreto fuerte en las env vars de producción antes de arrancar.',
    );
  }
}

async function bootstrap() {
  assertProductionSecrets();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Headers de seguridad (HSTS, X-Content-Type-Options, noSniff, etc.).
  // crossOriginResourcePolicy desactivado: la API responde a un front en otro
  // origen (Vercel) y el CORS ya controla qué orígenes pueden leer.
  app.use(helmet({ crossOriginResourcePolicy: false }));

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

  // Swagger / OpenAPI — solo fuera de producción. En prod exponer el mapa
  // completo de la API (todos los endpoints y schemas) es regalarle
  // reconocimiento a un atacante. Habilitable con ENABLE_SWAGGER=true si hace falta.
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Control de Obra · API')
      .setDescription('Sistema Integral de Gestión y Control de Obra')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${prefix}/docs`, app, doc);
  }

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
