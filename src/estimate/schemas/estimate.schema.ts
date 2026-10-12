import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BillingPeriod, PricingModel } from '../../services/schemas/service.schema';

export type EstimateDocument = HydratedDocument<Estimate>;

export enum EstimateStatus {
  ACTIVE = 'active',
  /** Смета превращена в заказ и дальше не редактируется. */
  CONVERTED = 'converted',
  ABANDONED = 'abandoned',
}

export enum DiscountType {
  PERCENT = 'percent',
  FIXED = 'fixed',
}

/** Ручная скидка на смету: ставит менеджер, промокодов пока нет. */
@Schema({ _id: false })
export class EstimateDiscount {
  @Prop({ type: String, enum: DiscountType, required: true })
  type!: DiscountType;

  /** `PERCENT` — 0..100; `FIXED` — минорные единицы валюты сметы. */
  @Prop({ required: true, min: 0 })
  value!: number;

  @Prop({ type: String, trim: true, maxlength: 200, default: null })
  reason?: string | null;
}
const EstimateDiscountSchema = SchemaFactory.createForClass(EstimateDiscount);

@Schema({ _id: false })
export class EstimateItemMilestone {
  @Prop({ required: true, trim: true })
  key!: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, min: 0 })
  amount!: number;
}
const EstimateItemMilestoneSchema = SchemaFactory.createForClass(EstimateItemMilestone);

@Schema({ _id: false })
export class EstimateItemTier {
  @Prop({ required: true, min: 1 })
  minHours!: number;

  @Prop({ required: true, min: 0, max: 90 })
  discountPercent!: number;
}
const EstimateItemTierSchema = SchemaFactory.createForClass(EstimateItemTier);

/**
 * Позиция сметы. Цены — снапшот каталога на момент добавления: правка тарифа
 * не должна молча переписывать то, что клиент уже видел. Расхождение со
 * каталогом помечается при чтении (`priceChanged`) и принимается явным
 * `POST /estimate/refresh`.
 *
 * Смысл `units` задаёт `model`: `HOURLY`/`MIXED` — часы, `RETAINER` — число
 * периодов, `FIXED` — число проектов.
 */
@Schema()
export class EstimateItem {
  @Prop({ type: Types.ObjectId, ref: 'Service', required: true, index: true })
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

  /** Только `RETAINER`: часы сверх включённых в абонплату. */
  @Prop({ min: 0, default: 0 })
  extraHours!: number;

  @Prop({ type: [EstimateItemMilestoneSchema], default: [] })
  milestones!: EstimateItemMilestone[];

  @Prop({ type: [EstimateItemTierSchema], default: [] })
  tiers!: EstimateItemTier[];

  @Prop({ required: true })
  currency!: string;

  @Prop({ type: String, trim: true, maxlength: 1000, default: null })
  notes?: string | null;
}
const EstimateItemSchema = SchemaFactory.createForClass(EstimateItem);

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      delete ret.__v;
      // Токен гостевой сметы — доступ к ней, а не часть её описания:
      // отдаётся владельцу отдельным полем ответа, не через сериализацию.
      delete ret.token;
      if (Array.isArray(ret.items)) {
        ret.items = ret.items.map((item: Record<string, any>) => {
          item.id = item._id?.toString();
          delete item._id;
          return item;
        });
      }
      return ret;
    },
  },
})
export class Estimate {
  /** Владелец-пользователь. `null` — смета гостя, её ключ в `token`. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  userId?: Types.ObjectId | null;

  /** Секрет гостевой сметы, приходит в заголовке `X-Estimate-Token`. */
  @Prop({ type: String, default: null })
  token?: string | null;

  /** Смета одновалютная: услугу в другой валюте в неё не внести. */
  @Prop({ required: true, default: 'EUR' })
  currency!: string;

  @Prop({ type: [EstimateItemSchema], default: [] })
  items!: EstimateItem[];

  @Prop({ type: EstimateDiscountSchema, default: null })
  discount?: EstimateDiscount | null;

  @Prop({ type: String, enum: EstimateStatus, default: EstimateStatus.ACTIVE, index: true })
  status!: EstimateStatus;

  /** Живёт только у гостевых смет; у пользовательских `null` — не истекают. */
  @Prop({ type: Date, default: null })
  expiresAt?: Date | null;
}

export const EstimateSchema = SchemaFactory.createForClass(Estimate);

// Активная смета у пользователя одна. Частичный уникальный индекс держит это
// в базе, иначе две параллельные вкладки создают два конкурирующих документа.
EstimateSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      userId: { $type: 'objectId' },
      status: EstimateStatus.ACTIVE,
    },
  },
);

EstimateSchema.index(
  { token: 1 },
  { unique: true, partialFilterExpression: { token: { $type: 'string' } } },
);

// TTL чистит брошенные гостевые сметы. Документы с `expiresAt: null`
// индекс не трогает — пользовательские сметы переживают любой срок.
EstimateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
