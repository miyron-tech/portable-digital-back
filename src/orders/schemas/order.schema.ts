import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BillingPeriod, PricingModel } from '../../services/schemas/service.schema';
import { DiscountType } from '../../estimate/schemas/estimate.schema';

export type OrderDocument = HydratedDocument<Order>;

/**
 * Жизненный цикл заказа — про работу, а не про деньги. Состояние платежа
 * живёт отдельно в `Payment`: оплата может провалиться и повториться, а заказ
 * при этом остаётся тем же.
 */
export enum OrderStatus {
  AWAITING_PAYMENT = 'awaiting_payment',
  PAID = 'paid',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * Куда админ может перевести заказ руками. Карта закрыта наглухо: из
 * `completed` и `cancelled` выхода нет, а `awaiting_payment -> paid` делает
 * только платёж, не человек.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.AWAITING_PAYMENT]: [OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
  [OrderStatus.IN_PROGRESS]: [OrderStatus.IN_REVIEW, OrderStatus.CANCELLED],
  [OrderStatus.IN_REVIEW]: [OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Schema({ _id: false })
export class OrderItemMilestone {
  @Prop({ required: true, trim: true })
  key!: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, min: 0 })
  amount!: number;
}
const OrderItemMilestoneSchema = SchemaFactory.createForClass(OrderItemMilestone);

/** Посчитанная стоимость позиции, замороженная на момент заказа. */
@Schema({ _id: false })
export class OrderItemPricing {
  @Prop({ required: true, min: 0 })
  baseTotal!: number;

  @Prop({ required: true, min: 0 })
  billableHours!: number;

  @Prop({ required: true, min: 0 })
  hoursTotal!: number;

  @Prop({ required: true, min: 0 })
  volumeDiscountPercent!: number;

  @Prop({ required: true, min: 0 })
  volumeDiscountAmount!: number;

  @Prop({ required: true, min: 0 })
  total!: number;
}
const OrderItemPricingSchema = SchemaFactory.createForClass(OrderItemPricing);

/**
 * Позиция заказа — снимок позиции сметы вместе с её суммой. Пересчитывать её
 * потом нельзя: заказ должен показывать то, за что человек заплатил, даже если
 * тариф в каталоге с тех пор трижды поменялся.
 */
@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  serviceId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  slug!: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ type: String, enum: PricingModel, required: true })
  model!: PricingModel;

  @Prop({ required: true, min: 0 })
  unitAmount!: number;

  @Prop({ min: 0, default: 0 })
  baseAmount!: number;

  @Prop({ min: 0, default: 0 })
  includedHours!: number;

  @Prop({ min: 0, default: 0 })
  overageAmount!: number;

  @Prop({ type: String, enum: BillingPeriod, default: null })
  period?: BillingPeriod | null;

  @Prop({ required: true, min: 1 })
  units!: number;

  @Prop({ min: 0, default: 0 })
  extraHours!: number;

  @Prop({ type: [OrderItemMilestoneSchema], default: [] })
  milestones!: OrderItemMilestone[];

  @Prop({ type: OrderItemPricingSchema, required: true })
  pricing!: OrderItemPricing;

  @Prop({ type: String, trim: true, maxlength: 1000, default: null })
  notes?: string | null;
}
const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

/** Контакт на момент заказа: профиль потом меняется, заказ — нет. */
@Schema({ _id: false })
export class OrderCustomer {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email!: string;

  @Prop({ type: String, trim: true, default: null })
  phone?: string | null;

  @Prop({ type: String, trim: true, default: null })
  company?: string | null;
}
const OrderCustomerSchema = SchemaFactory.createForClass(OrderCustomer);

/** Платёжный адрес — WemoPay принимает его отдельным блоком. */
@Schema({ _id: false })
export class OrderBilling {
  @Prop({ type: String, trim: true, default: null })
  addressLine1?: string | null;

  @Prop({ type: String, trim: true, default: null })
  city?: string | null;

  @Prop({ type: String, trim: true, default: null })
  postalCode?: string | null;

  /** ISO 3166-1 alpha-2, в верхнем регистре. */
  @Prop({ type: String, trim: true, uppercase: true, maxlength: 2, default: null })
  countryCode?: string | null;
}
const OrderBillingSchema = SchemaFactory.createForClass(OrderBilling);

@Schema({ _id: false })
export class OrderDiscount {
  @Prop({ type: String, enum: DiscountType, required: true })
  type!: DiscountType;

  @Prop({ required: true, min: 0 })
  value!: number;

  @Prop({ type: String, trim: true, default: null })
  reason?: string | null;
}
const OrderDiscountSchema = SchemaFactory.createForClass(OrderDiscount);

/** Согласие с условиями при оформлении: какую редакцию принял клиент и когда. */
@Schema({ _id: false })
export class OrderTermsAcceptance {
  @Prop({ required: true, trim: true })
  version!: string;

  @Prop({ required: true })
  acceptedAt!: Date;
}
const OrderTermsAcceptanceSchema = SchemaFactory.createForClass(OrderTermsAcceptance);

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
export class Order {
  /**
   * Человекочитаемый номер. Из него собирается `referenceId` для WemoPay
   * (`PD-<номер>`), поэтому он обязан быть стабильным и уникальным: по нему
   * платёж находят обратно.
   */
  @Prop({ required: true, unique: true, index: true })
  orderNumber!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  /** Из какой сметы вырос заказ — для истории, не для пересчёта. */
  @Prop({ type: Types.ObjectId, ref: 'Estimate', default: null })
  estimateId?: Types.ObjectId | null;

  @Prop({ type: [OrderItemSchema], required: true })
  items!: OrderItem[];

  @Prop({ type: OrderCustomerSchema, required: true })
  customer!: OrderCustomer;

  @Prop({ type: OrderBillingSchema, default: () => ({}) })
  billing!: OrderBilling;

  @Prop({ required: true, default: 'EUR' })
  currency!: string;

  // ── Замороженные суммы, все в минорных единицах ──────────────────────────
  @Prop({ required: true, min: 0 })
  subtotal!: number;

  @Prop({ type: OrderDiscountSchema, default: null })
  discount?: OrderDiscount | null;

  @Prop({ required: true, min: 0, default: 0 })
  discountAmount!: number;

  @Prop({ required: true, min: 0, default: 0 })
  volumeDiscountTotal!: number;

  /** Сумма к оплате. Единственное число, которое уходит провайдеру. */
  @Prop({ required: true, min: 0 })
  total!: number;

  @Prop({
    type: String,
    enum: OrderStatus,
    default: OrderStatus.AWAITING_PAYMENT,
    index: true,
  })
  status!: OrderStatus;

  @Prop({ type: String, trim: true, maxlength: 2000, default: null })
  note?: string | null;

  /**
   * Редакция условий и момент согласия. У новых заказов есть всегда (без
   * согласия заказ не создаётся); `null` — только у заказов до этого правила,
   * и такой заказ не оплатить.
   */
  @Prop({ type: OrderTermsAcceptanceSchema, default: null })
  termsAcceptance?: OrderTermsAcceptance | null;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Админка открывается списком свежих заказов.
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
