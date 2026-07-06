import { Body, Controller, Post } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { QuoteShippingDto } from './dto/quote-shipping.dto';

@Controller('fretes')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('cotacao')
  quote(@Body() dto: QuoteShippingDto) {
    return {
      options: this.shippingService.quote(dto),
      selected: this.shippingService.choose(dto),
    };
  }
}
