import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  const prisma = {
    usuario: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  } as any;
  const jwtService = {
    signAsync: jest.fn(),
  } as any;
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'BCRYPT_ROUNDS') {
        return '10';
      }
      return undefined;
    }),
  } as any;

  const service = new AuthService(prisma, jwtService, configService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registra usuario com email normalizado', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({
      id: 'user-1',
      email: 'cliente@loja.com',
      nome: 'Cliente',
      ehAdmin: false,
    });
    jwtService.signAsync.mockResolvedValue('token');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash');

    const result = await service.register({
      email: 'CLIENTE@LOJA.COM',
      senha: '123456',
      nome: 'Cliente',
    });

    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'cliente@loja.com', senha: 'hash' }),
      }),
    );
    expect(result.accessToken).toBe('token');
  });

  it('falha login com senha invalida', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'cliente@loja.com',
      nome: 'Cliente',
      senha: 'hash',
      ehAdmin: false,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: 'cliente@loja.com', senha: '123456' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('faz login e devolve token com ehAdmin', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@loja.com',
      nome: 'Admin',
      senha: 'hash',
      ehAdmin: true,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValue('admin-token');

    const result = await service.login({
      email: 'ADMIN@LOJA.COM',
      senha: '123456',
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'admin-1',
      email: 'admin@loja.com',
      ehAdmin: true,
    });
    expect(result.accessToken).toBe('admin-token');
    expect(result.usuario.ehAdmin).toBe(true);
  });
});
