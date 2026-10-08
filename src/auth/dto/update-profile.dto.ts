import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class BillingAddressDto {
  @IsString() @MinLength(1, { message: 'Address is required' }) @MaxLength(200)
  addressLine1!: string;

  @IsString() @MinLength(1, { message: 'City is required' }) @MaxLength(100)
  city!: string;

  @IsString() @MinLength(1, { message: 'Postcode is required' }) @MaxLength(20)
  postalCode!: string;

  @IsString()
  @Matches(/^[A-Za-z]{2}$/, { message: 'Country must be a two-letter ISO code' })
  countryCode!: string;
}

/**
 * Имя и платёжный адрес — то, без чего провайдер не принимает оплату.
 * Можно прислать что-то одно; имя — только парой, чтобы не гадать, где кончается
 * одно и начинается другое.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional()
  @ValidateIf((dto: UpdateProfileDto) => dto.firstName !== undefined || dto.lastName !== undefined)
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  @MaxLength(40)
  firstName?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: UpdateProfileDto) => dto.firstName !== undefined || dto.lastName !== undefined)
  @IsString()
  @MinLength(1, { message: 'Last name is required' })
  @MaxLength(40)
  lastName?: string;

  @ApiPropertyOptional({ type: BillingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BillingAddressDto)
  billingAddress?: BillingAddressDto;
}
