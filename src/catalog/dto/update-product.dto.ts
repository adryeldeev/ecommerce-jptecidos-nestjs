import { UnidadeMedida } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  precoBase?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,3})?$/)
  quantidadeEstoque?: string;

  @IsOptional()
  @IsEnum(UnidadeMedida)
  unidadeMedida?: UnidadeMedida;

  @IsOptional()
  @IsUUID()
  categoriaId?: string;
}