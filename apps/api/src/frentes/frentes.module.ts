import { Module } from '@nestjs/common';
import { FrentesController } from './frentes.controller';
import { FrentesService } from './frentes.service';

@Module({
  providers: [FrentesService],
  controllers: [FrentesController],
  exports: [FrentesService],
})
export class FrentesModule {}
