import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { OrdersService } from '../orders/orders.service';
import { splitPersonName } from '../users/person-name';
import { User, UserDocument } from '../users/schemas/user.schema';
import { OrderDocument } from '../orders/schemas/order.schema';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import {
  isFinalPaymentStatus,
  orderNumberFromReference,
  Payment,
  PaymentDocument,
  PaymentProvider,
  PaymentStatus,
  providerReference,
  ReviewReason,
} from './schemas/payment.schema';
import { WemopayError, WemopayPayment, WemopayService } from './wemopay.service';
import { MailService } from '../mail/mail.service';
import { orderPaidMail } from '../mail/templates/order-paid';

const PAGE_SIZE = 20;

type CompleteBilling = {
  addressLine1: string;
  city: string;
  postalCode: string;
  countryCode: string;
};

/** Все четыре поля, которые провайдер требует в адресе, на месте. */
function isCompleteBilling(billing: any): billing is CompleteBilling {
  return Boolean(
    billing?.addressLine1?.trim() &&
      billing?.city?.trim() &&
      billing?.postalCode?.trim() &&
      /^[A-Za-z]{2}$/.test(billing?.countryCode ?? ''),
  );
}

/** Что случилось с платежом при разборе ответа провайдера. */
type ApplyOutcome = 'updated' | 'duplicate' | 'conflict' | 'unknown';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly wemopay: WemopayService,
    private readonly orders: OrdersService,
    private readonly mail: MailService,
  ) {}

  // ─── разбор ответа провайдера ──────────────────────────────────────────────

  /**
   * Единственное место, где меняется статус платежа. И вебхук, и опрос идут
   * сюда, поэтому правила перехода не могут разойтись между путями.
   *
   * Возвращает исход; сам по себе он ничего не сохраняет — вызывающий делает
   * `save()` и решает, дёргать ли заказ.
   */
  private applyProviderState(
    payment: PaymentDocument,
    result: Pick<
      WemopayPayment,
      'state' | 'amount' | 'currency' | 'errorCode' | 'errorMessage'
    >,
    source: 'webhook' | 'sync',
  ): ApplyOutcome {
    const mapped = this.wemopay.mapState(result.state);

    // Дословное состояние сохраняем всегда, даже если не понимаем его: иначе
    // разбираться с платежом потом будет не по чему.
    payment.providerState = result.state ?? null;
    if (result.errorCode !== undefined) payment.errorCode = result.errorCode ?? null;
    if (result.errorMessage !== undefined) payment.errorMessage = result.errorMessage ?? null;

    // Сумма у провайдера в крупных единицах, у нас в минорных.
    // Та же сумма в другой валюте — тоже чужая сумма.
    if (
      (typeof result.amount === 'number' &&
        Math.round(result.amount * 100) !== payment.amount) ||
      (typeof result.currency === 'string' &&
        result.currency.toUpperCase() !== payment.currency.toUpperCase())
    ) {
      this.flagForReview(
        payment,
        ReviewReason.AMOUNT_MISMATCH,
        `Provider reports ${result.amount} ${result.currency ?? payment.currency}, we expect ${(payment.amount / 100).toFixed(2)} ${payment.currency}`,
      );
    }

    let outcome: ApplyOutcome;

    if (mapped === null) {
      // Состояние нам неизвестно. Записать его в «в обработке» было бы худшим
      // из решений: приди `REFUNDED`, платёж завис бы там навсегда и тихо.
      outcome = 'unknown';
      this.flagForReview(
        payment,
        ReviewReason.UNKNOWN_PROVIDER_STATE,
        `WemoPay sent an unrecognised state: ${result.state}`,
      );
    } else if (isFinalPaymentStatus(payment.status)) {
      outcome = payment.status === mapped ? 'duplicate' : 'conflict';
      if (outcome === 'conflict') {
        // Финальный статус не откатываем, но молчать об этом нельзя.
        this.flagForReview(
          payment,
          ReviewReason.CONFLICTING_STATE,
          `Payment is ${payment.status}, provider now reports ${result.state}`,
        );
      }
    } else {
      payment.status = mapped;
      if (mapped === PaymentStatus.PAID && !payment.paidAt) {
        payment.paidAt = new Date();
      }
      outcome = 'updated';
    }

    payment.events.push({
      source,
      providerState: result.state ?? null,
      status: mapped ?? null,
      outcome,
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? null,
      at: new Date(),
    });
    // История не должна расти без предела — держим последние 50 событий.
    if (payment.events.length > 50) {
      payment.events.splice(0, payment.events.length - 50);
    }

    return outcome;
  }

  /** Закрывает отменённую/отклонённую попытку и начинает следующую. */
  private startNewAttempt(payment: PaymentDocument) {
    const previous = providerReference(payment.referenceId, payment.attempt ?? 1);
    payment.events.push({
      source: 'manual',
      providerState: payment.providerState ?? null,
      status: payment.status,
      outcome: 'retry',
      errorCode: null,
      errorMessage: `Attempt ${previous} closed as ${payment.status}; starting a new one`,
      at: new Date(),
    });
    payment.attempt = (payment.attempt ?? 1) + 1;
    payment.status = PaymentStatus.CREATED;
    payment.providerPaymentId = null;
    payment.providerState = null;
    payment.redirectUrl = null;
    payment.errorCode = null;
    payment.errorMessage = null;
    // Флаг прошлой попытки — в её событиях; новая начинается с чистого листа.
    payment.needsReview = false;
    payment.reviewReason = null;
    payment.reviewNote = null;
  }

  private flagForReview(payment: PaymentDocument, reason: ReviewReason, note: string) {
    payment.needsReview = true;
    payment.reviewReason = reason;
    payment.reviewNote = note;
    this.logger.warn(`Payment ${payment.referenceId} needs review: ${note}`);
  }

  /**
   * Заказ помечается оплаченным ровно тогда, когда платёж только что перешёл
   * в `paid`. Один вход для вебхука и для опроса — двойного уведомления быть
   * не может.
   */
  private async syncOrder(payment: PaymentDocument, outcome: ApplyOutcome) {
    if (outcome === 'updated' && payment.status === PaymentStatus.PAID) {
      const changed = await this.orders.markPaid(payment.orderId);
      if (changed) await this.queuePaidMail(payment);
    }
  }

  /**
   * Письмо об оплате: состав заказа, сумма, принятая редакция условий и
   * порядок отказа. Ключ `order-paid:<id>` не даёт отправить его дважды, а
   * сбой письма не должен ломать обработку платежа — только лог.
   */
  private async queuePaidMail(payment: PaymentDocument) {
    try {
      const order = await this.orders.findById(payment.orderId.toString());
      if (!order.termsAcceptance) return;
      await this.mail.enqueueSafe({
        to: order.customer.email,
        template: 'order-paid',
        dedupeKey: `order-paid:${order._id.toString()}`,
        ...orderPaidMail({
          siteUrl: this.mail.siteUrl(),
          orderNumber: order.orderNumber,
          customerName: order.customer.name,
          paidAt: payment.paidAt ?? new Date(),
          currency: order.currency,
          items: order.items,
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          total: order.total,
          termsVersion: order.termsAcceptance.version,
          termsAcceptedAt: order.termsAcceptance.acceptedAt,
        }),
      });
    } catch (error) {
      this.logger.error(`Could not prepare the payment email for ${payment.referenceId}: ${(error as Error).message}`);
    }
  }

  // ─── создание платежа ──────────────────────────────────────────────────────

  async initiate(userId: string, orderNumber: string) {
    if (!this.wemopay.configured) {
      this.logger.error('Payment initiation unavailable: WEMOPAY_API_KEY is not configured');
      throw new ServiceUnavailableException(
        'Payments are temporarily unavailable. Please try again later.',
      );
    }

    const order = (await this.orders.findByNumber(orderNumber, userId, false)) as any;
    const orderDoc = await this.orders.findById(order.id);

    // Платить можно только за заказ с зафиксированным согласием на условия.
    // У заказов, оформленных до этого правила, его нет — их оформляют заново.
    if (!orderDoc.termsAcceptance) {
      throw new ConflictException({
        statusCode: 409,
        code: 'TERMS_ACCEPTANCE_REQUIRED',
        message: 'This order was placed before our terms were accepted at checkout. Please place a new order.',
      });
    }

    // Провайдер отклоняет платёж без фамилии и без любого из четырёх полей
    // адреса. Проверяем до того, как что-то заводить у него или у нас, и
    // отвечаем кодом со списком недостающего: витрина спросит только его,
    // сохранит в профиль и повторит — дальше «Buy» ведёт сразу к оплате.
    //
    // Имя и адрес берём из живого профиля, а не из снимка в заказе: платит
    // тот, кто вошёл сейчас, и исправленные данные должны сработать сразу.
    // Исключение — старые заказы, где адрес заполняли в форме оформления.
    const payer = await this.userModel.findById(userId).exec();
    if (!payer) throw new NotFoundException('User not found');
    const { firstName, lastName } = splitPersonName(payer.name);
    const billing = isCompleteBilling(orderDoc.billing)
      ? orderDoc.billing
      : isCompleteBilling(payer.billingAddress)
        ? payer.billingAddress
        : null;

    const missing = [...(lastName ? [] : ['lastName']), ...(billing ? [] : ['billingAddress'])];
    if (missing.length || !lastName || !billing) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'PAYER_DETAILS_REQUIRED',
        missing,
        message: 'Add your full name and billing address to continue with payment.',
      });
    }

    // Адрес, по которому заплатили, остаётся в заказе — для истории и счёта.
    if (!isCompleteBilling(orderDoc.billing)) {
      orderDoc.billing = { ...billing };
      await orderDoc.save();
    }

    let payment = await this.paymentModel.findOne({ orderId: orderDoc._id }).exec();

    if (payment?.status === PaymentStatus.PAID) {
      throw new ConflictException('This order is already paid');
    }

    if (!payment) {
      payment = await this.paymentModel.create({
        orderId: orderDoc._id,
        userId: new Types.ObjectId(userId),
        // referenceId = номер заказа: по нему платёж находят обратно и из
        // вебхука, и при восстановлении после сбоя.
        referenceId: orderDoc.orderNumber,
        amount: orderDoc.total,
        currency: orderDoc.currency,
        provider: PaymentProvider.WEMOPAY,
        status: PaymentStatus.CREATED,
      });
    }

    // Отменённый или отклонённый платёж — закрытая попытка, а не тупик.
    // Раньше повтор заводил у провайдера новый платёж, но запись оставалась
    // финальной, и его вебхук считался конфликтом: клиент платил, а заказ
    // навсегда оставался «не оплачен». Теперь начинается новая попытка со
    // своим номером у провайдера; прежняя остаётся в истории событий.
    if (payment.status === PaymentStatus.DECLINED || payment.status === PaymentStatus.CANCELLED) {
      this.startNewAttempt(payment);
      await payment.save();
    }

    // Ссылку на оплату переиспользуем: заводить второй платёж у провайдера на
    // тот же заказ — прямой путь к двойному списанию.
    if (payment.providerPaymentId && payment.redirectUrl && !isFinalPaymentStatus(payment.status)) {
      return {
        orderNumber: orderDoc.orderNumber,
        paymentId: payment.providerPaymentId,
        status: payment.status,
        redirectUrl: payment.redirectUrl,
        reused: true,
      };
    }

    let result: WemopayPayment | null = null;

    // Прошлая попытка могла создать платёж у провайдера и упасть до записи его
    // идентификатора. Сначала ищем — только потом создаём.
    if (!payment.providerPaymentId) {
      try {
        result = await this.wemopay.findByReferenceId(
          providerReference(orderDoc.orderNumber, payment.attempt ?? 1),
        );
      } catch (error) {
        this.logger.warn(
          `Lookup by referenceId failed for ${orderDoc.orderNumber}: ${(error as Error).message}`,
        );
      }
    }

    if (!result) {
      result = await this.createAtProvider(orderDoc, payment, { firstName, lastName, billing });
    }

    payment.providerPaymentId = result.id;
    if (result.redirectUrl) payment.redirectUrl = result.redirectUrl;
    const outcome = this.applyProviderState(payment, result, 'sync');
    await payment.save();
    await this.syncOrder(payment, outcome);

    return {
      orderNumber: orderDoc.orderNumber,
      paymentId: result.id,
      status: payment.status,
      redirectUrl: payment.redirectUrl ?? null,
      reused: false,
    };
  }

  private async createAtProvider(
    order: OrderDocument,
    payment: PaymentDocument,
    payer: { firstName: string; lastName: string; billing: CompleteBilling },
  ) {
    const description = order.items
      .map((item) => `${item.title} (${item.model} x${item.units})`)
      .join(', ');

    try {
      return await this.wemopay.createPayment({
        referenceId: providerReference(order.orderNumber, payment.attempt ?? 1),
        orderNumber: order.orderNumber,
        amountMinor: order.total,
        currency: order.currency,
        description: description || `Order ${order.orderNumber}`,
        customer: {
          referenceId: order.userId.toString(),
          email: order.customer.email,
          firstName: payer.firstName,
          lastName: payer.lastName,
        },
        billing: payer.billing,
      });
    } catch (error) {
      if (error instanceof WemopayError) {
        // Сетевая ошибка не означает, что платёж не создан на той стороне.
        // Помечаем на проверку: следующая попытка найдёт его по referenceId.
        if (error.status === 502) {
          this.flagForReview(
            payment,
            ReviewReason.CONFLICTING_STATE,
            `WemoPay unreachable while creating the payment: ${error.message}`,
          );
          await payment.save();
        }
        // Отказ провайдера сохраняем с полями: раньше он пропадал бесследно —
        // ни в логах, ни в платеже, и понять причину было не по чему.
        this.logger.error(
          `WemoPay rejected payment ${order.orderNumber} (HTTP ${error.status}): ${error.message}`,
        );
        payment.errorCode = error.status === 502 ? 'PROVIDER_UNREACHABLE' : 'PROVIDER_REJECTED';
        payment.errorMessage = error.message.slice(0, 500);
        await payment.save();
        // Клиенту — человеческий текст; поля провайдера видны в /admin/payments.
        throw new BadRequestException(
          error.status === 502
            ? 'Payments are temporarily unavailable. Please try again later.'
            : 'We could not start your payment. Please try again later or contact support.',
        );
      }
      throw error;
    }
  }

  // ─── вебхук ────────────────────────────────────────────────────────────────

  async handleWebhook(rawBody: Buffer | undefined, signature: unknown, body: any) {
    if (!this.wemopay.verifyWebhookSignature(rawBody, signature)) {
      // Молча отвергаем: подробности помогли бы подбирать подпись.
      throw new BadRequestException('Invalid signature');
    }

    const { id, state, referenceId } = body ?? {};
    if (!id || !state) {
      throw new BadRequestException('id and state are required');
    }

    let payment = await this.paymentModel
      .findOne({ providerPaymentId: id })
      .exec();

    // Вебхук умеет обогнать наше собственное сохранение providerPaymentId —
    // тогда ищем по номеру заказа из номера попытки (`PD-482913-2` → `482913`).
    // Номер без нашего префикса не ищем вовсе: это платёж другого сайта.
    const ownOrderNumber = referenceId ? orderNumberFromReference(referenceId) : null;
    if (!payment && ownOrderNumber) {
      payment = await this.paymentModel
        .findOne({ referenceId: ownOrderNumber })
        .exec();
      const expected = payment ? providerReference(payment.referenceId, payment.attempt ?? 1) : null;
      if (payment && (referenceId !== expected || (payment.providerPaymentId && payment.providerPaymentId !== id))) {
        // Вебхук от закрытой попытки. Молча отбросить его нельзя: если там
        // оплата, клиент мог заплатить дважды — отмечаем и зовём человека.
        const mapped = this.wemopay.mapState(state);
        payment.events.push({
          source: 'webhook',
          providerState: state,
          status: mapped ?? null,
          outcome: 'superseded',
          errorCode: null,
          errorMessage: `Webhook for ${referenceId} (${id}); current attempt is ${expected}`,
          at: new Date(),
        });
        if (mapped === PaymentStatus.PAID || mapped === PaymentStatus.AUTHORIZED) {
          this.flagForReview(
            payment,
            ReviewReason.CONFLICTING_STATE,
            `Superseded attempt ${referenceId} reports ${state} — the customer may have paid twice`,
          );
        }
        await payment.save();
        return { received: true, superseded: true };
      }
    }

    if (!payment) {
      this.logger.error(`Webhook for unknown payment id=${id} reference=${referenceId}`);
      throw new NotFoundException('Payment not found');
    }

    if (!payment.providerPaymentId) payment.providerPaymentId = id;

    const outcome = this.applyProviderState(payment, body, 'webhook');
    await payment.save();
    await this.syncOrder(payment, outcome);

    return { received: true };
  }

  // ─── чтение ────────────────────────────────────────────────────────────────

  /** Состояние платежа по заказу. `sync` подтягивает его у провайдера. */
  async getStatus(userId: string, orderNumber: string, isAdmin: boolean, sync = false) {
    const order = (await this.orders.findByNumber(orderNumber, userId, isAdmin)) as any;
    const payment = await this.paymentModel
      .findOne({ orderId: new Types.ObjectId(order.id) })
      .exec();
    if (!payment) throw new NotFoundException('No payment for this order yet');

    // Подстраховка на случай потерянного вебхука. Финальный платёж не трогаем.
    if (sync && payment.providerPaymentId && !isFinalPaymentStatus(payment.status)) {
      try {
        const result = await this.wemopay.getPayment(payment.providerPaymentId);
        const outcome = this.applyProviderState(payment, result, 'sync');
        await payment.save();
        await this.syncOrder(payment, outcome);
      } catch (error) {
        this.logger.warn(`Status sync failed for ${orderNumber}: ${(error as Error).message}`);
      }
    }

    return this.present(payment, isAdmin);
  }

  async findAll(query: QueryPaymentsDto) {
    const page = query.page ?? 1;
    const filter: QueryFilter<PaymentDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.needsReview !== undefined) filter.needsReview = query.needsReview;
    if (query.search?.trim()) {
      filter.referenceId = { $regex: query.search.trim(), $options: 'i' };
    }

    const [items, total, statusCounts, reviewCount] = await Promise.all([
      this.paymentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .exec(),
      this.paymentModel.countDocuments(filter).exec(),
      this.paymentModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.paymentModel.countDocuments({ needsReview: true }).exec(),
    ]);

    return {
      items: items.map((payment) => this.present(payment, true)),
      total,
      page,
      limit: PAGE_SIZE,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      // Сводка для шапки админки: сколько в каком статусе и сколько ждёт разбора.
      counts: Object.fromEntries(
        statusCounts.map((row: { _id: string; count: number }) => [row._id, row.count]),
      ),
      needsReviewCount: reviewCount,
    };
  }

  /** Возврат отмечается руками: API возвратов у провайдера мы не подключали. */
  async markRefunded(paymentId: string, note?: string) {
    const payment = await this.paymentModel.findById(paymentId).exec();
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.PAID) {
      throw new ConflictException('Only a paid payment can be marked refunded');
    }
    payment.status = PaymentStatus.REFUNDED;
    payment.events.push({
      source: 'manual',
      providerState: payment.providerState ?? null,
      status: PaymentStatus.REFUNDED,
      outcome: 'updated',
      errorCode: null,
      errorMessage: null,
      at: new Date(),
    });
    payment.reviewNote = note ?? payment.reviewNote ?? null;
    await payment.save();
    return this.present(payment, true);
  }

  /** Админ разобрался — снимаем флаг, причину оставляем в истории. */
  async resolveReview(paymentId: string) {
    const payment = await this.paymentModel.findById(paymentId).exec();
    if (!payment) throw new NotFoundException('Payment not found');
    payment.needsReview = false;
    payment.reviewReason = null;
    await payment.save();
    return this.present(payment, true);
  }

  /**
   * Клиенту — только исход, админу — вся кухня. Состояния провайдера и история
   * событий наружу не уходят: они ничего не говорят клиенту и раскрывают
   * внутренности интеграции.
   */
  private present(payment: PaymentDocument, isAdmin: boolean) {
    const base = {
      id: payment.id as string,
      orderId: payment.orderId.toString(),
      referenceId: payment.referenceId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      isPaid: payment.status === PaymentStatus.PAID,
      paidAt: payment.paidAt ?? null,
      redirectUrl: isFinalPaymentStatus(payment.status) ? null : (payment.redirectUrl ?? null),
      createdAt: (payment as any).createdAt,
      updatedAt: (payment as any).updatedAt,
    };
    if (!isAdmin) return base;

    return {
      ...base,
      provider: payment.provider,
      attempt: payment.attempt ?? 1,
      providerPaymentId: payment.providerPaymentId ?? null,
      providerState: payment.providerState ?? null,
      needsReview: payment.needsReview,
      reviewReason: payment.reviewReason ?? null,
      reviewNote: payment.reviewNote ?? null,
      errorCode: payment.errorCode ?? null,
      errorMessage: payment.errorMessage ?? null,
      events: payment.events.slice(-20),
    };
  }
}
