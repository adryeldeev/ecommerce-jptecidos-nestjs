import { Body, Controller, Post } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { QuoteShippingDto } from './dto/quote-shipping.dto';

@Controller('fretes')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('cotacao')
  async quote(@Body() dto: QuoteShippingDto) {
    const options = await this.shippingService.quote(dto.cep, dto.itens);
    const selected =
      options.find((option) => option.metodo === (dto.metodo ?? 'economico')) ?? options[0];

    return { options, selected };
  }
}
