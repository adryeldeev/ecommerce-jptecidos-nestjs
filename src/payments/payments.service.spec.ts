import { Prisma, StatusPedido } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const tx = {
    pedido: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    produtoVariacao: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  const prisma = {
    pedido: {
      update: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (innerTx: typeof tx) => unknown) => callback(tx)),
  } as any;

  const configService = {
    get: jest.fn(() => 'false'),
  } as any;

  const kafkaClient = {
    close: jest.fn(),
    connect: jest.fn(),
    emit: jest.fn(),
  } as any;

  const service = new PaymentsService(configService, prisma, kafkaClient);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('restaura estoque quando pagamento falha', async () => {
    tx.pedido.findUnique.mockResolvedValue({
      id: 'pedido-1',
      status: StatusPedido.PROCESSANDO,
      itens: [
        {
          produtoVariacaoId: 'var-1',
          quantidade: new Prisma.Decimal('2.000'),
        },
      ],
    });
    tx.produtoVariacao.findUnique.mockResolvedValue({
      estoque: new Prisma.Decimal('5.000'),
    });
    tx.pedido.update.mockResolvedValue({ id: 'pedido-1', status: StatusPedido.FALHOU });

    await service.processarResultadoPagamento({
      pedidoId: 'pedido-1',
      status: StatusPedido.FALHOU,
    });

    expect(tx.produtoVariacao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          estoque: new Prisma.Decimal('7'),
        },
      }),
    );
  });
});
