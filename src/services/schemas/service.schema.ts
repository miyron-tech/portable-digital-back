import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ServiceDocument = HydratedDocument<Service>;

export enum ServiceCategory {
  DEVELOPMENT = 'development',
  DESIGN = 'design',
  INFRASTRUCTURE = 'infrastructure',
  DATA = 'data',
  MONITORING = 'monitoring',
  SUPPORT = 'support',
}

/**
 * Как услуга считается. `MIXED` — это двухчастный договор, на котором обычно и
 * заканчивается IT-работа: фиксированная база за описанный объём плюс часовая
 * ставка на то, что объёмом заранее не прижать.
 */
export enum PricingModel {
  HOURLY = 'hourly',
  FIXED = 'fixed',
  MIXED = 'mixed',
  RETAINER = 'retainer',
}

export enum BillingPeriod {
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

/** Объёмная скидка: с `minHours` часов ставка падает на `discountPercent`. */
@Schema({ _id: false })
export class VolumeTier {
  @Prop({ required: true, min: 1 })
  minHours!: number;

  @Prop({ required: true, min: 0, max: 90 })
  discountPercent!: number;
}
const VolumeTierSchema = SchemaFactory.createForClass(VolumeTier);

/** Этап фиксированной услуги. Клиент выбирает подмножество, цена — сумма выбранных. */
@Schema({ _id: false })
export class ServiceMilestone {
  /** Стабильный идентификатор: по нему корзина ссылается на этап. */
  @Prop({ required: true, trim: true })
  key!: string;

  @Prop({ required: true, trim: true })
  title!: string;

  /** В минорных единицах валюты услуги. */
  @Prop({ required: true, min: 0 })
  amount!: number;

  /** Этап, без которого услугу не продать — входит в заказ всегда. */
  @Prop({ default: false })
  required!: boolean;
}
const ServiceMilestoneSchema = SchemaFactory.createForClass(ServiceMilestone);

/**
 * Один тариф услуги. Все суммы — в минорных единицах `Service.currency`:
 * деньги в проекте целочисленные, поэтому расчёт не накапливает дрейф float.
 *
 * Смысл `units` зависит от модели: `HOURLY`/`MIXED` — часы, `RETAINER` —
 * число периодов, `FIXED` — всегда 1.
 */
@Schema({ _id: false })
export class ServiceRate {
  @Prop({ type: String, enum: PricingModel, required: true })
  model!: PricingModel;

  /** `HOURLY`/`MIXED` — за час; `FIXED` — за проект; `RETAINER` — за период. */
  @Prop({ required: true, min: 0 })
  amount!: number;

  /** Только `MIXED`: база, добавляемая один раз поверх `amount` × часы. */
  @Prop({ min: 0, default: 0 })
  baseAmount!: number;

  /** Только `RETAINER`: часы, уже покрытые абонплатой. */
  @Prop({ min: 0, default: 0 })
  includedHours!: number;

  /** Только `RETAINER`: ставка за час сверх `includedHours`. */
  @Prop({ min: 0, default: 0 })
  overageAmount!: number;

  @Prop({ type: String, enum: BillingPeriod, default: null })
  period?: BillingPeriod | null;

  @Prop({ min: 1, default: 1 })
  minUnits!: number;

  /** `null` — верхней границы нет. */
  @Prop({ type: Number, min: 1, default: null })
  maxUnits?: number | null;

  /** Действуют на часовую часть суммы: часы `HOURLY`/`MIXED` и переработку ретейнера. */
  @Prop({ type: [VolumeTierSchema], default: [] })
  tiers!: VolumeTier[];

  /** Только `FIXED`/`MIXED`. Непустой список делает цену суммой выбранных этапов. */
  @Prop({ type: [ServiceMilestoneSchema], default: [] })
  milestones!: ServiceMilestone[];

  @Prop({ trim: true })
  label?: string;
}
const ServiceRateSchema = SchemaFactory.createForClass(ServiceRate);

// Этап выбирается по ключу, поэтому дубль ключа удвоил бы его в сумме.
ServiceRateSchema.path('milestones').validate(
  (milestones: ServiceMilestone[]) =>
    new Set(milestones.map((milestone) => milestone.key)).size === milestones.length,
  'milestone keys must be unique within a rate',
);

@Schema({ _id: false })
export class ServiceSeo {
  @Prop({ trim: true })
  metaTitle?: string;

  @Prop({ trim: true })
  metaDescription?: string;

  @Prop({ type: [String], default: [] })
  keywords!: string[];
}
const ServiceSeoSchema = SchemaFactory.createForClass(ServiceSeo);

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
export class Service {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  slug!: string;

  @Prop({ required: true, trim: true, maxlength: 300 })
  summary!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ type: String, enum: ServiceCategory, required: true, index: true })
  category!: ServiceCategory;

  /**
   * Витринное «от» для карточки каталога — стартовая цена проекта, в минорных
   * единицах валюты ниже. Продаёт не оно, а `pricing`: почасовой вход дешевле,
   * поэтому равенства `priceFrom === min(pricing)` здесь нет и не подразумевается.
   */
  @Prop({ type: Number, min: 0, default: 0 })
  priceFrom!: number;

  @Prop({ default: 'EUR' })
  currency!: string;

  @Prop({ trim: true })
  deliveryTime?: string;

  /**
   * Тарифы, по которым услугу можно положить в корзину. Пустой список — услуга
   * витринная: показывается, но не продаётся самообслуживанием.
   */
  @Prop({ type: [ServiceRateSchema], default: [] })
  pricing!: ServiceRate[];

  @Prop({ type: [String], default: [] })
  features!: string[];

  @Prop({ type: [String], default: [], index: true })
  tags!: string[];

  @Prop({ default: '⚙️' })
  icon!: string;

  @Prop({ default: true, index: true })
  published!: boolean;

  @Prop({ default: false })
  featured!: boolean;

  @Prop({ type: Number, default: 0 })
  order!: number;

  @Prop({ type: ServiceSeoSchema, default: () => ({}) })
  seo!: ServiceSeo;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);

// Backs the catalogue's free-text search.
ServiceSchema.index({ title: 'text', summary: 'text', description: 'text' });

// Тариф ищется по модели, поэтому дубль модели молча затенил бы второй тариф.
ServiceSchema.path('pricing').validate(
  (rates: ServiceRate[]) => new Set(rates.map((rate) => rate.model)).size === rates.length,
  'pricing must not contain two rates with the same model',
);
