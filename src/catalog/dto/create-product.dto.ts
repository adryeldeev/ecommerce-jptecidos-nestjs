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

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @Matches(/^\d+(\.\d{1,2})?$/)
  precoBase: string;

  @IsEnum(UnidadeMedida)
  unidadeMedida: UnidadeMedida;

  @IsUUID()
  categoriaId: string;

  @IsString()
  @IsOptional()
  composicao?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  gramatura?: string;

  @IsOptional()
  @IsUUID()
  fabricanteId?: string;

  @IsString()
  @IsOptional()
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
}
