import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { MailConfig } from '../config/configuration';

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Предел на одну отправку целиком (соединение + TLS + передача). Должен быть
 * заметно меньше замка строки в воркере (2 минуты): иначе зависшая отправка
 * переживёт замок, строку заберёт второй проход, и письмо уйдёт дважды.
 */
export const SEND_TIMEOUT_MS = 60_000;

/**
 * Тонкая обёртка над nodemailer — единственное место, которое знает про SMTP.
 * Транспорт создаётся лениво и только при настроенной почте. Логика портов и
 * таймаутов взята у buydone.tech, где она уже обкатана.
 */
@Injectable()
export class MailTransport {
  private readonly logger = new Logger(MailTransport.name);
  private readonly mail: MailConfig;
  private readonly secure: boolean;
  private transporter: Transporter | null = null;

  constructor(config: ConfigService) {
    this.mail = config.getOrThrow<MailConfig>('mail');
    this.secure = this.resolveSecure();
  }

  get configured(): boolean {
    return this.mail.configured;
  }

  /**
   * 465 — неявный TLS с первого байта: с secure=false nodemailer пошлёт
   * открытый EHLO в TLS-порт и повиснет до таймаута. 587 — STARTTLS:
   * secure=true там ломает рукопожатие. На этих портах режим задаём сами,
   * противоречащее ему SMTP_SECURE только отмечаем в логе. На прочих портах
   * (Mailpit на 1025) — как в конфиге.
   */
  private resolveSecure(): boolean {
    if (!this.mail.configured) return this.mail.secure;
    if (this.mail.port === 465) {
      if (!this.mail.secure) this.logger.warn('SMTP_SECURE=false is ignored on port 465: implicit TLS is always used there');
      return true;
    }
    if (this.mail.port === 587) {
      if (this.mail.secure) this.logger.warn('SMTP_SECURE=true is ignored on port 587: STARTTLS (requireTLS) is used there');
      return false;
    }
    return this.mail.secure;
  }

  private get client(): Transporter {
    if (!this.mail.configured) throw new Error('SMTP is not configured');
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.mail.host,
        port: this.mail.port,
        secure: this.secure,
        // На 587 без requireTLS nodemailer молча отправит письмо открытым
        // текстом, если сервер не предложит TLS.
        requireTLS: this.mail.port === 587,
        auth: { user: this.mail.user, pass: this.mail.pass },
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
      });
    }
    return this.transporter;
  }

  /** Проверка связи и входа при старте — только для лога, не бросает. */
  async verify(): Promise<boolean> {
    try {
      await withTimeout(this.client.verify(), SEND_TIMEOUT_MS, 'SMTP verification timed out');
      this.logger.log('SMTP connection verified');
      return true;
    } catch (error) {
      this.logger.warn(`SMTP verification failed: ${(error as Error).message.slice(0, 300)}`);
      return false;
    }
  }

  async send(message: OutgoingMail): Promise<void> {
    // Если предел сработал, nodemailer может всё же дослать письмо позже, и
    // повтор даст дубль. Это лучше, чем строка, которая висит в `sending`
    // дольше замка и уходит параллельно из второго прохода.
    await withTimeout(
      this.client.sendMail({
        from: this.mail.from,
        ...(this.mail.replyTo ? { replyTo: this.mail.replyTo } : {}),
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      SEND_TIMEOUT_MS,
      'SMTP send timed out',
    );
  }

  close() {
    this.transporter?.close();
    this.transporter = null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
