import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { MailOutbox, MailOutboxDocument, MailStatus } from './mail-outbox.schema';
import { MailTransport, SEND_TIMEOUT_MS } from './mail.transport';
import { maskEmail } from './mask-email';

const TICK_MS = 15_000;
/** Замок на строке вдвое длиннее предела отправки: живой проход всегда успевает записать итог. */
const LOCK_MS = 2 * 60_000;
const BACKOFF_BASE_MS = 60_000;
export const MAX_ATTEMPTS = 8;
/** Сколько писем максимум за один проход — чтобы проход не растягивался. */
const BATCH = 25;

/**
 * Отправляет письма из `mail_outbox`. Работает внутри процесса API: отдельного
 * брокера нет, а очередь в Mongo переживает рестарт. Несколько экземпляров
 * не мешают друг другу — строку забирают атомарным `findOneAndUpdate`.
 * Устроен как у buydone.tech.
 */
@Injectable()
export class MailWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MailWorker.name);
  private timer: NodeJS.Timeout | null = null;
  /** Текущий проход; при остановке его дожидаемся, а не рвём на середине. */
  private current: Promise<void> | null = null;
  private stopped = false;

  constructor(
    @InjectModel(MailOutbox.name) private readonly outbox: Model<MailOutboxDocument>,
    private readonly transport: MailTransport,
  ) {}

  onApplicationBootstrap() {
    if (!this.transport.configured) {
      // Письма всё равно пишутся в очередь и уйдут, как только почту настроят.
      this.logger.warn('SMTP is not configured: emails are queued in mail_outbox but not sent');
      return;
    }
    if (SEND_TIMEOUT_MS >= LOCK_MS) {
      this.logger.warn('SMTP send timeout is not below the outbox lock: emails may be sent twice');
    }
    // Неверный пароль или закрытый порт — не повод не стартовать API.
    void this.transport.verify();
    this.timer = setInterval(() => this.kick(), TICK_MS);
    // Таймер не должен держать процесс живым (скрипты, завершение по SIGTERM).
    this.timer.unref();
    this.kick();
  }

  /**
   * Дожидаемся письма, которое уже отправляется, — соединение с Mongo
   * закрывается позже, и мы успеваем отметить его отправленным. Иначе письмо,
   * ушедшее за секунду до остановки, через 2 минуты ушло бы второй раз.
   */
  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.current;
    this.transport.close();
  }

  /** Запустить проход сейчас, не дожидаясь таймера (после постановки письма). */
  kick() {
    if (!this.transport.configured || this.stopped || this.current) return;
    this.current = this.drain().finally(() => {
      this.current = null;
    });
  }

  private async drain() {
    try {
      for (let i = 0; i < BATCH && !this.stopped; i += 1) {
        const job = await this.claim();
        if (!job) break;
        await this.deliver(job);
      }
    } catch (error) {
      this.logger.error(`Mail worker pass failed: ${truncate((error as Error).message)}`);
    }
  }

  /**
   * Забирает одно письмо. Вместе с ждущими берём и `sending` с истёкшим
   * замком — это письмо, чей проход умер на середине. Оно может уйти дважды:
   * лучше дубль, чем потерянное подтверждение заказа. Счётчик попыток растёт
   * при захвате, так что и такой сбой упрётся в предел попыток.
   */
  private claim() {
    const now = new Date();
    return this.outbox
      .findOneAndUpdate(
        {
          $or: [
            { status: MailStatus.PENDING, nextAttemptAt: { $lte: now } },
            { status: MailStatus.SENDING, lockedUntil: { $lte: now } },
          ],
        },
        {
          $set: { status: MailStatus.SENDING, lockedUntil: new Date(now.getTime() + LOCK_MS), lockId: randomUUID() },
          $inc: { attempts: 1 },
        },
        { sort: { nextAttemptAt: 1 }, returnDocument: 'after' },
      )
      .exec();
  }

  private async deliver(job: MailOutboxDocument) {
    try {
      await this.transport.send({ to: job.to, subject: job.subject, html: job.html, text: job.text });
    } catch (error) {
      await this.reschedule(job, error);
      return;
    }
    // Отметка «отправлено» вне catch отправки: сбой записи в базу — не сбой
    // SMTP, и ушедшее письмо нельзя ставить на повтор.
    await this.outbox
      .updateOne(this.owned(job), {
        $set: { status: MailStatus.SENT, sentAt: new Date(), lockedUntil: null, lockId: null, lastError: null },
      })
      .exec();
  }

  /** Строка всё ещё наша: если её забрал другой проход, наш итог ничего не перепишет. */
  private owned(job: MailOutboxDocument) {
    return { _id: job._id, lockId: job.lockId, status: MailStatus.SENDING };
  }

  private async reschedule(job: MailOutboxDocument, error: unknown) {
    const message = truncate((error as Error).message ?? String(error));
    if (job.attempts >= MAX_ATTEMPTS) {
      // В лог — только шаблон и маска адреса: полный адрес — лишние ПДн в логах.
      this.logger.error(`Email "${job.template}" to ${maskEmail(job.to)} failed after ${job.attempts} attempts: ${message}`);
      await this.outbox
        .updateOne(this.owned(job), { $set: { status: MailStatus.FAILED, lockedUntil: null, lockId: null, lastError: message } })
        .exec();
      return;
    }
    const delay = BACKOFF_BASE_MS * 2 ** job.attempts;
    this.logger.warn(
      `Email "${job.template}" to ${maskEmail(job.to)} failed (attempt ${job.attempts}), retrying in ${Math.round(delay / 60_000)} min`,
    );
    await this.outbox
      .updateOne(this.owned(job), {
        $set: {
          status: MailStatus.PENDING,
          lockedUntil: null,
          lockId: null,
          lastError: message,
          nextAttemptAt: new Date(Date.now() + delay),
        },
      })
      .exec();
  }
}

function truncate(value: string, max = 500) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
