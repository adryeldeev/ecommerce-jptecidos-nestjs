import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export type PedidoNotificacaoInput = {
  id: string;
  valorTotal: string;
  metodoPagamento: string;
  clienteEmail: string;
};

export type ItemPedidoEmail = {
  titulo: string;
  cor: string;
  quantidade: string;
  precoUnitario: string;
};

export type ConfirmacaoPedidoInput = {
  id: string;
  clienteEmail: string;
  itens: ItemPedidoEmail[];
  subtotal: string;
  frete: string;
  freteTransportadora: string;
  fretePrazoDias: number;
  valorTotal: string;
  metodoPagamento: string;
  enderecoEntrega: {
    rua: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  };
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

  /**
   * Nunca lanca erro -- falha ao enviar a confirmacao nao pode derrubar a
   * criacao do pedido. Se RESEND_API_KEY nao estiver configurada, so
   * registra um aviso e sai (nao bloqueia nada).
   */
  async enviarConfirmacaoParaCliente(
    pedido: ConfirmacaoPedidoInput,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY nao configurada -- confirmacao de pedido nao enviada ao cliente.',
      );
      return;
    }

    const remetente = this.configService.get<string>('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';

    const linhasItens = pedido.itens
      .map(
        (item) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${item.titulo} (${item.cor})</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantidade}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">R$ ${item.precoUnitario}</td>
          </tr>`,
      )
      .join('');

    const endereco = pedido.enderecoEntrega;
    const enderecoFormatado = `${endereco.rua}, ${endereco.numero}${endereco.complemento ? ` - ${endereco.complemento}` : ''} - ${endereco.bairro}, ${endereco.cidade}/${endereco.estado} - CEP ${endereco.cep}`;

    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: remetente,
        to: pedido.clienteEmail,
        subject: `Confirmacao do seu pedido - R$ ${pedido.valorTotal}`,
        html: `
          <p>Recebemos seu pedido e ja estamos processando.</p>
          <p><strong>Numero do pedido:</strong> ${pedido.id}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #333;">Item</th>
                <th style="text-align:center;padding:8px;border-bottom:2px solid #333;">Qtd</th>
                <th style="text-align:right;padding:8px;border-bottom:2px solid #333;">Preco unit.</th>
              </tr>
            </thead>
            <tbody>${linhasItens}</tbody>
          </table>
          <ul>
            <li><strong>Subtotal:</strong> R$ ${pedido.subtotal}</li>
            <li><strong>Frete (${pedido.freteTransportadora}, ${pedido.fretePrazoDias} dia(s) uteis):</strong> R$ ${pedido.frete}</li>
            <li><strong>Total:</strong> R$ ${pedido.valorTotal}</li>
            <li><strong>Metodo de pagamento:</strong> ${pedido.metodoPagamento}</li>
          </ul>
          <p><strong>Endereco de entrega:</strong><br/>${enderecoFormatado}</p>
        `,
      });

      if (error) {
        this.logger.error(
          `Resend recusou o envio da confirmacao de pedido ao cliente: ${error.message}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Falha ao enviar confirmacao de pedido ao cliente por e-mail: ${(error as Error).message}`,
      );
    }
  }
}
