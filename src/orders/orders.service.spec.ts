import { BadRequestException } from '@nestjs/common';
import { StatusPedido } from '@prisma/client';
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
    processarResultadoPagamento: jest.fn(),
  } as any;
  const shippingService = {
    choose: jest.fn(),
  } as any;

  const service = new OrdersService(prisma, paymentsService, shippingService);

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

  it('atualiza status manual de pedido via fluxo de pagamento', async () => {
    paymentsService.processarResultadoPagamento.mockResolvedValue({
      id: 'pedido-1',
      status: StatusPedido.ENVIADO,
    });

    const result = await service.updateOrderStatus('pedido-1', StatusPedido.ENVIADO);

    expect(paymentsService.processarResultadoPagamento).toHaveBeenCalledWith({
      pedidoId: 'pedido-1',
      status: StatusPedido.ENVIADO,
    });
    expect(result.status).toBe(StatusPedido.ENVIADO);
  });
});
