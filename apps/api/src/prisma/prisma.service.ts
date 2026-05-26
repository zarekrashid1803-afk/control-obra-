import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('  ▸ DB conectada');
    } catch (err: any) {
      console.warn(`  ⚠ DB no conectada (modo demo): ${err.message?.split('\n')[0]}`);
      console.warn('  ⚠ Los endpoints que consultan datos fallarán. Configurar DATABASE_URL en .env.');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
