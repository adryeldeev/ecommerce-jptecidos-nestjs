import type { ConfigService } from '@nestjs/config';
import type { KafkaConfig } from 'kafkajs';

type EnvReader = {
  get<T = string>(key: string): T | undefined;
};

function toBool(value: string | undefined, fallback = false) {
  if (value === undefined) {
    return fallback;
  }
  return value.toLowerCase() === 'true';
}

function getSasl(reader: EnvReader): KafkaConfig['sasl'] {
  const enabled = toBool(reader.get<string>('KAFKA_SASL_ENABLED'), false);
  if (!enabled) {
    return undefined;
  }

  const mechanism = reader.get<string>('KAFKA_SASL_MECHANISM') ?? 'plain';
  const username = reader.get<string>('KAFKA_USERNAME');
  const password = reader.get<string>('KAFKA_PASSWORD');

  if (!username || !password) {
    return undefined;
  }

  if (mechanism === 'scram-sha-256') {
    return {
      mechanism: 'scram-sha-256',
      username,
      password,
    };
  }

  if (mechanism === 'scram-sha-512') {
    return {
      mechanism: 'scram-sha-512',
      username,
      password,
    };
  }

  return {
    mechanism: 'plain',
    username,
    password,
  };
}

export function buildKafkaClientOptions(reader: EnvReader): KafkaConfig {
  return {
    clientId: reader.get<string>('KAFKA_CLIENT_ID') ?? 'ecommerce-api',
    brokers: (reader.get<string>('KAFKA_BROKERS') ?? 'localhost:9092').split(','),
    ssl: toBool(reader.get<string>('KAFKA_SSL_ENABLED'), false),
    sasl: getSasl(reader),
  };
}

export function buildKafkaConsumerOptions(reader: EnvReader, key: string, fallback: string) {
  return {
    groupId: reader.get<string>(key) ?? fallback,
  };
}

export function fromConfig(configService: ConfigService): EnvReader {
  return {
    get<T = string>(key: string) {
      return configService.get<T>(key);
    },
  };
}

export function fromProcessEnv(): EnvReader {
  return {
    get<T = string>(key: string) {
      return process.env[key] as T | undefined;
    },
  };
}
