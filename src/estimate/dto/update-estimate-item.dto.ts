import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** Правка позиции. Пропущенное поле остаётся как было. */
export class UpdateEstimateItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  units?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  extraHours?: number;

  @ApiPropertyOptional()
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
