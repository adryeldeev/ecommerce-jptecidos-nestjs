import { UnidadeMedida } from '@prisma/client';
import {
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
}
