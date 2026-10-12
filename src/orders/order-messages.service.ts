import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createReadStream, promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { UploadedFile } from '../leads/leads.service';
import { MESSAGE_UPLOAD_ROOT, persistMessageFiles, removeMessageFiles } from './message-files';
import { User, UserDocument } from '../users/schemas/user.schema';
import { OrdersService } from './orders.service';
import {
  MessageAuthorRole,
  OrderMessage,
  OrderMessageDocument,
} from './schemas/order-message.schema';

@Injectable()
export class OrderMessagesService {
  constructor(
    @InjectModel(OrderMessage.name)
    private readonly messageModel: Model<OrderMessageDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly orders: OrdersService,
  ) {}

  /**
   * Доступ к переписке — тот же, что к заказу: владелец или админ. Проверку не
   * дублируем, а переиспользуем, иначе правила разъедутся.
   */
  private async resolveScope(orderNumber: string, userId: string, isAdmin: boolean) {
    const order = await this.orders.findByNumber(orderNumber, userId, isAdmin) as unknown as { id: string };
    return { orderId: new Types.ObjectId(order.id) };
  }

  /**
   * Лента заказа. Открытие ленты отмечает прочитанными сообщения ПРОТИВОПОЛОЖНОЙ
   * стороны: свои собственные непрочитанными не бывают.
   */
  async list(orderNumber: string, userId: string, isAdmin: boolean) {
    const scope = await this.resolveScope(orderNumber, userId, isAdmin);

    const now = new Date();
    if (isAdmin) {
      await this.messageModel
        .updateMany(
          { ...scope, authorRole: MessageAuthorRole.CUSTOMER, readByAdminAt: null },
          { $set: { readByAdminAt: now } },
        )
        .exec();
    } else {
      await this.messageModel
        .updateMany(
          { ...scope, authorRole: MessageAuthorRole.ADMIN, readByCustomerAt: null },
          { $set: { readByCustomerAt: now } },
        )
        .exec();
    }

    const messages = await this.messageModel.find(scope).sort({ createdAt: 1 }).exec();
    return {
      orderNumber,
      items: messages.map((message) => message.toJSON()),
    };
  }

  async create(orderNumber: string, userId: string, isAdmin: boolean, body = '', files: UploadedFile[] = []) {
    const scope = await this.resolveScope(orderNumber, userId, isAdmin);
    const author = await this.userModel.findById(userId).exec();
    if (!author) throw new NotFoundException('User not found');

    if (!body.trim() && !files.length) throw new BadRequestException('Write a message or attach a file');
    const attachments = await persistMessageFiles(files);
    try {
      const message = await this.messageModel.create({
        ...scope,
        authorId: author._id,
        authorRole: isAdmin ? MessageAuthorRole.ADMIN : MessageAuthorRole.CUSTOMER,
        authorName: author.name,
        body: body.trim(),
        attachments,
        // Автор своё сообщение уже «прочитал».
        readByAdminAt: isAdmin ? new Date() : null,
        readByCustomerAt: isAdmin ? null : new Date(),
      });

      return message.toJSON();
    } catch (error) {
      await removeMessageFiles(attachments);
      throw error;
    }
  }

  async openFile(orderNumber: string, userId: string, isAdmin: boolean, messageId: string, index: number) {
    const scope = await this.resolveScope(orderNumber, userId, isAdmin);
    if (!Types.ObjectId.isValid(messageId) || !Number.isInteger(index) || index < 0) throw new NotFoundException('Attachment not found');
    const message = await this.messageModel.findOne({ _id: messageId, ...scope }).exec();
    const file = message?.attachments?.[index];
    if (!file) throw new NotFoundException('Attachment not found');
    const path = join(MESSAGE_UPLOAD_ROOT, file.storedName);
    await fs.access(path).catch(() => { throw new NotFoundException('Attachment not found'); });
    return { stream: createReadStream(path), file };
  }
}
