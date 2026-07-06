import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const prisma = {
    endereco: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;
  const paymentsService = {
    solicitarPagamento: jest.fn(),
  } as any;

  const service = new OrdersService(prisma, paymentsService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exige paymentMethodId para pagamento com cartao', async () => {
    await expect(
      service.createOrder('user-1', {
        enderecoId: '6b6c88c6-5539-45c6-8c8c-555555555555',
        frete: '10.00',
        metodoPagamento: 'cartao',
        itens: [
          {
            produtoVariacaoId: '1f6db19d-7330-4e27-b774-666666666666',
            quantidade: '1.000',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
