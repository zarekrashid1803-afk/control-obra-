import { Module } from '@nestjs/common';
import { MaterialesController } from './materiales.controller';
import { MaterialesService } from './materiales.service';

@Module({
  providers: [MaterialesService],
  controllers: [MaterialesController],
  exports: [MaterialesService],
})
export class MaterialesModule {}
