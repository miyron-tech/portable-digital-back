import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersModule } from '../orders/orders.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { WemopayService } from './wemopay.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      // Имя плательщика — из живого профиля.
      { name: User.name, schema: UserSchema },
    ]),
    OrdersModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, WemopayService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
