# Produção - Ecommerce JP Tecidos

Este documento descreve o mínimo necessário para colocar o sistema completo em produção.

## 1) Pré-requisitos

- Docker e Docker Compose no servidor.
- DNS e TLS no nível de borda (Nginx/Traefik/Load Balancer).
- Segredos gerenciados fora do repositório.

## 2) Arquivos usados

- docker-compose.prod.yml
- Dockerfile
- .env.production (copie de .env.production.example)

## 3) Variáveis críticas

- DATABASE_URL
- JWT_SECRET
- ADMIN_EMAIL
- ADMIN_PASSWORD
- ADMIN_NAME
- STORAGE_DRIVER
- AWS_REGION
- AWS_S3_BUCKET
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_S3_PUBLIC_BASE_URL
- KAFKA_ENABLED
- KAFKA_BROKERS
- KAFKA_CLIENT_ID
- KAFKA_GROUP_ID
- KAFKA_PAYMENT_GROUP_ID
- KAFKA_SASL_ENABLED
- KAFKA_SASL_MECHANISM
- KAFKA_USERNAME
- KAFKA_PASSWORD
- KAFKA_SSL_ENABLED
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET

## 4) Subida da stack

1. Crie .env.production a partir de .env.production.example.
2. Ajuste segredos e endpoints.
3. Rode:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

4. Verifique saúde dos serviços:

```bash
docker compose -f docker-compose.prod.yml ps
```

## 5) Banco de dados

- Em produção, prefira banco gerenciado.
- Se usar o Postgres do compose, configure backup periódico.
- Migrations são aplicadas no startup da API via `prisma migrate deploy`.

## 6) Kafka

- Kafka é opcional no sistema.
- Se você não for usar Kafka, mantenha `KAFKA_ENABLED=false`.
- Se ativar no futuro, use broker gerenciado e configure SASL/SSL por variáveis.

## 7) Uploads e imagens

- Em Railway, nao use filesystem local como storage principal.
- Configure `STORAGE_DRIVER=s3`.
- Defina bucket, regiao e credenciais AWS.
- Guarde apenas a URL final no banco.

## 8) Segurança

- Nunca commitar .env.production.
- JWT_SECRET forte e único por ambiente.
- PAYMENT_AUTO_APPROVE_WITHOUT_GATEWAY deve ficar false.
- Restrinja portas expostas ao necessário.

## 9) Observabilidade

- Coletar logs da API e dos containers.
- Alertar em:
  - API indisponível
  - erro de conexão com banco
  - erro de consumo/publicação Kafka

## 10) Checklist de go-live

- [ ] Build e testes verdes
- [ ] Migrations aplicadas
- [ ] KAFKA desativado ou configurado corretamente
- [ ] STORAGE_DRIVER=s3 com bucket funcional
- [ ] Segredos de Stripe configurados
- [ ] Backup do banco validado
- [ ] Healthcheck e logs monitorados
- [ ] Teste ponta a ponta de checkout executado
