import { BadRequestException } from '@nestjs/common';
import { ShippingService } from './shipping.service';

describe('ShippingService', () => {
  const prisma = {
    produtoVariacao: {
      findUnique: jest.fn(),
    },
  } as any;
  const frenetService = {
    cotar: jest.fn(),
  } as any;

  const service = new ShippingService(prisma, frenetService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calcula peso real por metro usando gramatura e largura do produto', async () => {
    prisma.produtoVariacao.findUnique.mockResolvedValue({
      preco: null,
      produto: {
        precoBase: '50.00',
        gramatura: '300', // g/m2
        largura: '1.5', // m
        unidadeMedida: 'METRO',
      },
    });
    frenetService.cotar.mockResolvedValue([
      { carrier: 'Correios', serviceDescription: 'PAC', serviceCode: '1', price: 20, deliveryDays: 6 },
      { carrier: 'Jadlog', serviceDescription: 'Package', serviceCode: '2', price: 25, deliveryDays: 3 },
    ]);

    await service.quote('01310-100', [{ produtoVariacaoId: 'v1', quantidade: '10' }]);

    // 10m * 1.5m * 300g/m2 / 1000 = 4.5kg
    expect(frenetService.cotar).toHaveBeenCalledWith(
      expect.objectContaining({
        itens: [expect.objectContaining({ weightKg: 4.5 })],
      }),
    );
  });

  it('usa peso padrao quando produto por metro nao tem gramatura/largura cadastradas', async () => {
    prisma.produtoVariacao.findUnique.mockResolvedValue({
      preco: null,
      produto: {
        precoBase: '50.00',
        gramatura: null,
        largura: null,
        unidadeMedida: 'METRO',
      },
    });
    frenetService.cotar.mockResolvedValue([
      { carrier: 'Correios', serviceDescription: 'PAC', serviceCode: '1', price: 20, deliveryDays: 6 },
    ]);

    await service.quote('01310-100', [{ produtoVariacaoId: 'v1', quantidade: '10' }]);

    // fallback: 10m * 0.3kg/m = 3kg
    expect(frenetService.cotar).toHaveBeenCalledWith(
      expect.objectContaining({
        itens: [expect.objectContaining({ weightKg: 3 })],
      }),
    );
  });

  it('usa a propria quantidade como peso para produtos vendidos por KG', async () => {
    prisma.produtoVariacao.findUnique.mockResolvedValue({
      preco: null,
      produto: {
        precoBase: '80.00',
        gramatura: null,
        largura: null,
        unidadeMedida: 'KG',
      },
    });
    frenetService.cotar.mockResolvedValue([
      { carrier: 'Correios', serviceDescription: 'PAC', serviceCode: '1', price: 20, deliveryDays: 6 },
    ]);

    await service.quote('01310-100', [{ produtoVariacaoId: 'v1', quantidade: '7.5' }]);

    expect(frenetService.cotar).toHaveBeenCalledWith(
      expect.objectContaining({
        itens: [expect.objectContaining({ weightKg: 7.5 })],
      }),
    );
  });

  it('mapeia a cotacao mais barata para economico e a mais rapida para express', async () => {
    prisma.produtoVariacao.findUnique.mockResolvedValue({
      preco: '40.00',
      produto: { precoBase: '40.00', gramatura: null, largura: null, unidadeMedida: 'KG' },
    });
    frenetService.cotar.mockResolvedValue([
      { carrier: 'Correios', serviceDescription: 'PAC', serviceCode: '1', price: 30, deliveryDays: 6 },
      { carrier: 'Correios', serviceDescription: 'Sedex', serviceCode: '2', price: 68, deliveryDays: 1 },
      { carrier: 'Jadlog', serviceDescription: 'Package', serviceCode: '3', price: 20, deliveryDays: 13 },
    ]);

    const options = await service.quote('01310-100', [
      { produtoVariacaoId: 'v1', quantidade: '2' },
    ]);

    expect(options).toEqual([
      expect.objectContaining({ metodo: 'economico', valor: '20.00', prazoDias: 13 }),
      expect.objectContaining({ metodo: 'express', valor: '68.00', prazoDias: 1 }),
    ]);
  });

  it('lanca erro quando a Frenet nao retorna nenhuma opcao valida', async () => {
    prisma.produtoVariacao.findUnique.mockResolvedValue({
      preco: null,
      produto: { precoBase: '40.00', gramatura: null, largura: null, unidadeMedida: 'KG' },
    });
    frenetService.cotar.mockResolvedValue([]);

    await expect(
      service.quote('00000-000', [{ produtoVariacaoId: 'v1', quantidade: '2' }]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('choose seleciona a opcao pelo metodo pedido, com fallback para economico', async () => {
    prisma.produtoVariacao.findUnique.mockResolvedValue({
      preco: null,
      produto: { precoBase: '40.00', gramatura: null, largura: null, unidadeMedida: 'KG' },
    });
    frenetService.cotar.mockResolvedValue([
      { carrier: 'Correios', serviceDescription: 'PAC', serviceCode: '1', price: 30, deliveryDays: 6 },
      { carrier: 'Correios', serviceDescription: 'Sedex', serviceCode: '2', price: 68, deliveryDays: 1 },
    ]);

    const selecionado = await service.choose(
      '01310-100',
      [{ produtoVariacaoId: 'v1', quantidade: '2' }],
      'express',
    );

    expect(selecionado.metodo).toBe('express');
    expect(selecionado.valor).toBe('68.00');
  });
});
