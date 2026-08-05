import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const FRENET_QUOTE_URL = 'https://api.frenet.com.br/shipping/quote';

export type FrenetShippingItem = {
  weightKg: number;
  lengthCm: number;
  heightCm: number;
  widthCm: number;
  quantity: number;
};

export type FrenetQuoteInput = {
  recipientCep: string;
  invoiceValue: string;
  itens: FrenetShippingItem[];
};

export type FrenetCarrierQuote = {
  carrier: string;
  serviceDescription: string;
  serviceCode: string;
  price: number;
  deliveryDays: number;
};

type FrenetShippingServiceResponse = {
  Carrier: string;
  ServiceDescription: string;
  ServiceCode: string;
  ShippingPrice: string;
  DeliveryTime: string;
  Error: boolean;
  Msg?: string;
};

type FrenetQuoteResponse = {
  ShippingSevicesArray: FrenetShippingServiceResponse[];
};

@Injectable()
export class FrenetService {
  private readonly logger = new Logger(FrenetService.name);

  constructor(private readonly configService: ConfigService) {}

  async cotar(input: FrenetQuoteInput): Promise<FrenetCarrierQuote[]> {
    const sellerCep = this.configService.get<string>('FRENET_SELLER_CEP') ?? '';
    const token = this.configService.get<string>('FRENET_TOKEN') ?? '';

    let response: Response;
    try {
      response = await fetch(FRENET_QUOTE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          token,
        },
        body: JSON.stringify({
          SellerCEP: sellerCep.replace(/\D/g, ''),
          RecipientCEP: input.recipientCep.replace(/\D/g, ''),
          ShipmentInvoiceValue: Number(input.invoiceValue),
          ShippingItemArray: input.itens.map((item) => ({
            Weight: item.weightKg,
            Length: item.lengthCm,
            Height: item.heightCm,
            Width: item.widthCm,
            Quantity: item.quantity,
          })),
        }),
      });
    } catch (error) {
      this.logger.error(`Falha de rede ao consultar frete na Frenet: ${(error as Error).message}`);
      throw new InternalServerErrorException('Nao foi possivel calcular o frete no momento.');
    }

    if (!response.ok) {
      this.logger.error(`Frenet retornou HTTP ${response.status} ao cotar frete.`);
      throw new InternalServerErrorException('Nao foi possivel calcular o frete no momento.');
    }

    const data = (await response.json()) as FrenetQuoteResponse;

    return (data.ShippingSevicesArray ?? [])
      .filter((service) => !service.Error)
      .map((service) => ({
        carrier: service.Carrier,
        serviceDescription: service.ServiceDescription,
        serviceCode: service.ServiceCode,
        price: Number(service.ShippingPrice),
        deliveryDays: Number(service.DeliveryTime),
      }));
  }
}
