import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  BillingPeriod,
  PricingModel,
  ServiceCategory,
} from '../schemas/service.schema';

class VolumeTierDto {
  @IsInt() @Min(1) minHours!: number;
  @IsInt() @Min(0) @Max(90) discountPercent!: number;
}

class ServiceMilestoneDto {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'milestone key may contain only lowercase latin letters, digits and hyphens',
  })
  key!: string;

  @IsString() @MinLength(2) @MaxLength(120) title!: string;

  /** В минорных единицах валюты услуги. */
  @IsInt() @Min(0) amount!: number;

  @IsOptional() @IsBoolean() required?: boolean;
}

/** Тариф услуги. Суммы — целые минорные единицы, как и везде в проекте. */
class ServiceRateDto {
  @IsEnum(PricingModel, { message: 'Unknown pricing model' })
  model!: PricingModel;

  @IsInt() @Min(0) amount!: number;

  @IsOptional() @IsInt() @Min(0) baseAmount?: number;
  @IsOptional() @IsInt() @Min(0) includedHours?: number;
  @IsOptional() @IsInt() @Min(0) overageAmount?: number;

  @IsOptional() @IsEnum(BillingPeriod, { message: 'Unknown billing period' })
  period?: BillingPeriod;

  @IsOptional() @IsInt() @Min(1) minUnits?: number;
  @IsOptional() @IsInt() @Min(1) maxUnits?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => VolumeTierDto)
  tiers?: VolumeTierDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ServiceMilestoneDto)
  milestones?: ServiceMilestoneDto[];

  @IsOptional() @IsString() @MaxLength(80) label?: string;
}

class SeoDto {
  @IsOptional() @IsString() @MaxLength(70) metaTitle?: string;
  @IsOptional() @IsString() @MaxLength(180) metaDescription?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
}

export class CreateServiceDto {
  @IsString() @MinLength(3) @MaxLength(120) title!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug may contain only lowercase latin letters, digits and hyphens',
  })
  slug!: string;

  @IsString() @MinLength(10) @MaxLength(300) summary!: string;

  @IsString() @MinLength(20) description!: string;

  @IsEnum(ServiceCategory, { message: 'Unknown service category' })
  category!: ServiceCategory;

  @IsOptional() @IsInt() @Min(0) priceFrom?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() @MaxLength(60) deliveryTime?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ServiceRateDto)
  pricing?: ServiceRateDto[];

  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];

  @IsOptional() @IsString() @MaxLength(8) icon?: string;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsInt() order?: number;

  @IsOptional() @ValidateNested() @Type(() => SeoDto) seo?: SeoDto;
}
