import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateVariationDto {
  @IsUUID()
  produtoId: string;

  @IsString()
  @IsNotEmpty()
  cor: string;

  @IsOptional()
  @IsString()
  corCodigo?: string;

  @Matches(/^\d+(\.\d{1,3})?$/)
  estoque: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  metragemPorPeca?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  preco?: string;

  @IsString()
  @IsNotEmpty()
  sku: string;
}
