import { Module } from '@nestjs/common';
import { RequisicionesController } from './requisiciones.controller';
import { RequisicionesService } from './requisiciones.service';

@Module({
  providers: [RequisicionesService],
  controllers: [RequisicionesController],
  exports: [RequisicionesService],
})
export class RequisicionesModule {}
