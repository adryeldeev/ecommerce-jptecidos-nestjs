# Ecommerce JP Tecidos API

Backend monolito modular em NestJS para ecommerce têxtil, com Prisma, PostgreSQL e Kafka no fluxo de pagamento.

## Módulos atuais

- Auth: registro e login com JWT.
- Addresses: CRUD de endereços do cliente autenticado.
- Shipping: cotação de frete calculada pelo servidor.
- Catalog: categorias, produtos e variações. Escrita restrita a admin.
- Catalog: upload de imagens do produto por admin.
- Orders: checkout, histórico do cliente, listagem administrativa, filtros e paginação.
- Payments: contrato de pagamento tokenizado, integração por evento Kafka e compensação de estoque em falha/cancelamento.
- Audit: trilha de eventos críticos e logging de requisições.
- Security: rate limit global e recuperação de senha.

## Regras de negócio implementadas

- Apenas admin pode cadastrar categorias, produtos e variações.
- Cliente final só acessa seus próprios pedidos e endereços.
- Pedido salva snapshot do endereço de entrega no momento da compra.
- Frete é calculado no servidor e persiste método, transportadora e prazo estimado.
- Checkout com cartão exige `paymentMethodId` tokenizado.
- Em falha ou cancelamento de pagamento, o estoque é recomposto.

## Setup

```bash
npm install
npm run prisma:generate
npm run build
```

## Produção

- Arquivos base: `Dockerfile`, `docker-compose.prod.yml`, `.env.production.example`.
- Guia completo: `PRODUCTION.md`.

Subida da stack:

```bash
cp .env.production.example .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Variáveis importantes

- `DATABASE_URL`: conexão PostgreSQL.
- `JWT_SECRET`: segredo do token.
- `KAFKA_ENABLED`: ativa/desativa integração Kafka.
- `PAYMENT_AUTO_APPROVE_WITHOUT_GATEWAY`: quando `true`, aprova localmente sem gateway real.
- `BCRYPT_ROUNDS`: custo do hash da senha.
- `STORAGE_DRIVER`: `local` ou `s3`.
- `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: upload S3.
- `AWS_S3_PUBLIC_BASE_URL`: opcional para CDN/custom domain.
- `STRIPE_SECRET_KEY`: reservado para integração futura.
- `STRIPE_WEBHOOK_SECRET`: reservado para integração futura.

## Banco de dados

Para aplicar migrations, ajuste antes a `DATABASE_URL` com credenciais válidas.

```bash
npm run prisma:migrate -- --name init
```

### Seed de administrador

Depois das migrations, rode o seed para garantir um usuário admin para autenticação no painel.

```bash
npm run prisma:seed
```

Variáveis usadas pelo seed:

- `ADMIN_EMAIL` (default: `admin@jptecidos.com`)
- `ADMIN_PASSWORD` (default: `Admin@123456`)
- `ADMIN_NAME` (default: `Administrador`)

O seed é idempotente: se o email já existir, ele atualiza nome, senha e define `ehAdmin=true`.

## Endpoints principais

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /catalogo/produtos`
- `POST /categorias|produtos|variacoes` via `/catalogo/*` apenas admin
- `POST /catalogo/produtos/:id/imagens` apenas admin
- `GET /enderecos`
- `POST /enderecos`
- `PATCH /enderecos/:id`
- `DELETE /enderecos/:id`
- `POST /fretes/cotacao`
- `POST /pedidos`
- `GET /pedidos`
- `GET /pedidos/admin`

## Filtros disponíveis

### Catálogo

- `page`, `limit`
- `busca`
- `categoriaSlug`
- `cor`
- `unidadeMedida`
- `precoMin`, `precoMax`
- `somenteDisponiveis`

### Pedidos

- `page`, `limit`
- `status`
- `metodoPagamento`
- `criadoDe`, `criadoAte`
- `emailCliente` no endpoint admin

## Pagamento

Hoje o backend está pronto para receber `paymentMethodId` tokenizado, mas ainda sem chamada direta ao Stripe. O contrato já está preparado para a integração real quando as credenciais forem disponibilizadas.

## Upload de imagens

- Em desenvolvimento, o sistema pode usar storage local.
- Para produção em Railway, use `STORAGE_DRIVER=s3` com bucket S3 configurado.

## Testes

```bash
npm test -- --runInBand
```
