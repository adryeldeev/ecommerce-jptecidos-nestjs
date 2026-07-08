import { Prisma, StatusPedido } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const prisma = {
    pedido: {
      count: jest.fn(),
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
  } as any;

  const service = new AdminService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna metricas basicas do dashboard', async () => {
    prisma.pedido.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(2);
    prisma.produto.count.mockResolvedValue(20);
    prisma.categoria.count.mockResolvedValue(5);
    prisma.usuario.count.mockResolvedValue(14);
    prisma.produtoVariacao.count.mockResolvedValue(3);
    prisma.pedido.aggregate.mockResolvedValue({
      _sum: {
        valorTotal: new Prisma.Decimal('1234.56'),
      },
    });

    const result = await service.getDashboardMetrics();

    expect(prisma.pedido.count).toHaveBeenNthCalledWith(2, {
      where: { status: StatusPedido.PAGO },
    });
    expect(result).toEqual({
      orders: {
        total: 12,
        paid: 9,
        open: 2,
      },
      revenue: {
        paidTotal: '1234.56',
      },
      catalog: {
        products: 20,
        categories: 5,
        lowStockVariations: 3,
      },
      customers: {
        total: 14,
      },
    });
  });
});