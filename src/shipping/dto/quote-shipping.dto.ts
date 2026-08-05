import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsPostalCode,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class QuoteShippingItemDto {
  @IsUUID()
  produtoVariacaoId: string;

  @Matches(/^\d+(\.\d{1,3})?$/)
  quantidade: string;
}

export class QuoteShippingDto {
  @IsPostalCode('BR')
  cep: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteShippingItemDto)
  itens: QuoteShippingItemDto[];

  @IsOptional()
  @IsIn(['economico', 'express'])
  metodo?: 'economico' | 'express';
}
