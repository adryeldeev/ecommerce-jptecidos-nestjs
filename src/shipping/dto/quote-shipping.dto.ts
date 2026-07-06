import { IsOptional, IsPostalCode, IsString, IsIn, IsNumberString } from 'class-validator';

export class QuoteShippingDto {
  @IsPostalCode('BR')
  cep: string;

  @IsNumberString()
  subtotal: string;

  @IsOptional()
  @IsIn(['economico', 'express'])
  metodo?: 'economico' | 'express';

  @IsOptional()
  @IsString()
  estado?: string;
}
