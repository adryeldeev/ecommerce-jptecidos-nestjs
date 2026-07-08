import { StatusPedido } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsEnum(StatusPedido)
  status: StatusPedido;
}