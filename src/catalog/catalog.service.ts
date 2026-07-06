import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateVariationDto } from './dto/create-variation.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { CreateProductImageInput } from './types/create-product-image-input.type';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  createCategory(dto: CreateCategoryDto) {
    return this.prisma.categoria.create({ data: dto });
  }

  createProduct(dto: CreateProductDto) {
    return this.prisma.produto.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        precoBase: new Prisma.Decimal(dto.precoBase),
        unidadeMedida: dto.unidadeMedida,
        categoriaId: dto.categoriaId,
      },
    });
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

  createProductImage(input: CreateProductImageInput) {
    return this.prisma.produtoImagem.create({
      data: {
        produtoId: input.produtoId,
        url: input.url,
        ordem: input.ordem ?? 0,
      },
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
          variacoes: true,
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
