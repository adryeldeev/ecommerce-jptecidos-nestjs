import { UnidadeMedida } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { FINALIDADES_PRODUTO } from '../constants/finalidade-produto.constant';
import type { FinalidadeProduto } from '../constants/finalidade-produto.constant';

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
  @Matches(/^\d+(\.\d{1,2})?$/)
  largura?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  rendimento?: string;

  @IsOptional()
  @Matches(/^[a-z0-9-]+$/)
  slug?: string;

  @IsOptional()
  @IsBoolean()
  maisProcurado?: boolean;

  @IsOptional()
  @IsBoolean()
  lancamento?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(FINALIDADES_PRODUTO, { each: true })
  finalidades?: FinalidadeProduto[];
}