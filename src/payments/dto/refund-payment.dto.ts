import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefundPaymentDto {
  @ApiPropertyOptional({ description: 'Почему вернули — остаётся в истории платежа' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
