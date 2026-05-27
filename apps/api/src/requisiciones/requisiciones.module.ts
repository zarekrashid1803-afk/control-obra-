import { Module } from '@nestjs/common';
import { RequisicionesController } from './requisiciones.controller';
import { RequisicionesService } from './requisiciones.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [RequisicionesService],
  controllers: [RequisicionesController],
  exports: [RequisicionesService],
})
export class RequisicionesModule {}
