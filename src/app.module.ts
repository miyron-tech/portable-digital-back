import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { EstimateModule } from './estimate/estimate.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { MongoExceptionFilter } from './common/filters/mongo-exception.filter';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HealthController } from './health.controller';
import { LeadsModule } from './leads/leads.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { ServicesModule } from './services/services.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('mongodbUri'),
      }),
    }),
    UsersModule,
    AuthModule,
    ServicesModule,
    LeadsModule,
    EstimateModule,
    OrdersModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
    // Everything is protected by default; endpoints opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // После JwtAuthGuard: роли проверяются у уже опознанного пользователя.
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: MongoExceptionFilter },
  ],
})
export class AppModule {}
