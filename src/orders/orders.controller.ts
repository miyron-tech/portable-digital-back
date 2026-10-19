import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';
import { EditOrderDto } from './dto/edit-order.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @RateLimit(10, 60_000)
  @Post()
  @ApiOperation({ summary: 'Turn the current estimate into an order' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateOrderDto) {
    return this.orders.createFromEstimate(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'My orders' })
  findMine(@CurrentUser('sub') userId: string) {
    return this.orders.findMine(userId);
  }

  // Объявлен до `:orderNumber`, иначе «all» попал бы в него как номер заказа.
  @Roles(UserRole.ADMIN)
  @Get('all')
  @ApiOperation({ summary: 'All orders (admin)' })
  findAll(@Query() query: QueryOrdersDto) {
    return this.orders.findAll(query);
  }

  @Get(':orderNumber')
  @ApiOperation({ summary: 'Order by number' })
  findOne(
    @Param('orderNumber') orderNumber: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.orders.findByNumber(orderNumber, userId, role === UserRole.ADMIN);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Move an order through its lifecycle (admin)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.updateStatus(id, dto.status);
  }

  @Post(':orderNumber/preview')
  previewEdit(@Param('orderNumber') number: string, @CurrentUser('sub') userId: string, @Body() dto: EditOrderDto) {
    return this.orders.previewEdit(number, userId, dto);
  }

  @Patch(':orderNumber')
  edit(@Param('orderNumber') number: string, @CurrentUser('sub') userId: string, @Body() dto: EditOrderDto) {
    return this.orders.edit(number, userId, dto);
  }
}
