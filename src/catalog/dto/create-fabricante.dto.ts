import { IsNotEmpty, IsString } from 'class-validator';

export class CreateFabricanteDto {
  @IsString()
  @IsNotEmpty()
  nome: string;
}
