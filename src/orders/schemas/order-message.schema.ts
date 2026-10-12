import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { MessageFile } from '../message-files';

export type OrderMessageDocument = HydratedDocument<OrderMessage>;

export enum MessageAuthorRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
}

/**
 * Переписка по заказу: клиент и менеджер в одной ленте.
 *
 * Прочтение отмечается отдельно для каждой стороны, а не одним флагом: письмо
 * менеджера «непрочитано» для клиента и наоборот, и по этим двум полям
 * считаются счётчики в обоих интерфейсах.
 */
@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      delete ret.__v;
      ret.attachments = (ret.attachments ?? []).map((file: MessageFile, index: number) => ({ index, originalName: file.originalName, mimeType: file.mimeType, size: file.size }));
      return ret;
    },
  },
})
export class OrderMessage {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId!: Types.ObjectId;

  @Prop({ type: String, enum: MessageAuthorRole, required: true })
  authorRole!: MessageAuthorRole;

  /** Имя на момент отправки: профиль потом меняется, а история — нет. */
  @Prop({ required: true, trim: true })
  authorName!: string;

  @Prop({ default: '', trim: true, maxlength: 5000 })
  body!: string;

  @Prop({ type: [{ _id: false, storedName: String, originalName: String, mimeType: String, size: Number }], default: [] })
  attachments!: MessageFile[];

  @Prop({ type: Date, default: null })
  readByCustomerAt?: Date | null;

  @Prop({ type: Date, default: null })
  readByAdminAt?: Date | null;
}

export const OrderMessageSchema = SchemaFactory.createForClass(OrderMessage);

// Лента читается по заказу в хронологии.
OrderMessageSchema.index({ orderId: 1, createdAt: 1 });
// Счётчики непрочитанного по каждой стороне.
OrderMessageSchema.index({ orderId: 1, authorRole: 1, readByAdminAt: 1 });
OrderMessageSchema.index({ orderId: 1, authorRole: 1, readByCustomerAt: 1 });

