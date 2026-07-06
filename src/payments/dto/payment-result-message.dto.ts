import { StatusPedido } from '@prisma/client';

export type PaymentResultMessageDto = {
  pedidoId: string;
  status: StatusPedido;
};
