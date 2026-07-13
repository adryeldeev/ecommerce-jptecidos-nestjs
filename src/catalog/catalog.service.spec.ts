import { Prisma, UnidadeMedida } from '@prisma/client';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const prisma = {
    categoria: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    fabricante: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    produto: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    produtoVariacao: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    produtoImagem: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    itemPedido: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const service = new CatalogService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cria produto convertendo precoBase para Decimal', () => {
    prisma.produto.create.mockResolvedValue({ id: 'produto-1' });
    prisma.produto.findUnique.mockResolvedValue(null);

    service.createProduct({
      titulo: 'Tecido Algodao',
      descricao: 'Descricao',
      precoBase: '39.90',
      unidadeMedida: UnidadeMedida.METRO,
      categoriaId: 'categoria-1',
    });

    expect(prisma.produto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          titulo: 'Tecido Algodao',
          precoBase: expect.any(Prisma.Decimal),
          slug: 'tecido-algodao',
        }),
      }),
    );

    const payload = prisma.produto.create.mock.calls[0][0];
    expect(payload.data.precoBase.toString()).toBe('39.9');
  });

  it('lanca NotFoundException quando fabricanteId nao existe', async () => {
    prisma.fabricante.findUnique.mockResolvedValue(null);

    await expect(
      service.createProduct({
        titulo: 'Tecido Teste',
        precoBase: '29.90',
        unidadeMedida: UnidadeMedida.METRO,
        categoriaId: 'categoria-1',
        fabricanteId: 'fabricante-inexistente',
      }),
    ).rejects.toThrow('Fabricante nao encontrado.');
  });

  it('lanca BadRequestException quando slug ja existe em outro produto', async () => {
    prisma.produto.findUnique.mockResolvedValue({ id: 'produto-1' });
    prisma.produto.findUnique.mockResolvedValueOnce({ id: 'produto-1' }).mockResolvedValueOnce({ id: 'produto-2' });

    await expect(
      service.updateProduct('produto-1', {
        slug: 'slug-ja-existente',
      }),
    ).rejects.toThrow('Ja existe um produto com esse slug.');
  });

  it('lista fabricantes', () => {
    prisma.fabricante.findMany.mockResolvedValue([{ id: 'fabricante-1', nome: 'Fabricante A' }]);

    const result = service.listFabricantes();

    expect(prisma.fabricante.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { nome: 'asc' },
      }),
    );
    expect(result).resolves.toEqual([{ id: 'fabricante-1', nome: 'Fabricante A' }]);
  });

  it('cria fabricante', () => {
    prisma.fabricante.create.mockResolvedValue({ id: 'fabricante-1', nome: 'Fabricante A' });

    service.createFabricante({ nome: 'Fabricante A' });

    expect(prisma.fabricante.create).toHaveBeenCalledWith({
      data: { nome: 'Fabricante A' },
    });
  });

  it('atualiza fabricante', async () => {
    prisma.fabricante.findUnique.mockResolvedValue({ id: 'fabricante-1' });
    prisma.fabricante.update.mockResolvedValue({ id: 'fabricante-1', nome: 'Fabricante B' });

    const result = await service.updateFabricante('fabricante-1', { nome: 'Fabricante B' });

    expect(prisma.fabricante.findUnique).toHaveBeenCalledWith({
      where: { id: 'fabricante-1' },
      select: { id: true },
    });
    expect(prisma.fabricante.update).toHaveBeenCalledWith({
      where: { id: 'fabricante-1' },
      data: { nome: 'Fabricante B' },
    });
    expect(result).toEqual({ id: 'fabricante-1', nome: 'Fabricante B' });
  });

  it('lanca NotFoundException quando atualiza fabricante inexistente', async () => {
    prisma.fabricante.findUnique.mockResolvedValue(null);

    await expect(
      service.updateFabricante('fabricante-inexistente', { nome: 'Fabricante B' }),
    ).rejects.toThrow('Fabricante nao encontrado.');
  });

  it('remove fabricante', async () => {
    prisma.fabricante.findUnique.mockResolvedValue({ id: 'fabricante-1' });
    prisma.produto.count.mockResolvedValue(0);
    prisma.fabricante.delete.mockResolvedValue(undefined);

    const result = await service.removeFabricante('fabricante-1');

    expect(prisma.fabricante.findUnique).toHaveBeenCalledWith({
      where: { id: 'fabricante-1' },
      select: { id: true },
    });
    expect(prisma.produto.count).toHaveBeenCalledWith({
      where: { fabricanteId: 'fabricante-1' },
    });
    expect(prisma.fabricante.delete).toHaveBeenCalledWith({
      where: { id: 'fabricante-1' },
    });
    expect(result).toEqual({ deleted: true });
  });

  it('lanca NotFoundException quando remove fabricante inexistente', async () => {
    prisma.fabricante.findUnique.mockResolvedValue(null);

    await expect(service.removeFabricante('fabricante-inexistente')).rejects.toThrow(
      'Fabricante nao encontrado.',
    );
  });

  it('lanca BadRequestException quando remove fabricante com produtos vinculados', async () => {
    prisma.fabricante.findUnique.mockResolvedValue({ id: 'fabricante-1' });
    prisma.produto.count.mockResolvedValue(5);

    await expect(service.removeFabricante('fabricante-1')).rejects.toThrow(
      'Nao e possivel excluir fabricante com produtos vinculados.',
    );
  });

  it('lista produtos com filtros e paginação', async () => {
    prisma.produto.findMany.mockResolvedValue([{ id: 'produto-1' }]);
    prisma.produto.count.mockResolvedValue(1);

    const result = await service.listProducts({
      page: 2,
      limit: 5,
      busca: 'algodao',
      categoriaSlug: 'tecidos',
      cor: 'branco',
      somenteDisponiveis: true,
      ordenacao: 'preco_desc',
    } as any);

    expect(prisma.produto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        orderBy: { precoBase: 'desc' },
      }),
    );

    const query = prisma.produto.findMany.mock.calls[0][0];
    expect(query.where.OR).toHaveLength(2);
    expect(query.where.categoria).toEqual({ slug: 'tecidos' });
    expect(query.where.variacoes.some.cor).toEqual({ contains: 'branco', mode: 'insensitive' });
    expect(query.where.variacoes.some.estoque.gt.toString()).toBe('0');

    expect(result).toEqual({
      items: [{ id: 'produto-1' }],
      page: 2,
      limit: 5,
      total: 1,
      totalPages: 1,
    });
  });

  it('atualiza produto convertendo precoBase para Decimal', async () => {
    prisma.produto.findUnique.mockResolvedValue({ id: 'produto-1' });
    prisma.produto.update.mockResolvedValue({ id: 'produto-1' });

    await service.updateProduct('produto-1', {
      precoBase: '59.90',
      titulo: 'Novo titulo',
    });

    const payload = prisma.produto.update.mock.calls[0][0];
    expect(payload.data.precoBase).toBeInstanceOf(Prisma.Decimal);
    expect(payload.data.precoBase.toString()).toBe('59.9');
  });

  it('impede excluir categoria com produtos vinculados', async () => {
    prisma.categoria.findUnique.mockResolvedValue({ id: 'categoria-1' });
    prisma.produto.count.mockResolvedValue(1);

    await expect(service.removeCategory('categoria-1')).rejects.toThrow(
      'Nao e possivel excluir categoria com produtos vinculados.',
    );
  });

  it('cria imagem de produto ao final da galeria por padrao', async () => {
    prisma.produtoImagem.count.mockResolvedValue(3);
    prisma.produtoImagem.create.mockResolvedValue({ id: 'img-4', ordem: 3 });

    await service.createProductImage({
      produtoId: 'produto-1',
      url: 'https://example.com/image.png',
    });

    expect(prisma.produtoImagem.create).toHaveBeenCalledWith({
      data: {
        produtoId: 'produto-1',
        url: 'https://example.com/image.png',
        ordem: 3,
      },
    });
  });

  it('cria imagem de variacao ao final da galeria da variacao', async () => {
    prisma.produtoVariacao.findUnique.mockResolvedValue({
      id: 'var-1',
      produtoId: 'produto-1',
    });
    prisma.produtoImagem.count.mockResolvedValue(2);
    prisma.produtoImagem.create.mockResolvedValue({ id: 'img-var-3', ordem: 2 });

    await service.createProductImage({
      produtoId: 'produto-1',
      produtoVariacaoId: 'var-1',
      url: 'https://example.com/variation.png',
    });

    expect(prisma.produtoImagem.create).toHaveBeenCalledWith({
      data: {
        produtoId: 'produto-1',
        produtoVariacaoId: 'var-1',
        url: 'https://example.com/variation.png',
        ordem: 2,
      },
    });
  });

  it('define uma imagem como capa ao mover para ordem zero', async () => {
    prisma.produto.findUnique.mockResolvedValue({ id: 'produto-1' });
    prisma.produtoImagem.findMany.mockResolvedValue([
      { id: 'img-1', produtoId: 'produto-1', ordem: 0, criadoEm: new Date('2026-01-01') },
      { id: 'img-2', produtoId: 'produto-1', ordem: 1, criadoEm: new Date('2026-01-02') },
      { id: 'img-3', produtoId: 'produto-1', ordem: 2, criadoEm: new Date('2026-01-03') },
    ]);
    prisma.$transaction.mockResolvedValue(undefined);
    prisma.produtoImagem.findUnique.mockResolvedValue({ id: 'img-3', ordem: 0 });

    await service.setProductImageAsCover('produto-1', 'img-3');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(3);
    expect(prisma.produtoImagem.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'img-3' },
      data: { ordem: 0 },
    });
    expect(prisma.produtoImagem.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'img-1' },
      data: { ordem: 1 },
    });
    expect(prisma.produtoImagem.update).toHaveBeenNthCalledWith(3, {
      where: { id: 'img-2' },
      data: { ordem: 2 },
    });
  });

  it('define uma imagem da variacao como capa ao mover para ordem zero', async () => {
    prisma.produtoVariacao.findUnique.mockResolvedValue({ id: 'var-1' });
    prisma.produtoImagem.findMany.mockResolvedValue([
      { id: 'img-v1', produtoVariacaoId: 'var-1', ordem: 0, criadoEm: new Date('2026-01-01') },
      { id: 'img-v2', produtoVariacaoId: 'var-1', ordem: 1, criadoEm: new Date('2026-01-02') },
    ]);
    prisma.$transaction.mockResolvedValue(undefined);
    prisma.produtoImagem.findUnique.mockResolvedValue({ id: 'img-v2', ordem: 0 });

    await service.setVariationImageAsCover('var-1', 'img-v2');

    expect(prisma.produtoImagem.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'img-v2' },
      data: { ordem: 0 },
    });
    expect(prisma.produtoImagem.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'img-v1' },
      data: { ordem: 1 },
    });
  });
});