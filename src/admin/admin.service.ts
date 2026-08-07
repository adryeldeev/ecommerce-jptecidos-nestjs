import { Injectable } from '@nestjs/common';
import { Prisma, StatusPedido } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

const DASHBOARD_DAYS_RANGE = 30;

type DailyRevenueRow = { dia: Date; total: Prisma.Decimal };
type DailyCountRow = { dia: Date; total: bigint };
type TopProductRow = { produtoId: string; titulo: string; totalVendido: Prisma.Decimal };

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics() {
    const lowStockThreshold = new Prisma.Decimal(10);
    const startOfRange = this.startOfDaysAgo(DASHBOARD_DAYS_RANGE - 1);

    const [
      totalOrders,
      ordersByStatus,
      productsCount,
      categoriesCount,
      customersCount,
      lowStockVariants,
      totalRevenue,
      revenueByDay,
      newCustomersByDay,
      topProducts,
    ] = await Promise.all([
      this.prisma.pedido.count(),
      this.prisma.pedido.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.produto.count(),
      this.prisma.categoria.count(),
      this.prisma.usuario.count(),
      this.prisma.produtoVariacao.count({
        where: { estoque: { lte: lowStockThreshold } },
      }),
      this.prisma.pedido.aggregate({
        _sum: { valorTotal: true },
        where: { status: StatusPedido.PAGO },
      }),
      this.prisma.$queryRaw<DailyRevenueRow[]>`
        SELECT date_trunc('day', "criadoEm") AS dia, COALESCE(SUM("valorTotal"), 0) AS total
        FROM "Pedido"
        WHERE status = 'PAGO' AND "criadoEm" >= ${startOfRange}
        GROUP BY dia
        ORDER BY dia
      `,
      this.prisma.$queryRaw<DailyCountRow[]>`
        SELECT date_trunc('day', "criadoEm") AS dia, COUNT(*) AS total
        FROM "Usuario"
        WHERE "criadoEm" >= ${startOfRange}
        GROUP BY dia
        ORDER BY dia
      `,
      this.prisma.$queryRaw<TopProductRow[]>`
        SELECT p.id AS "produtoId", p.titulo, SUM(ip.quantidade) AS "totalVendido"
        FROM "ItemPedido" ip
        INNER JOIN "ProdutoVariacao" pv ON pv.id = ip."produtoVariacaoId"
        INNER JOIN "Produto" p ON p.id = pv."produtoId"
        INNER JOIN "Pedido" pe ON pe.id = ip."pedidoId"
        WHERE pe.status = 'PAGO'
        GROUP BY p.id, p.titulo
        ORDER BY "totalVendido" DESC
        LIMIT 5
      `,
    ]);

    const byStatus = this.mapOrdersByStatus(ordersByStatus);

    return {
      orders: {
        total: totalOrders,
        byStatus,
        // pedidos que ainda precisam de atencao (nao finalizados nem cancelados) --
        // serve de "badge" de notificacao no proprio painel.
        aguardandoAtencao: byStatus.PENDENTE + byStatus.PROCESSANDO,
      },
      revenue: {
        paidTotal: totalRevenue._sum.valorTotal?.toString() ?? '0',
        last30Days: this.fillDailySeries(
          startOfRange,
          revenueByDay,
          (row) => row.total.toString(),
          '0',
        ),
      },
      catalog: {
        products: productsCount,
        categories: categoriesCount,
        lowStockVariations: lowStockVariants,
      },
      customers: {
        total: customersCount,
        newLast30Days: this.fillDailySeries(
          startOfRange,
          newCustomersByDay,
          (row) => Number(row.total),
          0,
        ),
      },
      topProducts: topProducts.map((row) => ({
        produtoId: row.produtoId,
        titulo: row.titulo,
        totalVendido: row.totalVendido.toString(),
      })),
    };
  }

  private startOfDaysAgo(days: number): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - days);
    return date;
  }

  private mapOrdersByStatus(
    rows: Array<{ status: StatusPedido; _count: { _all: number } }>,
  ): Record<StatusPedido, number> {
    const base = Object.fromEntries(
      Object.values(StatusPedido).map((status) => [status, 0]),
    ) as Record<StatusPedido, number>;

    for (const row of rows) {
      base[row.status] = row._count._all;
    }

    return base;
  }

  private fillDailySeries<T extends { dia: Date }, V>(
    startOfRange: Date,
    rows: T[],
    mapValue: (row: T) => V,
    emptyValue: V,
  ): Array<{ date: string; total: V }> {
    const byDay = new Map(rows.map((row) => [this.toDateKey(row.dia), mapValue(row)]));

    const series: Array<{ date: string; total: V }> = [];
    const cursor = new Date(startOfRange);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (cursor <= today) {
      const key = this.toDateKey(cursor);
      series.push({ date: key, total: byDay.get(key) ?? emptyValue });
      cursor.setDate(cursor.getDate() + 1);
    }

    return series;
  }

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
