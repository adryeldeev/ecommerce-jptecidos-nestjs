import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateFabricanteDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nome?: string;
}
