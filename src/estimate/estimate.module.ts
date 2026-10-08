import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { EstimateController } from './estimate.controller';
import { EstimateService } from './estimate.service';
import { Estimate, EstimateSchema } from './schemas/estimate.schema';

@Module({
  imports: [
    // AuthModule re-exports PassportModule — без него OptionalJwtAuthGuard
    // не может разрешить AuthModuleOptions в контексте этого модуля.
    AuthModule,
    MongooseModule.forFeature([
      { name: Estimate.name, schema: EstimateSchema },
      // Каталог нужен на чтение: цены позиций разрешаются только из него.
      { name: Service.name, schema: ServiceSchema },
    ]),
  ],
  controllers: [EstimateController],
  providers: [EstimateService],
  exports: [EstimateService],
})
export class EstimateModule {}
