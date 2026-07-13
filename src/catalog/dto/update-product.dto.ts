import { UnidadeMedida } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
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
  @IsEnum(UnidadeMedida)
  unidadeMedida?: UnidadeMedida;

  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @IsOptional()
  @IsString()
  composicao?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  gramatura?: string;

  @IsOptional()
  @IsUUID()
  fabricanteId?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pesoGramas?: number;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  dimensaoAlturaCm?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  dimensaoLarguraCm?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  dimensaoComprimentoCm?: string;

  @IsOptional()
  @Matches(/^[a-z0-9-]+$/)
  slug?: string;
}