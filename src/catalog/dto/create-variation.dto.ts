import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateVariationDto {
  @IsUUID()
  produtoId: string;

  @IsString()
  @IsNotEmpty()
  cor: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  largura?: string;

  @Matches(/^\d+(\.\d{1,3})?$/)
  estoque: string;

  @IsString()
  @IsNotEmpty()
  sku: string;
}
