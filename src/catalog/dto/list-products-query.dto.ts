import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { UnidadeMedida } from '@prisma/client';

export enum OrdenacaoProdutos {
  RECENTES = 'recentes',
  PRECO_ASC = 'preco_asc',
  PRECO_DESC = 'preco_desc',
  TITULO_ASC = 'titulo_asc',
}

export class ListProductsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 12;

  @IsOptional()
  @IsString()
  busca?: string;

  @IsOptional()
  @IsString()
  categoriaSlug?: string;

  @IsOptional()
  @IsString()
  cor?: string;

  @IsOptional()
  @IsEnum(UnidadeMedida)
  unidadeMedida?: UnidadeMedida;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  precoMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  precoMax?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  somenteDisponiveis?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  maisProcurado?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  lancamento?: boolean;

  @IsOptional()
  @IsEnum(OrdenacaoProdutos)
  ordenacao?: OrdenacaoProdutos = OrdenacaoProdutos.RECENTES;
}
