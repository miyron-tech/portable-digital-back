import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Estimate, EstimateSchema } from '../estimate/schemas/estimate.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { OrderMessagesController } from './order-messages.controller';
import { OrderMessagesService } from './order-messages.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderMessage, OrderMessageSchema } from './schemas/order-message.schema';
import { Order, OrderSchema } from './schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderMessage.name, schema: OrderMessageSchema },
      { name: Estimate.name, schema: EstimateSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: User.name, schema: UserSchema },
      // Модель платежа нужна только на чтение — для сводки в списке заказов.
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [OrdersController, OrderMessagesController],
  providers: [OrdersService, OrderMessagesService],
  exports: [OrdersService, OrderMessagesService],
})
export class OrdersModule {}
