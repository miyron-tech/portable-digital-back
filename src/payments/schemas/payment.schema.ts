import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export enum PaymentProvider {
  WEMOPAY = 'wemopay',
}

/**
 * Состояние денег. Каждому состоянию провайдера соответствует своё — иначе
 * администратор не отличит «клиент не открывал ссылку» от «банк думает», а
 * холд от несписанной оплаты.
 */
export enum PaymentStatus {
  /** Платёж заведён у провайдера, клиент ещё не прошёл оплату. */
  CREATED = 'created',
  /** Отправлено, провайдер обрабатывает. */
  PENDING = 'pending',
  /** Провайдер ждёт ручного действия на своей стороне. */
  AWAITING_APPROVAL = 'awaiting_approval',
  /** Деньги захолдированы, но НЕ списаны. */
  AUTHORIZED = 'authorized',
  /** Списано. */
  PAID = 'paid',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
  /** Возврат. Ставится только руками: API возвратов у нас не подключено. */
  REFUNDED = 'refunded',
}

/**
 * Из этих статусов вебхук платёж не вытащит: защита от повторов и от доставки
 * не по порядку. Отменённый платёж не должен «воскреснуть» в pending из-за
 * задержавшегося сообщения.
 */
export const FINAL_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.DECLINED,
  PaymentStatus.CANCELLED,
  PaymentStatus.REFUNDED,
];

export const isFinalPaymentStatus = (status: PaymentStatus): boolean =>
  FINAL_PAYMENT_STATUSES.includes(status);

/** Почему платёж просит человека посмотреть на него. */
export enum ReviewReason {
  /** Провайдер прислал состояние, которого мы не знаем. */
  UNKNOWN_PROVIDER_STATE = 'unknown_provider_state',
  /** Сумма у провайдера разошлась с нашей. */
  AMOUNT_MISMATCH = 'amount_mismatch',
  /** Пришло состояние, противоречащее уже финальному статусу. */
  CONFLICTING_STATE = 'conflicting_state',
}

/** Номер платежа у провайдера для данной попытки: первая — голый номер заказа. */
export const providerReference = (orderNumber: string, attempt: number): string =>
  attempt > 1 ? `${orderNumber}-${attempt}` : orderNumber;

/** Номер заказа из номера попытки у провайдера: `482913-3` → `482913`. */
export const orderNumberFromReference = (reference: string): string =>
  String(reference).replace(/-\d+$/, '');

/** Запись о каждом ответе провайдера: и вебхук, и опрос. */
@Schema({ _id: false })
export class PaymentEvent {
  @Prop({ required: true, enum: ['webhook', 'sync', 'manual'] })
  source!: 'webhook' | 'sync' | 'manual';

  /** Состояние ровно в том виде, как его прислал провайдер. */
  @Prop({ type: String, default: null })
  providerState?: string | null;

  @Prop({ type: String, default: null })
  status?: string | null;

  /** `updated` | `duplicate` | `conflict` | `unknown`. */
  @Prop({ required: true })
  outcome!: string;

  @Prop({ type: String, default: null })
  errorCode?: string | null;

  @Prop({ type: String, default: null })
  errorMessage?: string | null;

  @Prop({ required: true, default: () => new Date() })
  at!: Date;
}
const PaymentEventSchema = SchemaFactory.createForClass(PaymentEvent);

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  /**
   * Наш идентификатор, он же `referenceId` у провайдера. Совпадает с
   * `order.orderNumber`: по нему платёж находится обратно, если вебхук
   * обогнал наше сохранение или процесс упал между запросом и записью.
   */
  @Prop({ required: true, unique: true, index: true })
  referenceId!: string;

  /**
   * Номер попытки оплаты. Отменённая или отклонённая попытка закрывается, и
   * «Pay now» начинает следующую — со своим номером у провайдера
   * (`<заказ>`, `<заказ>-2`, …), чтобы попытки не путались ни у него, ни у нас.
   */
  @Prop({ type: Number, default: 1, min: 1 })
  attempt!: number;

  /** В минорных единицах, как и всё в проекте. Провайдеру уходит делённым на 100. */
  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, default: 'EUR' })
  currency!: string;

  @Prop({ type: String, enum: PaymentProvider, default: PaymentProvider.WEMOPAY })
  provider!: PaymentProvider;

  @Prop({ type: String, default: null, index: true })
  providerPaymentId?: string | null;

  /** Последнее состояние провайдера дословно — даже если мы его не понимаем. */
  @Prop({ type: String, default: null })
  providerState?: string | null;

  @Prop({ type: String, default: null })
  redirectUrl?: string | null;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.CREATED,
    index: true,
  })
  status!: PaymentStatus;

  /**
   * Флаг «посмотреть руками», а не статус.
   *
   * Отступление от первоначального плана, и намеренное: статусом `needs_review`
   * этот случай не описывается. Платёж бывает одновременно `paid` и странным —
   * например, провайдер прислал `REFUNDED`, которого нет в нашей карте. Будь
   * это статусом, защита терминальности заблокировала бы его ровно тогда, когда
   * он нужнее всего, и возврат прошёл бы незамеченным. Флаг ортогонален статусу
   * и поднимается всегда: и на `pending`, и поверх `paid`.
   */
  @Prop({ default: false, index: true })
  needsReview!: boolean;

  @Prop({ type: String, enum: ReviewReason, default: null })
  reviewReason?: ReviewReason | null;

  @Prop({ type: String, default: null })
  reviewNote?: string | null;

  /** История ответов провайдера — по ней разбирают спорные платежи. */
  @Prop({ type: [PaymentEventSchema], default: [] })
  events!: PaymentEvent[];

  @Prop({ type: String, default: null })
  errorCode?: string | null;

  @Prop({ type: String, default: null })
  errorMessage?: string | null;

  @Prop({ type: Date, default: null })
  paidAt?: Date | null;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ createdAt: -1 });
// Админка фильтрует по статусу и по «требует внимания».
PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ needsReview: 1, createdAt: -1 });
