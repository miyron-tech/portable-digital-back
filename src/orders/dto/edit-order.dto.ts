import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { PriceSelectionDto } from '../../estimate/dto/price-selection.dto';
import { BillingDto } from './create-order.dto';

export class EditOrderDto extends PriceSelectionDto {
  @IsInt() @Min(0) revision!: number;
  @IsOptional() @IsString() @MaxLength(64) quoteToken?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) company?: string;
  @IsOptional() @ValidateNested() @Type(() => BillingDto) billing?: BillingDto;
}
