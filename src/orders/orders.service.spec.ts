import { BadRequestException } from '@nestjs/common';
import { StatusPedido } from '@prisma/client';
import Decimal from 'decimal.js';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const tx = {
    $queryRaw: jest.fn(),
    produtoVariacao: {
      update: jest.fn(),
    },
  };

  const prisma = {
    endereco: {
      findFirst: jest.fn(),
    },
    produtoVariacao: {
      update: jest.fn(),
    },
    pedido: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(tx)),
  } as any;
  const paymentsService = {
    solicitarPagamento: jest.fn(),
    processarResultadoPagamento: jest.fn(),
  } as any;
  const mercadoPagoService = {
    criarPagamento: jest.fn(),
  } as any;
  const shippingService = {
    choose: jest.fn(),
  } as any;

  const service = new OrdersService(prisma, paymentsService, mercadoPagoService, shippingService);

  const endereco = {
    id: 'endereco-1',
    cep: '01310-000',
    rua: 'Av. Paulista',
    numero: '1000',
    complemento: null,
    bairro: 'Bela Vista',
    cidade: 'Sao Paulo',
    estado: 'SP',
  };

  const snapshotVariacao = {
    variacaoId: 'variacao-1',
    estoqueVariacao: new Decimal(10),
    produtoId: 'produto-1',
    unidadeMedida: 'UNIDADE',
    precoBase: new Decimal('50.00'),
    precoVariacao: null,
  };

  const dtoBase = {
    enderecoId: 'endereco-1',
    metodoPagamento: 'pix' as const,
    itens: [{ produtoVariacaoId: 'variacao-1', quantidade: '2' }],
  };

  const pagamentoDto = {
    paymentType: 'bank_transfer',
    selectedPaymentMethod: 'bank_transfer',
    formData: {
      payment_method_id: 'pix',
      transaction_amount: 0.01, // valor mandado pelo client, deve ser ignorado
      payer: { email: 'cliente@exemplo.com' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.endereco.findFirst.mockResolvedValue(endereco);
    prisma.pedido.findFirst.mockResolvedValue(null);
    tx.$queryRaw.mockResolvedValue([snapshotVariacao]);
    shippingService.choose.mockReturnValue({
      metodo: 'economico',
      transportadora: 'Correios',
      prazoDias: 7,
      valor: '15.00',
    });
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
      } as any),
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

  it('sem campo pagamento mantem o fluxo simulado existente (nao chama Mercado Pago)', async () => {
    prisma.pedido.create.mockResolvedValue({
      id: 'pedido-1',
      valorTotal: new Decimal('115.00'),
    });

    const result = await service.createOrder('user-1', dtoBase as any);

    expect(mercadoPagoService.criarPagamento).not.toHaveBeenCalled();
    expect(shippingService.choose).toHaveBeenCalledWith(
      endereco.cep,
      dtoBase.itens,
      undefined,
    );
    expect(paymentsService.solicitarPagamento).toHaveBeenCalledWith(
      expect.objectContaining({ pedidoId: 'pedido-1' }),
    );
    expect(result.id).toBe('pedido-1');
  });

  it('cria pedido pago quando o Mercado Pago aprova o pagamento', async () => {
    mercadoPagoService.criarPagamento.mockResolvedValue({
      id: 'mp-123',
      status: 'approved',
      statusDetail: 'accredited',
    });
    prisma.pedido.create.mockResolvedValue({
      id: 'pedido-novo',
      status: StatusPedido.PAGO,
      paymentId: 'mp-123',
    });

    const result = await service.createOrder('user-1', {
      ...dtoBase,
      pagamento: pagamentoDto,
    } as any);

    expect(mercadoPagoService.criarPagamento).toHaveBeenCalledWith(
      expect.objectContaining({ valorTotal: '115.00' }),
    );
    expect(prisma.pedido.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StatusPedido.PAGO,
          paymentId: 'mp-123',
        }),
      }),
    );
    expect(result.id).toBe('pedido-novo');
  });

  it('mantem pedido como PROCESSANDO quando pagamento pix fica pendente', async () => {
    mercadoPagoService.criarPagamento.mockResolvedValue({
      id: 'mp-456',
      status: 'pending',
      statusDetail: 'pending_waiting_transfer',
      qrCode: '00020126...',
    });
    prisma.pedido.create.mockResolvedValue({
      id: 'pedido-pix',
      status: StatusPedido.PROCESSANDO,
    });

    await service.createOrder('user-1', { ...dtoBase, pagamento: pagamentoDto } as any);

    expect(prisma.pedido.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: StatusPedido.PROCESSANDO }),
      }),
    );
  });

  it('nao cria pedido e restaura estoque quando o Mercado Pago recusa o pagamento', async () => {
    mercadoPagoService.criarPagamento.mockResolvedValue({
      id: 'mp-789',
      status: 'rejected',
      statusDetail: 'cc_rejected_insufficient_amount',
    });

    await expect(
      service.createOrder('user-1', { ...dtoBase, pagamento: pagamentoDto } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.pedido.create).not.toHaveBeenCalled();
    expect(prisma.produtoVariacao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'variacao-1' },
        data: { estoque: { increment: expect.anything() } },
      }),
    );
  });

  it('retorna o pedido ja existente em vez de duplicar, se o mesmo carrinho for reenviado na janela de dedup', async () => {
    const pedidoExistente = { id: 'pedido-original', valorTotal: new Decimal('115.00') };
    prisma.pedido.findFirst.mockResolvedValue(pedidoExistente);

    const result = await service.createOrder('user-1', dtoBase as any);

    expect(result).toBe(pedidoExistente);
    expect(prisma.endereco.findFirst).not.toHaveBeenCalled();
    expect(prisma.pedido.create).not.toHaveBeenCalled();
    expect(mercadoPagoService.criarPagamento).not.toHaveBeenCalled();
    expect(paymentsService.solicitarPagamento).not.toHaveBeenCalled();
  });

  it('usa o idempotencyKey do client quando informado, e repassa pro Mercado Pago', async () => {
    mercadoPagoService.criarPagamento.mockResolvedValue({
      id: 'mp-999',
      status: 'approved',
      statusDetail: 'accredited',
    });
    prisma.pedido.create.mockResolvedValue({ id: 'pedido-x' });

    await service.createOrder('user-1', {
      ...dtoBase,
      pagamento: pagamentoDto,
      idempotencyKey: 'chave-do-frontend-123',
    } as any);

    expect(prisma.pedido.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ requestFingerprint: 'chave-do-frontend-123' }),
      }),
    );
    expect(mercadoPagoService.criarPagamento).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'chave-do-frontend-123' }),
    );
  });
});
