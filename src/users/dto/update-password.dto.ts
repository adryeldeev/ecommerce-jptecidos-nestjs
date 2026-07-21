import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  @IsNotEmpty()
  senhaAtual: string;

  @IsString()
  @MinLength(6)
  novaSenha: string;
}
