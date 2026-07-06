import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateOrderItemDto {
  @IsUUID()
  produtoVariacaoId: string;

  @Matches(/^\d+(\.\d{1,3})?$/)
  quantidade: string;
}

export class CreateOrderDto {
  @IsUUID()
  enderecoId: string;

  @IsOptional()
  @IsIn(['economico', 'express'])
  freteMetodo?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  frete?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['cartao', 'pix', 'boleto'])
  metodoPagamento: string;

  @ValidateIf((o: CreateOrderDto) => o.metodoPagamento === 'cartao')
  @IsString()
  @IsNotEmpty()
  @Matches(/^pm_[A-Za-z0-9_]+$/)
  paymentMethodId?: string;

  @ValidateIf((o: CreateOrderDto) => o.metodoPagamento === 'cartao')
  @IsString()
  @IsIn(['stripe'])
  paymentProvider?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  itens: CreateOrderItemDto[];
}
