import { IsOptional, IsString, IsUUID, Matches, IsNotEmpty } from 'class-validator';

export class UpdateVariationDto {
  @IsOptional()
  @IsUUID()
  produtoId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cor?: string;

  @IsOptional()
  @IsString()
  corCodigo?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,3})?$/)
  estoque?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  metragemPorPeca?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  preco?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sku?: string;
}