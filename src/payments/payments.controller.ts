import { Body, Controller, HttpCode, Logger, Post, Query } from '@nestjs/common';
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

  /**
   * Endpoint publico (o Mercado Pago chama de fora, sem autenticacao nossa).
   * Nao ha guard nem validacao de assinatura de proposito: a notificacao
   * nunca e confiada como fonte de verdade, ela so diz qual pagamento
   * conferir -- PaymentsService.confirmarPagamentoPorWebhook sempre rebusca
   * o status direto na API do Mercado Pago antes de mudar qualquer coisa.
   * Sempre responde 200 pra confirmar recebimento; erros inesperados viram
   * 500 de proposito, pra que o Mercado Pago tente de novo depois.
   */
  @Post('webhooks/mercadopago')
  @HttpCode(200)
  async mercadoPagoWebhook(
    @Body() body: Record<string, any>,
    @Query() query: Record<string, any>,
  ) {
    const type = body?.type ?? query?.type;
    const paymentId = body?.data?.id ?? query?.['data.id'];

    if (type === 'payment' && paymentId) {
      await this.paymentsService.confirmarPagamentoPorWebhook(String(paymentId));
    }

    return { received: true };
  }
}
