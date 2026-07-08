import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateVariationDto } from './dto/create-variation.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { CreateProductImageInput } from './types/create-product-image-input.type';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateVariationDto } from './dto/update-variation.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listProductImages(produtoId: string) {
    const product = await this.prisma.produto.findUnique({
      where: { id: produtoId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Produto nao encontrado.');
    }

    return this.prisma.produtoImagem.findMany({
      where: { produtoId, produtoVariacaoId: null },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    });
  }

  async listVariationImages(variationId: string) {
    const variation = await this.prisma.produtoVariacao.findUnique({
      where: { id: variationId },
      select: { id: true },
    });

    if (!variation) {
      throw new NotFoundException('Variacao nao encontrada.');
    }

    return this.prisma.produtoImagem.findMany({
      where: { produtoVariacaoId: variationId },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    });
  }

  listCategories() {
    return this.prisma.categoria.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  createCategory(dto: CreateCategoryDto) {
    return this.prisma.categoria.create({ data: dto });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.categoria.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Categoria nao encontrada.');
    }

    return this.prisma.categoria.update({
      where: { id },
      data: dto,
    });
  }

  async removeCategory(id: string) {
    const category = await this.prisma.categoria.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Categoria nao encontrada.');
    }

    const productCount = await this.prisma.produto.count({
      where: { categoriaId: id },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        'Nao e possivel excluir categoria com produtos vinculados.',
      );
    }

    await this.prisma.categoria.delete({ where: { id } });
    return { deleted: true };
  }

  createProduct(dto: CreateProductDto) {
    return this.prisma.produto.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        precoBase: new Prisma.Decimal(dto.precoBase),
        quantidadeEstoque: new Prisma.Decimal(dto.quantidadeEstoque),
        unidadeMedida: dto.unidadeMedida,
        categoriaId: dto.categoriaId,
      },
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.produto.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Produto nao encontrado.');
    }

    return this.prisma.produto.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
        ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
        ...(dto.precoBase !== undefined
          ? { precoBase: new Prisma.Decimal(dto.precoBase) }
          : {}),
        ...(dto.quantidadeEstoque !== undefined
          ? { quantidadeEstoque: new Prisma.Decimal(dto.quantidadeEstoque) }
          : {}),
        ...(dto.unidadeMedida !== undefined
          ? { unidadeMedida: dto.unidadeMedida }
          : {}),
        ...(dto.categoriaId !== undefined ? { categoriaId: dto.categoriaId } : {}),
      },
    });
  }

  async removeProduct(id: string) {
    const product = await this.prisma.produto.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Produto nao encontrado.');
    }

    const itemCount = await this.prisma.itemPedido.count({
      where: {
        produtoVariacao: {
          produtoId: id,
        },
      },
    });

    if (itemCount > 0) {
      throw new BadRequestException(
        'Nao e possivel excluir produto vinculado a pedidos.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.produtoImagem.deleteMany({ where: { produtoId: id } }),
      this.prisma.produtoVariacao.deleteMany({ where: { produtoId: id } }),
      this.prisma.produto.delete({ where: { id } }),
    ]);

    return { deleted: true };
  }

  createVariation(dto: CreateVariationDto) {
    return this.prisma.produtoVariacao.create({
      data: {
        produtoId: dto.produtoId,
        cor: dto.cor,
        largura: dto.largura ? new Prisma.Decimal(dto.largura) : null,
        estoque: new Prisma.Decimal(dto.estoque),
        sku: dto.sku,
      },
    });
  }

  async updateVariation(id: string, dto: UpdateVariationDto) {
    const variation = await this.prisma.produtoVariacao.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!variation) {
      throw new NotFoundException('Variacao nao encontrada.');
    }

    return this.prisma.produtoVariacao.update({
      where: { id },
      data: {
        ...(dto.produtoId !== undefined ? { produtoId: dto.produtoId } : {}),
        ...(dto.cor !== undefined ? { cor: dto.cor } : {}),
        ...(dto.largura !== undefined
          ? { largura: new Prisma.Decimal(dto.largura) }
          : {}),
        ...(dto.estoque !== undefined
          ? { estoque: new Prisma.Decimal(dto.estoque) }
          : {}),
        ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
      },
    });
  }

  async removeVariation(id: string) {
    const variation = await this.prisma.produtoVariacao.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!variation) {
      throw new NotFoundException('Variacao nao encontrada.');
    }

    const itemCount = await this.prisma.itemPedido.count({
      where: { produtoVariacaoId: id },
    });

    if (itemCount > 0) {
      throw new BadRequestException(
        'Nao e possivel excluir variacao vinculada a pedidos.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.produtoImagem.deleteMany({ where: { produtoVariacaoId: id } }),
      this.prisma.produtoVariacao.delete({ where: { id } }),
    ]);
    return { deleted: true };
  }

  async createProductImage(input: CreateProductImageInput) {
    if (input.produtoVariacaoId) {
      const variation = await this.prisma.produtoVariacao.findUnique({
        where: { id: input.produtoVariacaoId },
        select: { id: true, produtoId: true },
      });

      if (!variation || variation.produtoId !== input.produtoId) {
        throw new BadRequestException('Variacao nao pertence ao produto informado.');
      }
    }

    const existingCount = await this.prisma.produtoImagem.count({
      where: input.produtoVariacaoId
        ? { produtoVariacaoId: input.produtoVariacaoId }
        : { produtoId: input.produtoId, produtoVariacaoId: null },
    });

    return this.prisma.produtoImagem.create({
      data: {
        produtoId: input.produtoId,
        ...(input.produtoVariacaoId
          ? { produtoVariacaoId: input.produtoVariacaoId }
          : {}),
        url: input.url,
        ordem: input.ordem ?? existingCount,
      },
    });
  }

  async setProductImageAsCover(produtoId: string, imageId: string) {
    const product = await this.prisma.produto.findUnique({
      where: { id: produtoId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Produto nao encontrado.');
    }

    const images = await this.prisma.produtoImagem.findMany({
      where: { produtoId, produtoVariacaoId: null },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    });

    const target = images.find((image) => image.id === imageId);

    if (!target) {
      throw new NotFoundException('Imagem do produto nao encontrada.');
    }

    const reordered = [target, ...images.filter((image) => image.id !== imageId)];

    await this.prisma.$transaction(
      reordered.map((image, index) =>
        this.prisma.produtoImagem.update({
          where: { id: image.id },
          data: { ordem: index },
        }),
      ),
    );

    return this.prisma.produtoImagem.findUnique({
      where: { id: imageId },
    });
  }

  async setVariationImageAsCover(variationId: string, imageId: string) {
    const variation = await this.prisma.produtoVariacao.findUnique({
      where: { id: variationId },
      select: { id: true },
    });

    if (!variation) {
      throw new NotFoundException('Variacao nao encontrada.');
    }

    const images = await this.prisma.produtoImagem.findMany({
      where: { produtoVariacaoId: variationId },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    });

    const target = images.find((image) => image.id === imageId);

    if (!target) {
      throw new NotFoundException('Imagem da variacao nao encontrada.');
    }

    const reordered = [target, ...images.filter((image) => image.id !== imageId)];

    await this.prisma.$transaction(
      reordered.map((image, index) =>
        this.prisma.produtoImagem.update({
          where: { id: image.id },
          data: { ordem: index },
        }),
      ),
    );

    return this.prisma.produtoImagem.findUnique({
      where: { id: imageId },
    });
  }

  async listProducts(query: ListProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;

    const where: Prisma.ProdutoWhereInput = {
      ...(query.busca
        ? {
            OR: [
              { titulo: { contains: query.busca, mode: 'insensitive' } },
              { descricao: { contains: query.busca, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.categoriaSlug
        ? { categoria: { slug: query.categoriaSlug } }
        : {}),
      ...(query.unidadeMedida ? { unidadeMedida: query.unidadeMedida } : {}),
      ...(query.precoMin !== undefined || query.precoMax !== undefined
        ? {
            precoBase: {
              ...(query.precoMin !== undefined ? { gte: query.precoMin } : {}),
              ...(query.precoMax !== undefined ? { lte: query.precoMax } : {}),
            },
          }
        : {}),
      ...(query.cor || query.somenteDisponiveis
        ? {
            variacoes: {
              some: {
                ...(query.cor
                  ? { cor: { contains: query.cor, mode: 'insensitive' } }
                  : {}),
                ...(query.somenteDisponiveis
                  ? { estoque: { gt: new Prisma.Decimal(0) } }
                  : {}),
              },
            },
          }
        : {}),
    };

    const orderBy =
      query.ordenacao === 'preco_asc'
        ? { precoBase: 'asc' as const }
        : query.ordenacao === 'preco_desc'
          ? { precoBase: 'desc' as const }
          : query.ordenacao === 'titulo_asc'
            ? { titulo: 'asc' as const }
            : { criadoEm: 'desc' as const };

    const [items, total] = await Promise.all([
      this.prisma.produto.findMany({
        where,
        include: {
          categoria: true,
          variacoes: {
            include: {
              imagens: {
                orderBy: { ordem: 'asc' },
              },
            },
          },
          imagens: {
            orderBy: { ordem: 'asc' },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.produto.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
