import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Незаполненное поле multipart-формы приходит пустой строкой, а `@IsOptional()`
 * пропускает только `null`/`undefined`. Без этого пустой телефон проваливал бы
 * проверку формата при заполненной почте — и наоборот.
 */
function emptyToUndefined({ value }: { value: unknown }) {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

export class CreateLeadDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'jane@company.com' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @ApiPropertyOptional({ example: '+1 555 010 0000' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @Matches(/^[+()\d\s-]{6,32}$/, { message: 'Invalid phone number' })
  phone?: string;

  @ApiProperty({ example: 'We need a customer portal on top of an existing ERP…' })
  @IsString()
  @MinLength(20, { message: 'Please describe the project in at least 20 characters' })
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ example: 8, minimum: 1, maximum: 52 })
  @IsInt({ message: 'Timeline must be a whole number of weeks' })
  @Min(1, { message: 'Timeline must be at least 1 week' })
  @Max(52, { message: 'Timeline must be 52 weeks or less' })
  timelineWeeks!: number;
}
