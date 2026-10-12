import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomInt } from 'node:crypto';
import { Model, QueryFilter, Types } from 'mongoose';
import {
  computeEstimatePricing,
  computeItemPricing,
} from '../estimate/estimate.pricing';
import {
  Estimate,
  EstimateDocument,
  EstimateStatus,
} from '../estimate/schemas/estimate.schema';
import { Payment, PaymentDocument, PaymentStatus } from '../payments/schemas/payment.schema';
import { Service, ServiceDocument } from '../services/schemas/service.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { MessageAuthorRole, OrderMessage, OrderMessageDocument } from './schemas/order-message.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import {
  Order,
  OrderDocument,
  OrderItem,
  ORDER_TRANSITIONS,
  OrderStatus,
} from './schemas/order.schema';

const PAGE_SIZE = 20;

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Estimate.name) private readonly estimateModel: Model<EstimateDocument>,
    @InjectModel(Service.name) private readonly serviceModel: Model<ServiceDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(OrderMessage.name)
    private readonly messageModel: Model<OrderMessageDocument>,
  ) {}

  /**
   * Довешивает на заказы то, что в списке нужно всегда: статус оплаты и число
   * непрочитанных сообщений другой стороны. Считается двумя запросами на всю
   * страницу, а не по одному на строку.
   */
  private async decorate(orders: OrderDocument[], forRole: UserRole) {
    if (orders.length === 0) return [];
    const ids = orders.map((order) => order._id as Types.ObjectId);
    const isAdmin = forRole === UserRole.ADMIN;

    const [payments, unread] = await Promise.all([
      this.paymentModel
        .find({ orderId: { $in: ids } }, { orderId: 1, status: 1, needsReview: 1, paidAt: 1 })
        .lean()
        .exec(),
      this.messageModel.aggregate([
        {
          $match: {
            orderId: { $in: ids },
            authorRole: isAdmin ? MessageAuthorRole.CUSTOMER : MessageAuthorRole.ADMIN,
            ...(isAdmin ? { readByAdminAt: null } : { readByCustomerAt: null }),
          },
        },
        { $group: { _id: '$orderId', count: { $sum: 1 } } },
      ]),
    ]);

    const paymentByOrder = new Map(
      payments.map((payment: any) => [payment.orderId.toString(), payment]),
    );
    const unreadByOrder = new Map<string, number>(
      unread.map((row: { _id: Types.ObjectId; count: number }) => [
        row._id.toString(),
        row.count,
      ]),
    );

    return orders.map((order) => {
      const id = (order._id as Types.ObjectId).toString();
      const payment = paymentByOrder.get(id);
      return {
        ...order.toJSON(),
        payment: payment
          ? {
              status: payment.status as PaymentStatus,
              isPaid: payment.status === PaymentStatus.PAID,
              paidAt: payment.paidAt ?? null,
              // Флаг разбора видит только админ: клиенту он ничего не говорит.
              ...(isAdmin ? { needsReview: Boolean(payment.needsReview) } : {}),
            }
          : null,
        unreadCount: unreadByOrder.get(id) ?? 0,
      };
    });
  }

  /**
   * Шестизначный номер, по которому заказ ищут и люди, и провайдер.
   *
   * Уникальность держит индекс, а не эта проверка: между `findOne` и `create`
   * номер может занять параллельный запрос. Поэтому вызывающий код ловит
   * ошибку дубля и пробует снова.
   */
  private generateOrderNumber(): string {
    return String(randomInt(100000, 1000000));
  }

  /**
   * Заказ из активной сметы.
   *
   * Смета изменяемая, заказ — нет: сюда переносится снимок позиций вместе с
   * посчитанными суммами. Дальше заказ живёт независимо от каталога.
   */
  async createFromEstimate(userId: string, dto: CreateOrderDto) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const estimate = await this.estimateModel
      .findOne({ userId: new Types.ObjectId(userId), status: EstimateStatus.ACTIVE })
      .exec();
    if (!estimate || estimate.items.length === 0) {
      throw new BadRequestException('Your estimate is empty');
    }

    // Услуги нужны, чтобы убедиться: всё в смете до сих пор продаётся и по той
    // же цене. Заказывать по цене, которой в каталоге уже нет, нельзя.
    const ids = [...new Set(estimate.items.map((item) => item.serviceId.toString()))];
    const services = new Map(
      (await this.serviceModel.find({ _id: { $in: ids } }).exec()).map((service) => [
        service._id.toString(),
        service,
      ]),
    );

    const unavailable: string[] = [];
    const stale: string[] = [];
    for (const item of estimate.items) {
      const service = services.get(item.serviceId.toString());
      const rate = service?.pricing?.find((candidate) => candidate.model === item.model);
      if (!service?.published || !rate) {
        unavailable.push(item.title);
        continue;
      }
      const milestonesChanged = item.milestones.some((milestone) => {
        const current = rate.milestones?.find((m) => m.key === milestone.key);
        return !current || current.amount !== milestone.amount;
      });
      if (
        service.currency !== item.currency ||
        rate.amount !== item.unitAmount ||
        (rate.baseAmount ?? 0) !== item.baseAmount ||
        (rate.overageAmount ?? 0) !== item.overageAmount ||
        milestonesChanged
      ) {
        stale.push(item.title);
      }
    }

    if (unavailable.length) {
      throw new ConflictException(
        `No longer on sale: ${unavailable.join(', ')}. Remove these lines and try again.`,
      );
    }
    if (stale.length) {
      // Молча взять новую цену нельзя — человек согласился на другую сумму.
      throw new ConflictException(
        `Prices changed for: ${stale.join(', ')}. Accept the new prices in your estimate first.`,
      );
    }

    const items: OrderItem[] = estimate.items.map((item) => ({
      serviceId: item.serviceId,
      slug: item.slug,
      title: item.title,
      model: item.model,
      unitAmount: item.unitAmount,
      baseAmount: item.baseAmount,
      includedHours: item.includedHours,
      overageAmount: item.overageAmount,
      period: item.period ?? null,
      units: item.units,
      extraHours: item.extraHours,
      milestones: item.milestones.map((milestone) => ({
        key: milestone.key,
        title: milestone.title,
        amount: milestone.amount,
      })),
      pricing: computeItemPricing(item),
      notes: item.notes ?? null,
    })) as OrderItem[];

    const totals = computeEstimatePricing(
      items.map((item) => item.pricing),
      estimate.discount,
    );
    if (totals.total <= 0) {
      throw new BadRequestException('Order total must be greater than zero');
    }

    // Номер занимает уникальный индекс; при столкновении берём следующий.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const order = await this.orderModel.create({
          orderNumber: this.generateOrderNumber(),
          userId: new Types.ObjectId(userId),
          estimateId: estimate._id,
          items,
          customer: {
            name: user.name,
            email: user.email,
            phone: dto.phone ?? null,
            company: dto.company ?? null,
          },
          billing: dto.billing ?? {},
          currency: estimate.currency,
          subtotal: totals.subtotal,
          discount: estimate.discount ?? null,
          discountAmount: totals.discountAmount,
          volumeDiscountTotal: totals.volumeDiscountTotal,
          total: totals.total,
          status: OrderStatus.AWAITING_PAYMENT,
          note: dto.note ?? null,
        });

        // Смета превращена в заказ и больше не редактируется. Следующий
        // GET /estimate заведёт человеку новую, пустую.
        estimate.status = EstimateStatus.CONVERTED;
        await estimate.save();

        return order.toJSON();
      } catch (error: any) {
        if (error?.code === 11000 && attempt < 4) continue;
        throw error;
      }
    }
    throw new ConflictException('Could not allocate an order number, please retry');
  }

  async findMine(userId: string) {
    const orders = await this.orderModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
    return this.decorate(orders, UserRole.USER);
  }

  /** Заказ по номеру. Не-админ видит только свой. */
  async findByNumber(orderNumber: string, userId: string, isAdmin: boolean) {
    const order = await this.orderModel.findOne({ orderNumber }).exec();
    if (!order) throw new NotFoundException('Order not found');
    if (!isAdmin && order.userId.toString() !== userId) {
      // Чужой заказ — это «не найдено», а не «запрещено»: иначе по коду ответа
      // можно перебором узнать, какие номера существуют.
      throw new NotFoundException('Order not found');
    }
    const [decorated] = await this.decorate([order], isAdmin ? UserRole.ADMIN : UserRole.USER);
    return decorated;
  }

  async findById(orderId: string) {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findAll(query: QueryOrdersDto) {
    const page = query.page ?? 1;
    const filter: QueryFilter<OrderDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.search?.trim()) {
      const term = query.search.trim();
      filter.$or = [
        { orderNumber: { $regex: term, $options: 'i' } },
        { 'customer.email': { $regex: term, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    return {
      items: await this.decorate(items, UserRole.ADMIN),
      total,
      page,
      limit: PAGE_SIZE,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  /** Ручной перевод статуса админом. Оплату сюда не пускаем — её ставит платёж. */
  async updateStatus(orderId: string, status: OrderStatus) {
    const order = await this.findById(orderId);
    if (!ORDER_TRANSITIONS[order.status].includes(status)) {
      throw new ConflictException(
        `Cannot move an order from "${order.status}" to "${status}"`,
      );
    }
    order.status = status;
    await order.save();
    return order.toJSON();
  }

  /**
   * Отметка об оплате. Вызывается только из платёжного слоя и только один раз:
   * повторный вызов на уже оплаченном заказе ничего не делает.
   */
  async markPaid(orderId: Types.ObjectId | string): Promise<boolean> {
    const result = await this.orderModel
      .updateOne(
        { _id: orderId, status: OrderStatus.AWAITING_PAYMENT },
        { $set: { status: OrderStatus.PAID } },
      )
      .exec();
    return result.modifiedCount === 1;
  }
}
