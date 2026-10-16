import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ServiceCategory } from '../schemas/service.schema';

export class QueryServicesDto {
  @IsOptional()
  @IsEnum(ServiceCategory, { message: 'Unknown service category' })
  category?: ServiceCategory;

  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() tag?: string;

  @IsOptional() @IsIn(['published', 'draft']) visibility?: 'published' | 'draft';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number = 12;
}
