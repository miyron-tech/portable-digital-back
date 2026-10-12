import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DiscountType } from '../schemas/estimate.schema';

/** Ручная скидка менеджера. Процент зажат сотней, фиксированная — в минорных единицах. */
export class ApplyDiscountDto {
  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType, { message: 'Unknown discount type' })
  type!: DiscountType;

  @ApiProperty({ description: 'percent: 0..100; fixed: минорные единицы' })
  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  value!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
