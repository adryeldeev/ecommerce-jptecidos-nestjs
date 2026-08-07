import { Prisma, StatusPedido } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const prisma = {
    pedido: {
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    produto: {
      count: jest.fn(),
    },
    categoria: {
      count: jest.fn(),
    },
    usuario: {
      count: jest.fn(),
    },
    produtoVariacao: {
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  } as any;

  const service = new AdminService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna metricas do dashboard com series diarias preenchidas', async () => {
    prisma.pedido.count.mockResolvedValue(12);
    prisma.pedido.groupBy.mockResolvedValue([
      { status: StatusPedido.PAGO, _count: { _all: 9 } },
      { status: StatusPedido.PENDENTE, _count: { _all: 2 } },
      { status: StatusPedido.CANCELADO, _count: { _all: 1 } },
    ]);
    prisma.produto.count.mockResolvedValue(20);
    prisma.categoria.count.mockResolvedValue(5);
    prisma.usuario.count.mockResolvedValue(14);
    prisma.produtoVariacao.count.mockResolvedValue(3);
    prisma.pedido.aggregate.mockResolvedValue({
      _sum: { valorTotal: new Prisma.Decimal('1234.56') },
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    prisma.$queryRaw
      .mockResolvedValueOnce([{ dia: hoje, total: new Prisma.Decimal('500.00') }])
      .mockResolvedValueOnce([{ dia: hoje, total: 3n }])
      .mockResolvedValueOnce([
        { produtoId: 'produto-1', titulo: 'Jeans Pesado', totalVendido: new Prisma.Decimal('12.500') },
      ]);

    const result = await service.getDashboardMetrics();

    expect(prisma.pedido.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      _count: { _all: true },
    });
    expect(result.orders).toEqual({
      total: 12,
      byStatus: {
        PENDENTE: 2,
        PROCESSANDO: 0,
        PAGO: 9,
        FALHOU: 0,
        CANCELADO: 1,
        ENVIADO: 0,
        ENTREGUE: 0,
      },
      aguardandoAtencao: 2,
    });
    expect(result.revenue.paidTotal).toBe('1234.56');
    expect(result.revenue.last30Days).toHaveLength(30);
    expect(result.revenue.last30Days.at(-1)).toEqual({
      date: hoje.toISOString().slice(0, 10),
      total: '500',
    });
    expect(result.catalog).toEqual({
      products: 20,
      categories: 5,
      lowStockVariations: 3,
    });
    expect(result.customers.total).toBe(14);
    expect(result.customers.newLast30Days).toHaveLength(30);
    expect(result.customers.newLast30Days.at(-1)).toEqual({
      date: hoje.toISOString().slice(0, 10),
      total: 3,
    });
    expect(result.topProducts).toEqual([
      { produtoId: 'produto-1', titulo: 'Jeans Pesado', totalVendido: '12.5' },
    ]);
  });
});
