import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { AdminGuard } from '../common/guards/admin.guard';
import { AuditService } from '../audit/audit.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@UseGuards(JwtAuthGuard)
@Controller('pedidos')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  async createOrder(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    const pedido = await this.ordersService.createOrder(user.sub, dto);

    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'orders.create',
      entidade: 'Pedido',
      entidadeId: pedido.id,
      dados: { enderecoId: dto.enderecoId, metodoPagamento: dto.metodoPagamento },
    });

    return pedido;
  }

  @Get()
  listMyOrders(@CurrentUser() user: JwtPayload, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.listUserOrders(user.sub, query);
  }

  @UseGuards(AdminGuard)
  @Get('admin')
  listAllOrders(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.listAdminOrders(query);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/:id/status')
  async updateOrderStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const pedido = await this.ordersService.updateOrderStatus(orderId, dto.status);

    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'orders.updateStatus',
      entidade: 'Pedido',
      entidadeId: pedido.id,
      dados: { status: dto.status },
    });

    return pedido;
  }
}
