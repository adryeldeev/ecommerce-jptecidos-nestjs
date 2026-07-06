import { IsOptional, IsPostalCode, IsString, Length } from 'class-validator';

export class UpdateAddressDto {
  @IsOptional()
  @IsPostalCode('BR')
  cep?: string;

  @IsOptional()
  @IsString()
  rua?: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  estado?: string;
}
