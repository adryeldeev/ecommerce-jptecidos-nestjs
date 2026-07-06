import { IsNotEmpty, IsOptional, IsPostalCode, IsString, Length } from 'class-validator';

export class CreateAddressDto {
  @IsPostalCode('BR')
  cep: string;

  @IsString()
  @IsNotEmpty()
  rua: string;

  @IsString()
  @IsNotEmpty()
  numero: string;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsString()
  @IsNotEmpty()
  bairro: string;

  @IsString()
  @IsNotEmpty()
  cidade: string;

  @IsString()
  @Length(2, 2)
  estado: string;
}
