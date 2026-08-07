import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export type PedidoNotificacaoInput = {
  id: string;
  valorTotal: string;
  metodoPagamento: string;
  clienteEmail: string;
};

@Injectable()
export class OrderNotificationService {
  private readonly logger = new Logger(OrderNotificationService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Nunca lanca erro -- falha ao notificar nao pode derrubar a criacao do
   * pedido. Se as variaveis de ambiente nao estiverem configuradas, so
   * registra um aviso e sai (nao bloqueia nada).
   */
  async notificarPedidoNovo(pedido: PedidoNotificacaoInput): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const destinatario =
      this.configService.get<string>('NOTIFICATION_EMAIL') ??
      this.configService.get<string>('ADMIN_EMAIL');

    if (!apiKey || !destinatario) {
      this.logger.warn(
        'RESEND_API_KEY ou e-mail de destino (NOTIFICATION_EMAIL/ADMIN_EMAIL) nao configurados -- notificacao de pedido novo nao enviada.',
      );
      return;
    }

    const remetente = this.configService.get<string>('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';

    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: remetente,
        to: destinatario,
        subject: `Novo pedido recebido - R$ ${pedido.valorTotal}`,
        html: `
          <p>Um novo pedido acabou de ser criado na loja.</p>
          <ul>
            <li><strong>Pedido:</strong> ${pedido.id}</li>
            <li><strong>Valor total:</strong> R$ ${pedido.valorTotal}</li>
            <li><strong>Metodo de pagamento:</strong> ${pedido.metodoPagamento}</li>
            <li><strong>Cliente:</strong> ${pedido.clienteEmail}</li>
          </ul>
        `,
      });

      if (error) {
        this.logger.error(`Resend recusou o envio da notificacao de pedido novo: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(
        `Falha ao enviar notificacao de pedido novo por e-mail: ${(error as Error).message}`,
      );
    }
  }
}
