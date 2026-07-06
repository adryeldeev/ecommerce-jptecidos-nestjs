import { Transform, Type } from 'class-transformer';
import { StatusPedido } from '@prisma/client';
import { IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListOrdersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(StatusPedido)
  status?: StatusPedido;

  @IsOptional()
  @IsString()
  metodoPagamento?: string;

  @IsOptional()
  @IsEmail()
  emailCliente?: string;

  @IsOptional()
  @IsDateString()
  criadoDe?: string;

  @IsOptional()
  @IsDateString()
  criadoAte?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  admin?: boolean;
}
