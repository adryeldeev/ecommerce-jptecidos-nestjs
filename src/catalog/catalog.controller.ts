import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { CreateFabricanteDto } from './dto/create-fabricante.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateVariationDto } from './dto/create-variation.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateFabricanteDto } from './dto/update-fabricante.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateVariationDto } from './dto/update-variation.dto';
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

  @Get('categorias')
  listCategories() {
    return this.catalogService.listCategories();
  }

  @Get('produtos')
  listProducts(@Query() query: ListProductsQueryDto) {
    return this.catalogService.listProducts(query);
  }

  @Get('produtos/:slug')
  getProductBySlug(@Param('slug') slug: string) {
    return this.catalogService.getProductBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('produtos/:id/imagens')
  listProductImages(@Param('id') produtoId: string) {
    return this.catalogService.listProductImages(produtoId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('variacoes/:id/imagens')
  listVariationImages(@Param('id') variationId: string) {
    return this.catalogService.listVariationImages(variationId);
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
  @Patch('categorias/:id')
  async updateCategory(
    @CurrentUser() user: JwtPayload,
    @Param('id') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const categoria = await this.catalogService.updateCategory(categoryId, dto);
    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.updateCategory',
      entidade: 'Categoria',
      entidadeId: categoria.id,
      dados: dto,
    });
    return categoria;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('categorias/:id')
  async removeCategory(
    @CurrentUser() user: JwtPayload,
    @Param('id') categoryId: string,
  ) {
    const result = await this.catalogService.removeCategory(categoryId);
    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.removeCategory',
      entidade: 'Categoria',
      entidadeId: categoryId,
      dados: { deleted: true },
    });
    return result;
  }

  @Get('fabricantes')
  listFabricantes() {
    return this.catalogService.listFabricantes();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('fabricantes')
  async createFabricante(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateFabricanteDto,
  ) {
    const fabricante = await this.catalogService.createFabricante(dto);
    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.createFabricante',
      entidade: 'Fabricante',
      entidadeId: fabricante.id,
      dados: dto,
    });
    return fabricante;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('fabricantes/:id')
  async updateFabricante(
    @CurrentUser() user: JwtPayload,
    @Param('id') fabricanteId: string,
    @Body() dto: UpdateFabricanteDto,
  ) {
    const fabricante = await this.catalogService.updateFabricante(fabricanteId, dto);
    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.updateFabricante',
      entidade: 'Fabricante',
      entidadeId: fabricante.id,
      dados: dto,
    });
    return fabricante;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('fabricantes/:id')
  async removeFabricante(
    @CurrentUser() user: JwtPayload,
    @Param('id') fabricanteId: string,
  ) {
    const result = await this.catalogService.removeFabricante(fabricanteId);
    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.removeFabricante',
      entidade: 'Fabricante',
      entidadeId: fabricanteId,
      dados: { deleted: true },
    });
    return result;
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
  @Patch('produtos/:id')
  async updateProduct(
    @CurrentUser() user: JwtPayload,
    @Param('id') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    const produto = await this.catalogService.updateProduct(productId, dto);
    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.updateProduct',
      entidade: 'Produto',
      entidadeId: produto.id,
      dados: dto,
    });
    return produto;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('produtos/:id')
  async removeProduct(
    @CurrentUser() user: JwtPayload,
    @Param('id') productId: string,
  ) {
    const result = await this.catalogService.removeProduct(productId);
    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.removeProduct',
      entidade: 'Produto',
      entidadeId: productId,
      dados: { deleted: true },
    });
    return result;
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
  @Patch('variacoes/:id')
  async updateVariation(
    @CurrentUser() user: JwtPayload,
    @Param('id') variationId: string,
    @Body() dto: UpdateVariationDto,
  ) {
    const variacao = await this.catalogService.updateVariation(variationId, dto);
    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.updateVariation',
      entidade: 'ProdutoVariacao',
      entidadeId: variacao.id,
      dados: dto,
    });
    return variacao;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('variacoes/:id')
  async removeVariation(
    @CurrentUser() user: JwtPayload,
    @Param('id') variationId: string,
  ) {
    const result = await this.catalogService.removeVariation(variationId);
    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.removeVariation',
      entidade: 'ProdutoVariacao',
      entidadeId: variationId,
      dados: { deleted: true },
    });
    return result;
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

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('variacoes/:id/imagens')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async uploadVariationImage(
    @CurrentUser() user: JwtPayload,
    @Param('id') variationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('produtoId') produtoId: string,
    @Body('ordem') ordem?: string,
  ) {
    const uploaded = await this.storageService.uploadProductImage({
      buffer: file.buffer,
      originalName: file.originalname,
      contentType: file.mimetype,
    });

    const image = await this.catalogService.createProductImage({
      produtoId,
      produtoVariacaoId: variationId,
      url: uploaded.url,
      ordem: ordem ? Number(ordem) : undefined,
    });

    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.uploadVariationImage',
      entidade: 'ProdutoImagem',
      entidadeId: image.id,
      dados: { produtoId, variationId, url: uploaded.url, key: uploaded.key },
    });

    return image;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('produtos/:produtoId/imagens/:imagemId/capa')
  async setProductImageAsCover(
    @CurrentUser() user: JwtPayload,
    @Param('produtoId') produtoId: string,
    @Param('imagemId') imagemId: string,
  ) {
    const image = await this.catalogService.setProductImageAsCover(
      produtoId,
      imagemId,
    );

    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.setProductImageAsCover',
      entidade: 'ProdutoImagem',
      entidadeId: imagemId,
      dados: { produtoId, imagemId },
    });

    return image;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('variacoes/:variacaoId/imagens/:imagemId/capa')
  async setVariationImageAsCover(
    @CurrentUser() user: JwtPayload,
    @Param('variacaoId') variationId: string,
    @Param('imagemId') imageId: string,
  ) {
    const image = await this.catalogService.setVariationImageAsCover(
      variationId,
      imageId,
    );

    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'catalog.setVariationImageAsCover',
      entidade: 'ProdutoImagem',
      entidadeId: imageId,
      dados: { variationId, imageId },
    });

    return image;
  }
}
