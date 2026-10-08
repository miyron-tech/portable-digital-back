import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PricingModel } from '../../services/schemas/service.schema';

/**
 * Клиент выбирает услугу, тариф и объём — но не цену. Все суммы сервер берёт
 * из каталога: присланная клиентом цена в расчёт не попадает вообще.
 */
export class AddEstimateItemDto {
  @ApiProperty()
  @IsMongoId()
  serviceId!: string;

  @ApiProperty({ enum: PricingModel })
  @IsEnum(PricingModel, { message: 'Unknown pricing model' })
  model!: PricingModel;

  @ApiPropertyOptional({
    default: 1,
    description: 'hourly/mixed — часы, retainer — периоды, fixed — число проектов',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  units?: number;

  @ApiPropertyOptional({ default: 0, description: 'retainer: часы сверх включённых' })
  @IsOptional()
  @IsInt()
  @Min(0)
  extraHours?: number;

  @ApiPropertyOptional({ description: 'fixed/mixed: ключи выбранных этапов' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  milestoneKeys?: string[];

  @ApiPropertyOptional({ description: 'Пустая строка очищает примечание' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
