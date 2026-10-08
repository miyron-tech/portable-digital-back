import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { AddEstimateItemDto } from './add-estimate-item.dto';

/**
 * Расчёт «на лету» для калькулятора: считает по тем же правилам, что смета,
 * но ничего не сохраняет и не требует владельца.
 */
export class PriceSelectionDto {
  @ApiProperty({ type: [AddEstimateItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AddEstimateItemDto)
  items!: AddEstimateItemDto[];
}
