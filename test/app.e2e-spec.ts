import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Ecommerce API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  const email = `cliente.${Date.now()}@loja.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        senha: '123456',
        nome: 'Cliente E2E',
      })
      .expect(201);

    accessToken = registerResponse.body.accessToken;
  });

  it('should register and login a customer', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        senha: '123456',
      })
      .expect(201);

    expect(loginResponse.body.accessToken).toEqual(expect.any(String));
    expect(loginResponse.body.usuario.email).toBe(email.toLowerCase());
  });

  it('should create and list customer addresses', async () => {
    const addressResponse = await request(app.getHttpServer())
      .post('/enderecos')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        cep: '01001000',
        rua: 'Rua Teste',
        numero: '123',
        bairro: 'Centro',
        cidade: 'Sao Paulo',
        estado: 'SP',
      })
      .expect(201);

    expect(addressResponse.body.cep).toBe('01001000');

    const listResponse = await request(app.getHttpServer())
      .get('/enderecos')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(listResponse.body)).toBe(true);
    expect(listResponse.body.length).toBeGreaterThan(0);
  });

  it('should return shipping quotes', async () => {
    const response = await request(app.getHttpServer())
      .post('/fretes/cotacao')
      .send({
        cep: '01001000',
        subtotal: '250.00',
        metodo: 'economico',
        estado: 'SP',
      })
      .expect(201);

    expect(response.body.options).toHaveLength(2);
    expect(response.body.selected.metodo).toBe('economico');
  });

  it('should expose paginated products endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get('/catalogo/produtos?page=1&limit=5&ordenacao=recentes')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        page: 1,
        limit: 5,
        total: expect.any(Number),
      }),
    );
  });

  it('should provide forgot-password response', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email })
      .expect(201);

    expect(response.body.message).toContain('Se o email existir');
    expect(response.body.devResetToken).toEqual(expect.any(String));
  });

  afterAll(async () => {
    await app.close();
  });
});
