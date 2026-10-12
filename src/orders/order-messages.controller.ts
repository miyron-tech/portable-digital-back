import { BadRequestException, Body, Controller, Get, Header, Param, Post, StreamableFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { UploadedFile } from '../leads/leads.service';
import { MESSAGE_MAX_FILES, MESSAGE_MAX_FILE_SIZE, MESSAGE_MIME } from './message-files';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { CreateMessageDto } from './dto/create-message.dto';
import { OrderMessagesService } from './order-messages.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders/:orderNumber/messages')
export class OrderMessagesController {
  constructor(private readonly messages: OrderMessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Conversation on an order; opening it marks the other side read' })
  list(
    @Param('orderNumber') orderNumber: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.messages.list(orderNumber, userId, role === UserRole.ADMIN);
  }

  @RateLimit(30, 60_000)
  @Post()
  @UseInterceptors(FilesInterceptor('files', MESSAGE_MAX_FILES, {
    limits: { fileSize: MESSAGE_MAX_FILE_SIZE, files: MESSAGE_MAX_FILES, fields: 1, fieldSize: 20000 },
    fileFilter: (_req: unknown, file: { mimetype: string }, callback: (error: Error | null, accept: boolean) => void) => {
      if (!MESSAGE_MIME.has(file.mimetype)) return callback(new BadRequestException('Use JPG, PNG, WebP or PDF files'), false);
      callback(null, true);
    },
  }))
  @ApiOperation({ summary: 'Post a message to the order conversation' })
  create(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: CreateMessageDto,
    @UploadedFiles() files: UploadedFile[] | undefined,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.messages.create(orderNumber, userId, role === UserRole.ADMIN, dto.body ?? '', files ?? []);
  }
  @Get(':messageId/files/:index')
  @Header('Cache-Control', 'private, no-store')
  async download(
    @Param('orderNumber') orderNumber: string,
    @Param('messageId') messageId: string,
    @Param('index') index: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    const { stream, file } = await this.messages.openFile(orderNumber, userId, role === UserRole.ADMIN, messageId, Number(index));
    return new StreamableFile(stream, {
      type: file.mimeType,
      length: file.size,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    });
  }
}
