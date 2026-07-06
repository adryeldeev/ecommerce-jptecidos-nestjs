import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentsService } from './payments.service';
import type { PaymentResultMessageDto } from './dto/payment-result-message.dto';

@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @MessagePattern('pagamento.processado')
  async paymentProcessed(@Payload() message: PaymentResultMessageDto) {
    this.logger.log(`Resultado de pagamento recebido para pedido ${message.pedidoId}`);
    return this.paymentsService.processarResultadoPagamento(message);
  }
}
