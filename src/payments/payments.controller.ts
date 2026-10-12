import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @ApiBearerAuth()
  @RateLimit(20, 60_000)
  @Post('initiate')
  @ApiOperation({ summary: 'Start paying an order; returns the checkout link' })
  initiate(@CurrentUser('sub') userId: string, @Body() dto: InitiatePaymentDto) {
    return this.payments.initiate(userId, dto.orderNumber);
  }

  /**
   * Вебхук провайдера. Открыт наружу, потому что WemoPay не носит наш JWT —
   * подлинность подтверждает подпись тела, а не заголовок авторизации.
   *
   * Отвечает 200 на любой принятый вебхук: провайдеры обычно ретраят всё, что
   * не 2xx, и ошибка в нашей логике превратилась бы в лавину повторов.
   */
  @Public()
  @ApiExcludeEndpoint()
  @HttpCode(200)
  @Post('webhook')
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('signature') signature: string,
    @Body() body: unknown,
  ) {
    return this.payments.handleWebhook(request.rawBody, signature, body);
  }

  @ApiBearerAuth()
  @Get('status/:orderNumber')
  @ApiOperation({ summary: 'Payment state for an order; ?sync=1 re-reads the provider' })
  status(
    @Param('orderNumber') orderNumber: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('sync') sync?: string,
  ) {
    return this.payments.getStatus(
      userId,
      orderNumber,
      role === UserRole.ADMIN,
      sync === '1' || sync === 'true',
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Get()
  @ApiOperation({ summary: 'All payments with status counts (admin)' })
  findAll(@Query() query: QueryPaymentsDto) {
    return this.payments.findAll(query);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Post(':id/refund')
  @ApiOperation({ summary: 'Mark a paid payment as refunded (admin, manual)' })
  refund(@Param('id') id: string, @Body() dto: RefundPaymentDto) {
    return this.payments.markRefunded(id, dto.note);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Post(':id/resolve')
  @ApiOperation({ summary: 'Clear the "needs review" flag (admin)' })
  resolve(@Param('id') id: string) {
    return this.payments.resolveReview(id);
  }
}
