import { Module } from '@nestjs/common';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { FrenetService } from './frenet.service';

@Module({
  controllers: [ShippingController],
  providers: [ShippingService, FrenetService],
  exports: [ShippingService],
})
export class ShippingModule {}
