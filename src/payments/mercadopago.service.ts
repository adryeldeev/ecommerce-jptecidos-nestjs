import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Payment } from 'mercadopago';

// Estrutura minima que a gente le da resposta da API (tanto create quanto
// get retornam o mesmo formato de pagamento).
type PaymentApiResponse = {
  id?: number | string;
  status?: string;
  status_detail?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

export type CriarPagamentoInput = {
  valorTotal: string;
  externalReference: string;
  formData: Record<string, any>;
  // Deve ser estavel por tentativa logica de checkout (nao gerado a esmo a
  // cada chamada), senao o Mercado Pago nao consegue deduplicar requisicoes
  // repetidas (ex: duplo clique) e processa cada uma como cobranca separada.
  idempotencyKey: string;
};

export type CriarPagamentoResultado = {
  id: string;
  status: string;
  statusDetail: string;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
};

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);

  constructor(private readonly configService: ConfigService) {}

  async criarPagamento(input: CriarPagamentoInput): Promise<CriarPagamentoResultado> {
    const payment = this.criarClientePagamento();
    const { formData } = input;

    try {
      const response = await payment.create({
        body: {
          transaction_amount: Number(input.valorTotal),
          description: 'Pedido JP Tecidos',
          external_reference: input.externalReference,
          payment_method_id: formData?.payment_method_id,
          token: formData?.token,
          installments:
            formData?.installments !== undefined ? Number(formData.installments) : undefined,
          issuer_id:
            formData?.issuer_id !== undefined ? Number(formData.issuer_id) : undefined,
          payer: formData?.payer,
        },
        requestOptions: { idempotencyKey: input.idempotencyKey },
      });

      return this.mapearResposta(response);
    } catch (error) {
      throw new Error(this.extrairMensagemErro(error));
    }
  }

  /**
   * Busca o status atual de um pagamento direto na API do Mercado Pago.
   * Usado pelo webhook -- a notificacao em si nunca e confiada como fonte de
   * verdade, ela so avisa QUAL pagamento conferir; o status real vem sempre
   * dessa chamada, autenticada com nosso proprio access token.
   */
  async buscarPagamento(mercadoPagoPaymentId: string): Promise<CriarPagamentoResultado> {
    const payment = this.criarClientePagamento();

    try {
      const response = await payment.get({ id: mercadoPagoPaymentId });
      return this.mapearResposta(response);
    } catch (error) {
      throw new Error(this.extrairMensagemErro(error));
    }
  }

  private criarClientePagamento(): Payment {
    const config = new MercadoPagoConfig({
      accessToken: this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN') ?? '',
    });
    return new Payment(config);
  }

  private mapearResposta(response: PaymentApiResponse): CriarPagamentoResultado {
    const transactionData = response.point_of_interaction?.transaction_data;

    return {
      id: String(response.id),
      status: response.status ?? 'pending',
      statusDetail: response.status_detail ?? '',
      qrCode: transactionData?.qr_code,
      qrCodeBase64: transactionData?.qr_code_base64,
      ticketUrl: transactionData?.ticket_url,
    };
  }

  private extrairMensagemErro(error: unknown): string {
    const causas = (error as { causes?: Array<{ description?: string }> })?.causes;
    const detalhe =
      causas?.[0]?.description ??
      (error instanceof Error ? error.message : 'Erro desconhecido ao processar pagamento.');
    this.logger.error(`Falha na chamada ao Mercado Pago: ${detalhe}`);
    return detalhe;
  }
}
