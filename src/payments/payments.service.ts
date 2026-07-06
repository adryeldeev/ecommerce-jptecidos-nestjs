import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaymentResultMessageDto } from './dto/payment-result-message.dto';
import { Prisma, StatusPedido } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PaymentsService implements OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleDestroy() {
    if (this.configService.get<string>('KAFKA_ENABLED') === 'true') {
      await this.kafkaClient.close();
    }
  }

  async onModuleInit() {
    if (this.configService.get<string>('KAFKA_ENABLED') === 'true') {
      await this.kafkaClient.connect();
      this.logger.log('Kafka producer conectado.');
    }
  }

  async solicitarPagamento(payload: {
    pedidoId: string;
    usuarioId: string;
    valorTotal: string;
    metodoPagamento: string;
    paymentMethodId?: string;
    paymentProvider?: string;
  }) {
    if (this.configService.get<string>('KAFKA_ENABLED') !== 'true') {
      const autoApprove =
        this.configService.get<string>('PAYMENT_AUTO_APPROVE_WITHOUT_GATEWAY') !==
        'false';

      this.logger.warn(
        autoApprove
          ? 'Gateway indisponivel. Simulando pagamento aprovado localmente.'
          : 'Gateway indisponivel. Pedido mantido como PROCESSANDO ate integracao real.',
      );

      if (!autoApprove) {
        await this.auditService.record({
          acao: 'payment.solicitedWithoutGateway',
          entidade: 'Pedido',
          entidadeId: payload.pedidoId,
          dados: payload,
        });
        return { accepted: true, simulated: false };
      }

      const pedido = await this.prisma.pedido.update({
        where: { id: payload.pedidoId },
        data: { status: StatusPedido.PAGO },
      });

      await this.auditService.record({
        acao: 'payment.autoApprovedWithoutGateway',
        entidade: 'Pedido',
        entidadeId: payload.pedidoId,
        dados: payload,
      });

      return pedido;
    }

    this.kafkaClient.emit('pagamento.solicitado', payload);
    return { accepted: true };
  }

  async processarResultadoPagamento(message: PaymentResultMessageDto) {
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id: message.pedidoId },
        include: {
          itens: true,
        },
      });

      if (!pedido) {
        return null;
      }

        const statusesQueRestauram = new Set<StatusPedido>([
          StatusPedido.FALHOU,
          StatusPedido.CANCELADO,
        ]);

        const deveRestaurarEstoque =
          statusesQueRestauram.has(message.status) &&
          !statusesQueRestauram.has(pedido.status);

      if (deveRestaurarEstoque) {
        for (const item of pedido.itens) {
          const variacao = await tx.produtoVariacao.findUnique({
            where: { id: item.produtoVariacaoId },
            select: { estoque: true },
          });

          if (!variacao) {
            continue;
          }

          await tx.produtoVariacao.update({
            where: { id: item.produtoVariacaoId },
            data: {
              estoque: new Prisma.Decimal(
                variacao.estoque.plus(item.quantidade).toString(),
              ),
            },
          });
        }
      }

      return tx.pedido.update({
        where: { id: message.pedidoId },
        data: { status: message.status },
      });
    });
  }
}
