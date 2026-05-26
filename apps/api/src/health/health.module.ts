import { Controller, Get, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    let db = 'unknown';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'ok';
    } catch (e: any) {
      db = `error: ${e.message}`;
    }
    return {
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      services: { db },
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
