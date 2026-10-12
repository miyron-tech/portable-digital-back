import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentStatus } from './schemas/payment.schema';

/** Состояния, которые WemoPay присылает. Всё остальное — повод посмотреть руками. */
export const WEMOPAY_STATES = [
  'CHECKOUT',
  'PENDING',
  'AUTHORIZED',
  'AWAITING_APPROVAL',
  'COMPLETED',
  'DECLINED',
  'CANCELLED',
] as const;
export type WemopayState = (typeof WEMOPAY_STATES)[number];

export interface WemopayPayment {
  id: string;
  referenceId?: string;
  state: string;
  paymentMethod?: string;
  amount?: number;
  currency?: string;
  redirectUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  [key: string]: unknown;
}

export class WemopayError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'WemopayError';
  }
}

export interface CreatePaymentInput {
  /** Номер попытки у провайдера — `<заказ>` или `<заказ>-N`. */
  referenceId: string;
  /** Номер заказа: на его страницу провайдер вернёт клиента. */
  orderNumber: string;
  /** Минорные единицы: перевод в крупные — забота этого сервиса. */
  amountMinor: number;
  currency: string;
  description: string;
  customer: {
    referenceId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string | null;
  };
  billing?: {
    addressLine1?: string | null;
    city?: string | null;
    postalCode?: string | null;
    countryCode?: string | null;
  } | null;
}

@Injectable()
export class WemopayService {
  private readonly logger = new Logger(WemopayService.name);

  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(this.config.get<string>('wemopay.apiKey'));
  }

  /**
   * Провайдер принимает сумму в крупных единицах числом. У нас всё в центах,
   * поэтому перевод делается здесь, на самой границе, и ровно один раз:
   * `toFixed(2)` отсекает двоичный хвост, который иначе уехал бы в JSON.
   */
  private toMajorUnits(amountMinor: number): number {
    return Number((amountMinor / 100).toFixed(2));
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const apiKey = this.config.get<string>('wemopay.apiKey');
    if (!apiKey) {
      throw new WemopayError('WEMOPAY_API_KEY is not set', 503);
    }
    const baseUrl = this.config.getOrThrow<string>('wemopay.baseUrl').replace(/\/+$/, '');

    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
    let payload: string | undefined;
    if (body !== undefined) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, { method, headers, body: payload });
    } catch (error) {
      // Сеть легла — вызывающий код обязан отличать это от отказа провайдера:
      // при сетевой ошибке платёж мог быть создан на той стороне.
      throw new WemopayError(`WemoPay is unreachable: ${(error as Error).message}`, 502);
    }

    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      // Движок провайдера на Spring: при отказе валидации он кладёт в
      // `errors` поле и причину, а в `message` — лишь «Validation failed …
      // Error count: 1». Без полей не понять, что именно не так.
      const fields = Array.isArray(data?.errors)
        ? data.errors
            .map((e: any) => `${[e.objectName?.replace(/^PaymentRequest\.?/, ''), e.field].filter(Boolean).join('.')}: ${e.defaultMessage}`)
            .join('; ')
        : '';
      const base = data?.result?.errorMessage ?? data?.message ?? `WemoPay HTTP ${response.status}`;
      throw new WemopayError(fields ? `${base} — ${fields}` : base, response.status, data);
    }
    return data as T;
  }

  async createPayment(input: CreatePaymentInput): Promise<WemopayPayment> {
    if (!(input.amountMinor > 0)) {
      throw new WemopayError('Amount must be greater than 0', 400);
    }

    const customer: Record<string, unknown> = {
      referenceId: input.customer.referenceId,
      email: input.customer.email,
    };
    if (input.customer.firstName) customer.firstName = input.customer.firstName;
    if (input.customer.lastName) customer.lastName = input.customer.lastName;
    // Телефон не отправляем. Провайдеру он необязателен, а превратить
    // произвольную строку в «<код страны> <номер>» без таблицы кодов нельзя:
    // для «+77066540004» (Казахстан, +7) получалось «77 066540004».

    const payload: Record<string, unknown> = {
      paymentType: 'DEPOSIT',
      referenceId: input.referenceId,
      // Провайдер обрезает описание на 512 символах — режем сами, чтобы не
      // отдавать наружу обрубок неизвестной формы.
      description: input.description.slice(0, 512),
      amount: this.toMajorUnits(input.amountMinor),
      currency: input.currency,
      customer,
    };

    const billing: Record<string, unknown> = {};
    if (input.billing?.addressLine1) billing.addressLine1 = input.billing.addressLine1;
    if (input.billing?.city) billing.city = input.billing.city;
    if (input.billing?.postalCode) billing.postalCode = input.billing.postalCode;
    if (input.billing?.countryCode?.length === 2) {
      billing.countryCode = input.billing.countryCode.toUpperCase();
    }
    if (Object.keys(billing).length > 0) payload.billingAddress = billing;

    const webhookUrl = this.config.get<string>('wemopay.webhookUrl');
    if (webhookUrl) payload.webhookUrl = webhookUrl;
    // Номер заказа подставляем сами. Шаблон `{referenceId}` провайдер,
    // возможно, и раскрывает, но это нигде не подтверждено — а если нет,
    // клиент после оплаты вернулся бы на буквальный /orders/{referenceId}.
    const returnUrl = this.config.get<string>('wemopay.returnUrl');
    if (returnUrl) {
      payload.returnUrl = returnUrl.replace(
        '{referenceId}',
        encodeURIComponent(input.orderNumber),
      );
    }

    const data = await this.request<{ result?: WemopayPayment }>(
      'POST',
      '/api/v1/payments',
      payload,
    );
    const result = data?.result;
    if (!result?.id) {
      throw new WemopayError('WemoPay response is missing a payment id', 502, data);
    }
    return result;
  }

  /**
   * Поиск уже созданного платежа по нашему `referenceId`.
   *
   * Нужен до создания: если прошлая попытка успела завести платёж у провайдера,
   * но упала до записи его идентификатора, повторный `createPayment` завёл бы
   * второй — и клиент мог бы заплатить дважды.
   */
  async findByReferenceId(referenceId: string): Promise<WemopayPayment | null> {
    const data = await this.request<{ result?: WemopayPayment[] }>(
      'GET',
      `/api/v1/payments?referenceId.eq=${encodeURIComponent(referenceId)}&limit=1`,
    );
    const list = data?.result;
    return Array.isArray(list) && list[0]?.id ? list[0] : null;
  }

  async getPayment(providerPaymentId: string): Promise<WemopayPayment> {
    const data = await this.request<{ result?: WemopayPayment }>(
      'GET',
      `/api/v1/payments/${encodeURIComponent(providerPaymentId)}`,
    );
    const result = data?.result;
    if (!result?.id) {
      throw new WemopayError('WemoPay response is missing a payment id', 502, data);
    }
    return result;
  }

  /**
   * HMAC-SHA256 тела вебхука ключом подписи, заголовок `Signature`, hex.
   *
   * Считается по СЫРЫМ байтам запроса: пересборка `JSON.stringify(req.body)`
   * меняет порядок ключей и пробелы, и подпись перестаёт сходиться.
   */
  verifyWebhookSignature(rawBody: Buffer | undefined, signature: unknown): boolean {
    const signingKey = this.config.get<string>('wemopay.signingKey');
    if (!signingKey || !rawBody?.length || !signature) return false;

    const received = Array.isArray(signature) ? signature[0] : signature;
    if (typeof received !== 'string') return false;

    const expected = createHmac('sha256', signingKey).update(rawBody).digest();
    const provided = this.decodeSignature(received.trim(), expected.length);
    if (!provided) return false;
    return timingSafeEqual(provided, expected);
  }

  /**
   * Подпись принимается и в hex, и в base64 — так делает рабочая интеграция
   * synvero на том же боевом хосте. Разбирать только hex было бы ставкой на
   * формат, которого никто не видел: примись провайдер слать base64, все
   * вебхуки отбивались бы, и оплаченные заказы навсегда остались бы «не
   * оплачены». Длина проверяется в обоих случаях: timingSafeEqual требует
   * равных буферов.
   */
  private decodeSignature(value: string, length: number): Buffer | null {
    if (value.length === length * 2 && /^[0-9a-fA-F]+$/.test(value)) {
      return Buffer.from(value, 'hex');
    }
    if (/^[0-9a-zA-Z+/=_-]+$/.test(value)) {
      const decoded = Buffer.from(value, 'base64');
      if (decoded.length === length) return decoded;
    }
    return null;
  }

  /**
   * Состояние провайдера → наш статус. `null` означает «такого состояния мы не
   * знаем»: вызывающий код обязан поднять флаг проверки, а не молча записать
   * платёж в обработку. Именно на этом ломается наивный `default: pending` —
   * приди от провайдера `REFUNDED`, платёж навсегда завис бы «в обработке».
   */
  mapState(state: string): PaymentStatus | null {
    switch (state) {
      case 'CHECKOUT':
        return PaymentStatus.CREATED;
      case 'PENDING':
        return PaymentStatus.PENDING;
      case 'AWAITING_APPROVAL':
        return PaymentStatus.AWAITING_APPROVAL;
      case 'AUTHORIZED':
        return PaymentStatus.AUTHORIZED;
      case 'COMPLETED':
        return PaymentStatus.PAID;
      case 'DECLINED':
        return PaymentStatus.DECLINED;
      case 'CANCELLED':
        return PaymentStatus.CANCELLED;
      default:
        this.logger.warn(`Unknown WemoPay state: ${state}`);
        return null;
    }
  }
}
