import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
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

class PagamentoDto {
  @IsOptional()
  @IsString()
  paymentType?: string;

  @IsOptional()
  @IsString()
  selectedPaymentMethod?: string;

  // Formato varia por metodo de pagamento (cartao/pix/boleto) -- e o retorno
  // literal do onSubmit do Payment Brick, nao validamos campo a campo aqui
  // pra nao acoplar no formato interno do SDK do Mercado Pago.
  @IsObject()
  @IsNotEmpty()
  formData: Record<string, any>;
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
  @Matches(/^[A-Za-z0-9_-]+$/)
  paymentMethodId?: string;

  @ValidateIf((o: CreateOrderDto) => o.metodoPagamento === 'cartao')
  @IsString()
  @IsIn(['mercadopago'])
  paymentProvider?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PagamentoDto)
  pagamento?: PagamentoDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  itens: CreateOrderItemDto[];
}
