import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { randomUUID } from 'crypto';

export type CriarPagamentoInput = {
  valorTotal: string;
  externalReference: string;
  formData: Record<string, any>;
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
    const config = new MercadoPagoConfig({
      accessToken: this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN') ?? '',
    });
    const payment = new Payment(config);
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
        requestOptions: { idempotencyKey: randomUUID() },
      });

      const transactionData = response.point_of_interaction?.transaction_data;

      return {
        id: String(response.id),
        status: response.status ?? 'pending',
        statusDetail: response.status_detail ?? '',
        qrCode: transactionData?.qr_code,
        qrCodeBase64: transactionData?.qr_code_base64,
        ticketUrl: transactionData?.ticket_url,
      };
    } catch (error) {
      const causas = (error as { causes?: Array<{ description?: string }> }).causes;
      const detalhe =
        causas?.[0]?.description ??
        (error instanceof Error ? error.message : 'Erro desconhecido ao processar pagamento.');
      this.logger.error(`Falha ao criar pagamento no Mercado Pago: ${detalhe}`);
      throw new Error(detalhe);
    }
  }
}
