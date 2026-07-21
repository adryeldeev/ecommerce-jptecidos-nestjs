import { UnidadeMedida } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
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
  @Matches(/^\d+(\.\d{1,2})?$/)
  largura?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  rendimento?: string;

  @IsOptional()
  @IsBoolean()
  maisProcurado?: boolean;

  @IsOptional()
  @IsBoolean()
  lancamento?: boolean;
}
