import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MailOutboxDocument = HydratedDocument<MailOutbox>;

export enum MailStatus {
  PENDING = 'pending',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
}

/** Сколько хранить отправленные и окончательно проваленные письма. */
export const MAIL_RETENTION_SECONDS = 90 * 24 * 60 * 60;

/**
 * Очередь исходящих писем. Письмо сначала записывается в базу и только потом
 * отправляется воркером: оплата не ждёт SMTP и не падает из-за него, а
 * письмо, не ушедшее из-за сбоя, уходит после рестарта. Без настроенного SMTP
 * письма ждут здесь и уходят, как только почту настроят.
 *
 * Тело хранится целиком — это копия того, что получил клиент (для
 * подтверждения заказа это важно при споре).
 *
 * Схема взята у buydone.tech; части для писем с одноразовыми ссылками
 * (затирание тела, срок жизни ссылки) не нужны — таких писем здесь нет.
 */
@Schema({ collection: 'mail_outbox', timestamps: { createdAt: true, updatedAt: false } })
export class MailOutbox {
  @Prop({ required: true, trim: true, lowercase: true })
  to!: string;

  /** Имя шаблона — единственное, что попадает в логи вместе с маской адреса. */
  @Prop({ required: true })
  template!: string;

  @Prop({ required: true })
  subject!: string;

  @Prop({ required: true })
  html!: string;

  @Prop({ required: true })
  text!: string;

  /**
   * Ключ идемпотентности (`order-paid:<id>`): второй вызов с тем же ключом —
   * не второе письмо. Держит уникальный разреженный индекс, а не проверка в коде.
   */
  @Prop({ type: String, default: undefined })
  dedupeKey?: string;

  @Prop({ type: String, enum: MailStatus, default: MailStatus.PENDING })
  status!: MailStatus;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop({ type: Date, default: () => new Date() })
  nextAttemptAt!: Date;

  /** До какого момента строка занята воркером; просроченный замок можно забрать. */
  @Prop({ type: Date, default: null })
  lockedUntil?: Date | null;

  /** Случайный id захвата: запоздавший проход не перепишет чужой итог. */
  @Prop({ type: String, default: null })
  lockId?: string | null;

  @Prop({ type: String, default: null })
  lastError?: string | null;

  @Prop({ type: Date, default: null })
  sentAt?: Date | null;

  createdAt?: Date;
}

export const MailOutboxSchema = SchemaFactory.createForClass(MailOutbox);

MailOutboxSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });
// Выборка воркера: ждущие письма по времени следующей попытки.
MailOutboxSchema.index({ status: 1, nextAttemptAt: 1 });
// Сроки хранения: отправленное — 90 дней от отправки, проваленное — 90 дней
// от создания. Ждущие письма не истекают: без SMTP они ждут настройки почты.
MailOutboxSchema.index(
  { sentAt: 1 },
  { expireAfterSeconds: MAIL_RETENTION_SECONDS, partialFilterExpression: { status: MailStatus.SENT }, name: 'sent_ttl' },
);
MailOutboxSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: MAIL_RETENTION_SECONDS, partialFilterExpression: { status: MailStatus.FAILED }, name: 'failed_ttl' },
);
