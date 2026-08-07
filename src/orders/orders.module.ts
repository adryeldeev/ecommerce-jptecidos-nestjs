import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderNotificationService } from './order-notification.service';
import { PaymentsModule } from '../payments/payments.module';
import { ShippingModule } from '../shipping/shipping.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PaymentsModule, ShippingModule, AuditModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderNotificationService],
})
export class OrdersModule {}
