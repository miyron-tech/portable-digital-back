import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { EstimateOwner, EstimateService } from './estimate.service';
import { AddEstimateItemDto } from './dto/add-estimate-item.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { PriceSelectionDto } from './dto/price-selection.dto';
import { UpdateEstimateItemDto } from './dto/update-estimate-item.dto';

/** Гостевой ключ сметы. Для залогиненного игнорируется — владелец из JWT. */
const ESTIMATE_TOKEN_HEADER = 'X-Estimate-Token';

@ApiTags('estimate')
@ApiHeader({ name: ESTIMATE_TOKEN_HEADER, required: false, description: 'Guest estimate key' })
@Controller('estimate')
export class EstimateController {
  constructor(private readonly estimate: EstimateService) {}

  /**
   * `@Public()` снимает глобальный `JwtAuthGuard`, `OptionalJwtAuthGuard`
   * возвращает личность, если токен всё-таки прислали. Порядок важен: без
   * `@Public()` гость получал бы 401 ещё до контроллера.
   */
  private static owner(userId: string | undefined, token: string | undefined): EstimateOwner {
    return { userId: userId ?? null, token: token ?? null };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Current estimate (guest or signed-in)' })
  get(
    @CurrentUser('sub') userId?: string,
    @Headers('x-estimate-token') token?: string,
  ) {
    return this.estimate.getEstimate(EstimateController.owner(userId, token));
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @RateLimit(60, 60_000)
  @Post('items')
  @ApiOperation({ summary: 'Add a service to the estimate' })
  addItem(
    @Body() dto: AddEstimateItemDto,
    @CurrentUser('sub') userId?: string,
    @Headers('x-estimate-token') token?: string,
  ) {
    return this.estimate.addItem(EstimateController.owner(userId, token), dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @RateLimit(120, 60_000)
  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Change an item — volume, milestones, notes' })
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateEstimateItemDto,
    @CurrentUser('sub') userId?: string,
    @Headers('x-estimate-token') token?: string,
  ) {
    return this.estimate.updateItem(EstimateController.owner(userId, token), itemId, dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove an item' })
  removeItem(
    @Param('itemId') itemId: string,
    @CurrentUser('sub') userId?: string,
    @Headers('x-estimate-token') token?: string,
  ) {
    return this.estimate.removeItem(EstimateController.owner(userId, token), itemId);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Delete('items')
  @ApiOperation({ summary: 'Empty the estimate' })
  clear(@CurrentUser('sub') userId?: string, @Headers('x-estimate-token') token?: string) {
    return this.estimate.clear(EstimateController.owner(userId, token));
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @RateLimit(20, 60_000)
  @Post('refresh')
  @ApiOperation({ summary: 'Accept current catalogue prices' })
  refresh(@CurrentUser('sub') userId?: string, @Headers('x-estimate-token') token?: string) {
    return this.estimate.refresh(EstimateController.owner(userId, token));
  }

  @Public()
  @RateLimit(30, 60_000)
  @Post('price')
  @ApiOperation({ summary: 'Price a selection without saving it' })
  price(@Body() dto: PriceSelectionDto) {
    return this.estimate.price(dto);
  }

  @ApiBearerAuth()
  @RateLimit(20, 60_000)
  @Post('merge')
  @ApiOperation({ summary: 'Merge a guest estimate into the signed-in one' })
  merge(
    @CurrentUser('sub') userId: string,
    @Headers('x-estimate-token') token?: string,
  ) {
    if (!token) return this.estimate.getEstimate({ userId });
    return this.estimate.merge(userId, token);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Get(':estimateId')
  @ApiOperation({ summary: 'Read any estimate (admin)' })
  findOne(@Param('estimateId') estimateId: string) {
    return this.estimate.findById(estimateId);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Patch(':estimateId/discount')
  @ApiOperation({ summary: 'Set a manual discount (admin)' })
  setDiscount(@Param('estimateId') estimateId: string, @Body() dto: ApplyDiscountDto) {
    return this.estimate.applyDiscount(estimateId, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @Delete(':estimateId/discount')
  @ApiOperation({ summary: 'Clear the manual discount (admin)' })
  clearDiscount(@Param('estimateId') estimateId: string) {
    return this.estimate.applyDiscount(estimateId, null);
  }
}
