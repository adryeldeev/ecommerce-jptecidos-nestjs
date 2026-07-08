import { Injectable } from '@nestjs/common';
import { Prisma, StatusPedido } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics() {
    const lowStockThreshold = new Prisma.Decimal(10);

    const [
      totalOrders,
      paidOrders,
      openOrders,
      productsCount,
      categoriesCount,
      customersCount,
      lowStockVariants,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.pedido.count(),
      this.prisma.pedido.count({ where: { status: StatusPedido.PAGO } }),
      this.prisma.pedido.count({
        where: {
          status: {
            in: [StatusPedido.PENDENTE, StatusPedido.PROCESSANDO],
          },
        },
      }),
      this.prisma.produto.count(),
      this.prisma.categoria.count(),
      this.prisma.usuario.count(),
      this.prisma.produtoVariacao.count({
        where: {
          estoque: {
            lte: lowStockThreshold,
          },
        },
      }),
      this.prisma.pedido.aggregate({
        _sum: {
          valorTotal: true,
        },
        where: {
          status: StatusPedido.PAGO,
        },
      }),
    ]);

    return {
      orders: {
        total: totalOrders,
        paid: paidOrders,
        open: openOrders,
      },
      revenue: {
        paidTotal: totalRevenue._sum.valorTotal?.toString() ?? '0',
      },
      catalog: {
        products: productsCount,
        categories: categoriesCount,
        lowStockVariations: lowStockVariants,
      },
      customers: {
        total: customersCount,
      },
    };
  }
}
