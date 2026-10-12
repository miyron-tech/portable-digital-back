import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({ example: '482913' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'orderNumber must be six digits' })
  orderNumber!: string;
}
