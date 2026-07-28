import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatusPedido, UnidadeMedida } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentsService } from '../payments/payments.service';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { ShippingService } from '../shipping/shipping.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly shippingService: ShippingService,
  ) {}

  async createOrder(usuarioId: string, dto: CreateOrderDto) {
    const metodoPagamentoNormalizado = dto.metodoPagamento.toLowerCase().trim();
    const usaCartao = metodoPagamentoNormalizado === 'cartao';
    const paymentProvider = usaCartao
      ? (dto.paymentProvider?.toLowerCase().trim() ?? 'mercadopago')
      : undefined;

    if (usaCartao && !dto.paymentMethodId) {
      throw new BadRequestException(
        'paymentMethodId e obrigatorio para pagamento com cartao.',
      );
    }

    if (usaCartao && paymentProvider !== 'mercadopago') {
      throw new BadRequestException(
        'paymentProvider invalido para cartao. Use mercadopago.',
      );
    }

    const endereco = await this.prisma.endereco.findFirst({
      where: {
        id: dto.enderecoId,
        usuarioId,
      },
      select: {
        id: true,
        cep: true,
        rua: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        estado: true,
      },
    });

    if (!endereco) {
      throw new NotFoundException('Endereco nao encontrado para o usuario.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const itensCarrinho = [] as Array<{
        produtoVariacaoId: string;
        quantidade: Decimal;
        precoUnitario: Decimal;
      }>;

      let subtotal = new Decimal(0);

      for (const item of dto.itens) {
        const quantidade = new Decimal(item.quantidade);
        if (quantidade.lte(0)) {
          throw new BadRequestException('Quantidade deve ser maior que zero.');
        }

        // Lock pessimista para estoque da variacao.
        const [snapshot] = await tx.$queryRaw<
          Array<{
            variacaoId: string;
            estoqueVariacao: Prisma.Decimal;
            produtoId: string;
            unidadeMedida: UnidadeMedida;
            precoBase: Prisma.Decimal;
            precoVariacao: Prisma.Decimal | null;
          }>
        >`
          SELECT
            v.id AS "variacaoId",
            v.estoque AS "estoqueVariacao",
            v.preco AS "precoVariacao",
            p.id AS "produtoId",
            p."unidadeMedida" AS "unidadeMedida",
            p."precoBase" AS "precoBase"
          FROM "ProdutoVariacao" v
          INNER JOIN "Produto" p ON p.id = v."produtoId"
          WHERE v.id = ${item.produtoVariacaoId}
          FOR UPDATE
        `;

        if (!snapshot) {
          throw new NotFoundException(
            `Variacao ${item.produtoVariacaoId} nao encontrada.`,
          );
        }

        if (
          snapshot.unidadeMedida === UnidadeMedida.KG &&
          quantidade.lt(new Decimal(5))
        ) {
          throw new BadRequestException(
            'Quantidade minima para produtos em KG e 5.',
          );
        }

        const estoqueVariacaoAtual = new Decimal(snapshot.estoqueVariacao.toString());
        if (estoqueVariacaoAtual.lt(quantidade)) {
          throw new BadRequestException(
            `Estoque insuficiente para a variacao ${item.produtoVariacaoId}.`,
          );
        }

        const precoVariacao = snapshot.precoVariacao
          ? new Decimal(snapshot.precoVariacao.toString())
          : null;
        const precoUnitario = precoVariacao
          ? precoVariacao
          : new Decimal(snapshot.precoBase.toString());
        subtotal = subtotal.plus(precoUnitario.mul(quantidade));

        await tx.produtoVariacao.update({
          where: { id: item.produtoVariacaoId },
          data: {
            estoque: new Prisma.Decimal(
              Decimal.max(0, estoqueVariacaoAtual.minus(quantidade)).toString(),
            ),
          },
        });

        itensCarrinho.push({
          produtoVariacaoId: item.produtoVariacaoId,
          quantidade,
          precoUnitario,
        });
      }

      const shippingSelected = this.shippingService.choose({
        cep: endereco.cep,
        subtotal: subtotal.toFixed(2),
        metodo: dto.freteMetodo as 'economico' | 'express' | undefined,
        estado: endereco.estado,
      });

      const frete = new Decimal(shippingSelected.valor);
      const total = subtotal.plus(frete).toDecimalPlaces(2);

      const pedido = await tx.pedido.create({
        data: {
          usuarioId,
          enderecoId: endereco.id,
          status: StatusPedido.PROCESSANDO,
          metodoPagamento: metodoPagamentoNormalizado,
          paymentProvider,
          paymentMethodId: dto.paymentMethodId,
          freteMetodo: shippingSelected.metodo,
          freteTransportadora: shippingSelected.transportadora,
          fretePrazoDias: shippingSelected.prazoDias,
          cepEntrega: endereco.cep,
          ruaEntrega: endereco.rua,
          numeroEntrega: endereco.numero,
          complementoEntrega: endereco.complemento,
          bairroEntrega: endereco.bairro,
          cidadeEntrega: endereco.cidade,
          estadoEntrega: endereco.estado,
          frete: new Prisma.Decimal(frete.toFixed(2)),
          valorTotal: new Prisma.Decimal(total.toFixed(2)),
          itens: {
            create: itensCarrinho.map((i) => ({
              produtoVariacaoId: i.produtoVariacaoId,
              quantidade: new Prisma.Decimal(i.quantidade.toFixed(3)),
              precoUnitario: new Prisma.Decimal(i.precoUnitario.toFixed(2)),
            })),
          },
        },
        include: {
          itens: true,
        },
      });

      return pedido;
    });

    await this.paymentsService.solicitarPagamento({
      pedidoId: result.id,
      usuarioId,
      valorTotal: result.valorTotal.toString(),
      metodoPagamento: metodoPagamentoNormalizado,
      paymentMethodId: dto.paymentMethodId,
      paymentProvider,
    });

    return result;
  }

  async listUserOrders(usuarioId: string, query: ListOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildOrdersWhere({
      usuarioId,
      status: query.status,
      metodoPagamento: query.metodoPagamento,
      criadoDe: query.criadoDe,
      criadoAte: query.criadoAte,
    });

    const [items, total] = await Promise.all([
      this.prisma.pedido.findMany({
        where,
        include: {
          itens: {
            include: {
              produtoVariacao: {
                include: {
                  produto: {
                    include: {
                      categoria: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pedido.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listAdminOrders(query: ListOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildOrdersWhere({
      status: query.status,
      metodoPagamento: query.metodoPagamento,
      criadoDe: query.criadoDe,
      criadoAte: query.criadoAte,
      emailCliente: query.emailCliente,
    });

    const [items, total] = await Promise.all([
      this.prisma.pedido.findMany({
        where,
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              email: true,
            },
          },
          itens: {
            include: {
              produtoVariacao: {
                include: {
                  produto: true,
                },
              },
            },
          },
        },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pedido.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateOrderStatus(orderId: string, status: StatusPedido) {
    const pedido = await this.paymentsService.processarResultadoPagamento({
      pedidoId: orderId,
      status,
    });

    if (!pedido) {
      throw new NotFoundException('Pedido nao encontrado.');
    }

    return pedido;
  }

  private buildOrdersWhere(filters: {
    usuarioId?: string;
    status?: StatusPedido;
    metodoPagamento?: string;
    emailCliente?: string;
    criadoDe?: string;
    criadoAte?: string;
  }): Prisma.PedidoWhereInput {
    return {
      ...(filters.usuarioId ? { usuarioId: filters.usuarioId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.metodoPagamento
        ? { metodoPagamento: filters.metodoPagamento.toLowerCase().trim() }
        : {}),
      ...(filters.emailCliente
        ? {
            usuario: {
              email: { contains: filters.emailCliente, mode: 'insensitive' },
            },
          }
        : {}),
      ...(filters.criadoDe || filters.criadoAte
        ? {
            criadoEm: {
              ...(filters.criadoDe ? { gte: new Date(filters.criadoDe) } : {}),
              ...(filters.criadoAte ? { lte: new Date(filters.criadoAte) } : {}),
            },
          }
        : {}),
    };
  }
}
