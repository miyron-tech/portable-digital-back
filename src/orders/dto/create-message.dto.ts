import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;
}
