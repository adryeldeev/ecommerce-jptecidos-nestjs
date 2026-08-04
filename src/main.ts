import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { join } from 'path';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { PUBLIC_UPLOADS_PREFIX } from './storage/storage.constants';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  buildKafkaClientOptions,
  buildKafkaConsumerOptions,
  fromProcessEnv,
} from './common/kafka/kafka.options';

const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/localhost:\d+$/,
  // producao + previews de deploy do Vercel (ex: projeto-git-branch-usuario.vercel.app)
  /^https:\/\/ecommerce-jptecidos-nextjs.*\.vercel\.app$/,
];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet());
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
  });
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: PUBLIC_UPLOADS_PREFIX,
  });
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (process.env.KAFKA_ENABLED === 'true') {
    const envReader = fromProcessEnv();
    app.connectMicroservice({
      transport: Transport.KAFKA,
      options: {
        client: buildKafkaClientOptions(envReader),
        consumer: buildKafkaConsumerOptions(
          envReader,
          'KAFKA_GROUP_ID',
          'ecommerce-api-consumer',
        ),
      },
    });

    await app.startAllMicroservices();
  }

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
