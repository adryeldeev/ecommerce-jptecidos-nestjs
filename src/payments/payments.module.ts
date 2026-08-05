import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { MercadoPagoService } from './mercadopago.service';
import { PaymentsController } from './payments.controller';
import { AuditModule } from '../audit/audit.module';
import {
  buildKafkaClientOptions,
  buildKafkaConsumerOptions,
  fromConfig,
} from '../common/kafka/kafka.options';

@Module({
  imports: [
    ConfigModule,
    AuditModule,
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const configReader = fromConfig(configService);

          return {
            transport: Transport.KAFKA,
            options: {
              client: buildKafkaClientOptions(configReader),
              consumer: buildKafkaConsumerOptions(
                configReader,
                'KAFKA_PAYMENT_GROUP_ID',
                'ecommerce-payment-producer',
              ),
            },
          };
        },
      },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadoPagoService],
  exports: [PaymentsService, MercadoPagoService],
})
export class PaymentsModule {}
