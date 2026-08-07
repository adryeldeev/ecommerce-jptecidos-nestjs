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
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (innerTx: typeof tx) => unknown) => callback(tx)),
  } as any;

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'KAFKA_ENABLED') {
        return 'false';
      }

      return undefined;
    }),
  } as any;

  const auditService = {
    record: jest.fn(),
  } as any;

  const kafkaClient = {
    close: jest.fn(),
    connect: jest.fn(),
    emit: jest.fn(),
  } as any;

  const mercadoPagoService = {
    buscarPagamento: jest.fn(),
  } as any;

  const service = new PaymentsService(
    configService,
    prisma,
    auditService,
    mercadoPagoService,
    kafkaClient,
  );

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

  it('aprova pagamento localmente quando kafka está desativado', async () => {
    prisma.pedido.update.mockResolvedValue({ id: 'pedido-1', status: StatusPedido.PAGO });

    const result = await service.solicitarPagamento({
      pedidoId: 'pedido-1',
      usuarioId: 'user-1',
      valorTotal: '39.90',
      metodoPagamento: 'cartao',
      paymentMethodId: 'mp_123',
      paymentProvider: 'mercadopago',
    });

    expect(prisma.pedido.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pedido-1' },
        data: { status: StatusPedido.PAGO },
      }),
    );
    expect(result).toEqual({ id: 'pedido-1', status: StatusPedido.PAGO });
  });

  describe('confirmarPagamentoPorWebhook', () => {
    it('busca o status real na API e atualiza o pedido, ignorando o payload da notificacao', async () => {
      mercadoPagoService.buscarPagamento.mockResolvedValue({
        id: 'mp-1',
        status: 'approved',
        statusDetail: 'accredited',
      });
      prisma.pedido.findFirst.mockResolvedValue({
        id: 'pedido-1',
        status: StatusPedido.PROCESSANDO,
      });
      tx.pedido.findUnique.mockResolvedValue({
        id: 'pedido-1',
        status: StatusPedido.PROCESSANDO,
        itens: [],
      });
      tx.pedido.update.mockResolvedValue({ id: 'pedido-1', status: StatusPedido.PAGO });

      await service.confirmarPagamentoPorWebhook('mp-1');

      expect(mercadoPagoService.buscarPagamento).toHaveBeenCalledWith('mp-1');
      expect(prisma.pedido.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { paymentId: 'mp-1' } }),
      );
      expect(tx.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: StatusPedido.PAGO } }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'payment.webhookConfirmado' }),
      );
    });

    it('nao faz nada se nenhum pedido tiver esse paymentId', async () => {
      mercadoPagoService.buscarPagamento.mockResolvedValue({
        id: 'mp-desconhecido',
        status: 'approved',
        statusDetail: 'accredited',
      });
      prisma.pedido.findFirst.mockResolvedValue(null);

      await service.confirmarPagamentoPorWebhook('mp-desconhecido');

      expect(tx.pedido.update).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('nao faz nada se o status do Mercado Pago nao for reconhecido', async () => {
      mercadoPagoService.buscarPagamento.mockResolvedValue({
        id: 'mp-2',
        status: 'in_mediation',
        statusDetail: '',
      });
      prisma.pedido.findFirst.mockResolvedValue({ id: 'pedido-2', status: StatusPedido.PROCESSANDO });

      await service.confirmarPagamentoPorWebhook('mp-2');

      expect(tx.pedido.update).not.toHaveBeenCalled();
    });

    it('nao reprocessa se o pedido ja estiver no status correspondente', async () => {
      mercadoPagoService.buscarPagamento.mockResolvedValue({
        id: 'mp-3',
        status: 'approved',
        statusDetail: 'accredited',
      });
      prisma.pedido.findFirst.mockResolvedValue({ id: 'pedido-3', status: StatusPedido.PAGO });

      await service.confirmarPagamentoPorWebhook('mp-3');

      expect(tx.pedido.update).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });
});
