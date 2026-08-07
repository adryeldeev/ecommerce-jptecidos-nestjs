import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatusPedido, UnidadeMedida } from '@prisma/client';
import Decimal from 'decimal.js';
import { randomUUID, createHash } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentsService } from '../payments/payments.service';
import { MercadoPagoService } from '../payments/mercadopago.service';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { ShippingService } from '../shipping/shipping.service';
import { OrderNotificationService } from './order-notification.service';

type ItemCarrinho = {
  produtoVariacaoId: string;
  quantidade: Decimal;
  precoUnitario: Decimal;
};

// Janela de tempo em que um pedido com o mesmo fingerprint (mesmo usuario +
// mesmo carrinho) e considerado uma repeticao da mesma tentativa de compra
// (duplo clique, retry de rede) em vez de uma compra nova de proposito.
const JANELA_DEDUP_MS = 30_000;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly shippingService: ShippingService,
    private readonly orderNotificationService: OrderNotificationService,
  ) {}

  async createOrder(usuarioId: string, dto: CreateOrderDto, usuarioEmail?: string) {
    const metodoPagamentoNormalizado = dto.metodoPagamento.toLowerCase().trim();
    const usaCartao = metodoPagamentoNormalizado === 'cartao';
    const paymentProvider = dto.pagamento
      ? 'mercadopago'
      : usaCartao
        ? (dto.paymentProvider?.toLowerCase().trim() ?? 'mercadopago')
        : undefined;

    if (usaCartao && !dto.pagamento && !dto.paymentMethodId) {
      throw new BadRequestException(
        'paymentMethodId e obrigatorio para pagamento com cartao.',
      );
    }

    if (usaCartao && !dto.pagamento && paymentProvider !== 'mercadopago') {
      throw new BadRequestException(
        'paymentProvider invalido para cartao. Use mercadopago.',
      );
    }

    const fingerprint = dto.idempotencyKey ?? this.computeFingerprint(usuarioId, dto);

    const pedidoDuplicado = await this.prisma.pedido.findFirst({
      where: {
        usuarioId,
        requestFingerprint: fingerprint,
        criadoEm: { gte: new Date(Date.now() - JANELA_DEDUP_MS) },
      },
      include: { itens: true },
      orderBy: { criadoEm: 'desc' },
    });

    if (pedidoDuplicado) {
      return pedidoDuplicado;
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

    if (dto.pagamento) {
      return this.createOrderComPagamentoReal(usuarioId, dto, endereco, {
        metodoPagamentoNormalizado,
        paymentProvider,
        fingerprint,
        usuarioEmail,
      });
    }

    const { itensCarrinho, subtotal } = await this.prisma.$transaction((tx) =>
      this.reservarEstoqueEPrecificar(tx, dto.itens),
    );

    const shippingSelected = await this.shippingService.choose(
      endereco.cep,
      dto.itens,
      dto.freteMetodo as 'economico' | 'express' | undefined,
    );

    const frete = new Decimal(shippingSelected.valor);
    const total = subtotal.plus(frete).toDecimalPlaces(2);

    const result = await this.prisma.pedido.create({
      data: {
        usuarioId,
        enderecoId: endereco.id,
        status: StatusPedido.PROCESSANDO,
        metodoPagamento: metodoPagamentoNormalizado,
        paymentProvider,
        paymentMethodId: dto.paymentMethodId,
        requestFingerprint: fingerprint,
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

    await this.paymentsService.solicitarPagamento({
      pedidoId: result.id,
      usuarioId,
      valorTotal: result.valorTotal.toString(),
      metodoPagamento: metodoPagamentoNormalizado,
      paymentMethodId: dto.paymentMethodId,
      paymentProvider,
    });

    if (usuarioEmail) {
      void this.orderNotificationService.notificarPedidoNovo({
        id: result.id,
        valorTotal: result.valorTotal.toString(),
        metodoPagamento: metodoPagamentoNormalizado,
        clienteEmail: usuarioEmail,
      });
    }

    return result;
  }

  /**
   * Fluxo com cobranca real via Mercado Pago (Payment Brick). Reserva o
   * estoque numa transacao curta, cobra fora da transacao (chamada externa
   * nao pode segurar lock de linha) e so cria o Pedido se o pagamento nao
   * for rejeitado -- se for, o estoque reservado e devolvido e nenhum
   * Pedido chega a existir.
   */
  private async createOrderComPagamentoReal(
    usuarioId: string,
    dto: CreateOrderDto,
    endereco: {
      id: string;
      cep: string;
      rua: string;
      numero: string;
      complemento: string | null;
      bairro: string;
      cidade: string;
      estado: string;
    },
    contexto: {
      metodoPagamentoNormalizado: string;
      paymentProvider?: string;
      fingerprint: string;
      usuarioEmail?: string;
    },
  ) {
    const { itensCarrinho, subtotal } = await this.prisma.$transaction((tx) =>
      this.reservarEstoqueEPrecificar(tx, dto.itens),
    );

    const shippingSelected = await this.shippingService.choose(
      endereco.cep,
      dto.itens,
      dto.freteMetodo as 'economico' | 'express' | undefined,
    );

    const frete = new Decimal(shippingSelected.valor);
    const total = subtotal.plus(frete).toDecimalPlaces(2);
    const pedidoId = randomUUID();

    let pagamento: Awaited<ReturnType<MercadoPagoService['criarPagamento']>>;
    try {
      pagamento = await this.mercadoPagoService.criarPagamento({
        valorTotal: total.toFixed(2),
        externalReference: pedidoId,
        formData: dto.pagamento!.formData,
        idempotencyKey: contexto.fingerprint,
      });
    } catch (error) {
      await this.restaurarEstoque(itensCarrinho);
      throw new BadRequestException(
        `Nao foi possivel processar o pagamento: ${(error as Error).message}`,
      );
    }

    if (pagamento.status === 'rejected') {
      await this.restaurarEstoque(itensCarrinho);
      throw new BadRequestException(
        `Pagamento recusado pelo Mercado Pago: ${pagamento.statusDetail || 'motivo nao informado'}`,
      );
    }

    const statusPedido =
      pagamento.status === 'approved' ? StatusPedido.PAGO : StatusPedido.PROCESSANDO;

    const pedido = await this.prisma.pedido.create({
      data: {
        id: pedidoId,
        usuarioId,
        enderecoId: endereco.id,
        status: statusPedido,
        metodoPagamento: contexto.metodoPagamentoNormalizado,
        paymentProvider: contexto.paymentProvider,
        paymentMethodId: dto.paymentMethodId,
        paymentId: pagamento.id,
        requestFingerprint: contexto.fingerprint,
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

    if (contexto.usuarioEmail) {
      void this.orderNotificationService.notificarPedidoNovo({
        id: pedido.id,
        valorTotal: pedido.valorTotal.toString(),
        metodoPagamento: contexto.metodoPagamentoNormalizado,
        clienteEmail: contexto.usuarioEmail,
      });
    }

    return {
      ...pedido,
      pagamento: {
        status: pagamento.status,
        statusDetail: pagamento.statusDetail,
        qrCode: pagamento.qrCode,
        qrCodeBase64: pagamento.qrCodeBase64,
        ticketUrl: pagamento.ticketUrl,
      },
    };
  }

  private async reservarEstoqueEPrecificar(
    tx: Prisma.TransactionClient,
    itens: CreateOrderDto['itens'],
  ): Promise<{ itensCarrinho: ItemCarrinho[]; subtotal: Decimal }> {
    const itensCarrinho: ItemCarrinho[] = [];
    let subtotal = new Decimal(0);

    for (const item of itens) {
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

    return { itensCarrinho, subtotal };
  }

  private computeFingerprint(usuarioId: string, dto: CreateOrderDto): string {
    const itensNormalizados = [...dto.itens]
      .map((item) => `${item.produtoVariacaoId}:${item.quantidade}`)
      .sort()
      .join(',');

    const base = [
      usuarioId,
      dto.enderecoId,
      dto.metodoPagamento.toLowerCase().trim(),
      dto.freteMetodo ?? '',
      itensNormalizados,
    ].join('|');

    return createHash('sha256').update(base).digest('hex');
  }

  private async restaurarEstoque(itensCarrinho: ItemCarrinho[]) {
    for (const item of itensCarrinho) {
      await this.prisma.produtoVariacao.update({
        where: { id: item.produtoVariacaoId },
        data: {
          estoque: { increment: new Prisma.Decimal(item.quantidade.toFixed(3)) },
        },
      });
    }
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
