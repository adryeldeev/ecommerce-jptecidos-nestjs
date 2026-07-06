import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateVariationDto } from './dto/create-variation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';

@Controller('catalogo')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
  ) {}

  @Get('produtos')
  listProducts(@Query() query: ListProductsQueryDto) {
    return this.catalogService.listProducts(query);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('categorias')
  async createCategory(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCategoryDto,
  ) {
    const categoria = await this.catalogService.createCategory(dto);
    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.createCategory',
      entidade: 'Categoria',
      entidadeId: categoria.id,
      dados: dto,
    });
    return categoria;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('produtos')
  async createProduct(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProductDto,
  ) {
    const produto = await this.catalogService.createProduct(dto);
    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.createProduct',
      entidade: 'Produto',
      entidadeId: produto.id,
      dados: dto,
    });
    return produto;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('variacoes')
  async createVariation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateVariationDto,
  ) {
    const variacao = await this.catalogService.createVariation(dto);
    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.createVariation',
      entidade: 'ProdutoVariacao',
      entidadeId: variacao.id,
      dados: dto,
    });
    return variacao;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('produtos/:id/imagens')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async uploadProductImage(
    @CurrentUser() user: JwtPayload,
    @Param('id') produtoId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('ordem') ordem?: string,
  ) {
    const uploaded = await this.storageService.uploadProductImage({
      buffer: file.buffer,
      originalName: file.originalname,
      contentType: file.mimetype,
    });

    const image = await this.catalogService.createProductImage({
      produtoId,
      url: uploaded.url,
      ordem: ordem ? Number(ordem) : 0,
    });

    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.uploadProductImage',
      entidade: 'ProdutoImagem',
      entidadeId: image.id,
      dados: { produtoId, url: uploaded.url, key: uploaded.key },
    });

    return image;
  }
}
