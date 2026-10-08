import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class BillingDto {
  @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;

  /** ISO 3166-1 alpha-2 — провайдер принимает только двухбуквенный код. */
  @IsOptional() @IsString() @Length(2, 2, { message: 'countryCode must be a 2-letter ISO code' })
  countryCode?: string;
}

/**
 * Заказ собирается из активной сметы — позиции и суммы клиент не присылает.
 * Здесь только то, чего нет в профиле: контакты для счёта и платёжный адрес.
 */
export class CreateOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) company?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => BillingDto)
  billing?: BillingDto;
}
