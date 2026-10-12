import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MailOutbox, MailOutboxDocument } from './mail-outbox.schema';
import { MailWorker } from './mail.worker';
import { maskEmail } from './mask-email';
import type { RenderedMail } from './templates/layout';

export interface EnqueueMail extends RenderedMail {
  to: string;
  /** Имя шаблона — для логов и разбора, в письмо не попадает. */
  template: string;
  /** Повторная постановка с тем же ключом молча игнорируется. */
  dedupeKey?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @InjectModel(MailOutbox.name) private readonly outbox: Model<MailOutboxDocument>,
    private readonly worker: MailWorker,
    private readonly config: ConfigService,
  ) {}

  /** Абсолютный адрес витрины для ссылок в письмах. */
  siteUrl(): string {
    return this.config.getOrThrow<string>('publicSiteUrl');
  }

  /**
   * Кладёт письмо в очередь. SMTP здесь не трогается: вызывающий ждёт только
   * вставки в Mongo, отправка — дело воркера.
   */
  async enqueue(mail: EnqueueMail): Promise<void> {
    try {
      await this.outbox.create({
        to: mail.to,
        template: mail.template,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.dedupeKey ? { dedupeKey: mail.dedupeKey } : {}),
      });
    } catch (error: any) {
      // Дубль ключа — это «письмо уже поставлено», а не ошибка: так повторный
      // вебхук об оплате не шлёт второе подтверждение.
      if (error?.code === 11000) return;
      throw error;
    }
    this.worker.kick();
  }

  /**
   * То же, но никогда не бросает: письмо — побочный эффект оплаты, и его сбой
   * не должен ломать основное дело.
   */
  async enqueueSafe(mail: EnqueueMail): Promise<void> {
    try {
      await this.enqueue(mail);
    } catch (error) {
      this.logger.error(`Could not queue email "${mail.template}" to ${maskEmail(mail.to)}: ${(error as Error).message}`);
    }
  }
}
