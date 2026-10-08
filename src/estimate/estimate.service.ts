import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Model, QueryFilter, Types } from 'mongoose';
import {
  PricingModel,
  Service,
  ServiceDocument,
  ServiceMilestone,
  ServiceRate,
} from '../services/schemas/service.schema';
import {
  Estimate,
  EstimateDocument,
  EstimateItem,
  EstimateStatus,
  DiscountType,
} from './schemas/estimate.schema';
import { computeEstimatePricing, computeItemPricing, ItemPricing } from './estimate.pricing';
import { AddEstimateItemDto } from './dto/add-estimate-item.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { PriceSelectionDto } from './dto/price-selection.dto';
import { UpdateEstimateItemDto } from './dto/update-estimate-item.dto';

/** Кто пришёл за сметой: пользователь по JWT либо гость по токену. */
export interface EstimateOwner {
  userId?: string | null;
  token?: string | null;
}

/** Сколько живёт брошенная гостевая смета. Пользовательские не истекают. */
const GUEST_ESTIMATE_TTL_DAYS = 30;

const DEFAULT_CURRENCY = 'EUR';

@Injectable()
export class EstimateService {
  constructor(
    @InjectModel(Estimate.name) private readonly estimateModel: Model<EstimateDocument>,
    @InjectModel(Service.name) private readonly serviceModel: Model<ServiceDocument>,
  ) {}

  // ─── чтение ────────────────────────────────────────────────────────────────

  /**
   * Текущая смета. Ничего не создаёт: у GET нет причин писать в базу, иначе
   * каждый обход краулера плодил бы пустые документы с токенами. Смета
   * появляется при первом добавлении позиции.
   */
  async getEstimate(owner: EstimateOwner) {
    const estimate = await this.findActive(owner);
    return estimate ? this.serialize(estimate) : this.emptyEstimate();
  }

  async addItem(owner: EstimateOwner, dto: AddEstimateItemDto) {
    const estimate = await this.getOrCreate(owner);
    const { service, rate } = await this.resolveRate(dto.serviceId, dto.model);

    const units = dto.units ?? rate.minUnits ?? 1;
    const extraHours = dto.extraHours ?? 0;
    this.assertUnits(rate, units, extraHours);

    const milestones = this.resolveMilestones(rate, dto.milestoneKeys);
    this.assertCurrency(estimate, service.currency);

    const existing = estimate.items.find((item) =>
      this.isSameLine(item, dto.serviceId, dto.model, milestones),
    );

    if (existing) {
      // Повторное добавление той же строки наращивает объём, а не плодит
      // дубли: иначе двойной клик по «в смету» даёт две позиции.
      const merged = existing.units + units;
      const mergedExtra = existing.extraHours + extraHours;
      this.assertUnits(rate, merged, mergedExtra);
      existing.units = merged;
      existing.extraHours = mergedExtra;
      if (dto.notes !== undefined) existing.notes = dto.notes || null;
    } else {
      estimate.items.push(
        this.buildItem(service, rate, { units, extraHours, milestones, notes: dto.notes }),
      );
    }

    await estimate.save();
    return this.serialize(estimate);
  }

  async updateItem(owner: EstimateOwner, itemId: string, dto: UpdateEstimateItemDto) {
    const estimate = await this.requireEstimate(owner);
    const item = this.requireItem(estimate, itemId);
    const { rate } = await this.resolveRate(item.serviceId.toString(), item.model);

    const units = dto.units ?? item.units;
    const extraHours = dto.extraHours ?? item.extraHours;
    this.assertUnits(rate, units, extraHours);

    if (dto.milestoneKeys !== undefined) {
      item.milestones = this.resolveMilestones(rate, dto.milestoneKeys);
    }
    item.units = units;
    item.extraHours = extraHours;
    if (dto.notes !== undefined) item.notes = dto.notes || null;

    await estimate.save();
    return this.serialize(estimate);
  }

  async removeItem(owner: EstimateOwner, itemId: string) {
    const estimate = await this.requireEstimate(owner);
    const item = this.requireItem(estimate, itemId);
    estimate.items.splice(estimate.items.indexOf(item), 1);
    await estimate.save();
    return this.serialize(estimate);
  }

  async clear(owner: EstimateOwner) {
    const estimate = await this.findActive(owner);
    if (!estimate) return this.emptyEstimate();
    estimate.items.splice(0, estimate.items.length);
    estimate.discount = null;
    await estimate.save();
    return this.serialize(estimate);
  }

  /**
   * Принять текущие цены каталога: пересобирает снапшот позиций и выбрасывает
   * те, что больше не продаются. Автоматически этого не происходит — молча
   * переписывать сумму, которую клиент уже видел, нельзя.
   */
  async refresh(owner: EstimateOwner) {
    const estimate = await this.requireEstimate(owner);
    const services = await this.loadServices(estimate);
    const kept: EstimateItem[] = [];

    for (const item of estimate.items) {
      const service = services.get(item.serviceId.toString());
      const rate = service?.pricing?.find((candidate) => candidate.model === item.model);
      if (!service?.published || !rate) continue;

      const milestones = item.milestones.length
        ? this.resolveMilestones(
            rate,
            item.milestones.map((milestone) => milestone.key),
          )
        : [];

      kept.push(
        this.buildItem(service, rate, {
          units: Math.min(Math.max(item.units, rate.minUnits ?? 1), rate.maxUnits ?? item.units),
          extraHours: item.extraHours,
          milestones,
          notes: item.notes ?? undefined,
        }),
      );
    }

    estimate.items.splice(0, estimate.items.length, ...kept);
    // Позиции пересобраны по каталогу, поэтому и валюта сметы — каталожная:
    // иначе после смены валюты смета так и осталась бы в старой.
    estimate.currency = kept[0]?.currency ?? DEFAULT_CURRENCY;
    await estimate.save();
    return this.serialize(estimate);
  }

  /**
   * Слияние гостевой сметы в пользовательскую — вызывается сразу после
   * логина. Без него всё, что человек набрал до входа, теряется.
   */
  async merge(userId: string, token: string) {
    const guest = await this.estimateModel
      .findOne({ token, status: EstimateStatus.ACTIVE })
      .exec();
    const target = await this.getOrCreate({ userId });

    if (!guest || guest.id === target.id) return this.serialize(target);

    if (guest.items.length > 0) {
      if (target.items.length === 0) target.currency = guest.currency;
      else if (target.currency !== guest.currency) {
        throw new ConflictException(
          `Cannot merge a ${guest.currency} estimate into a ${target.currency} one`,
        );
      }

      for (const item of guest.items) {
        const existing = target.items.find((candidate) =>
          this.isSameLine(candidate, item.serviceId.toString(), item.model, item.milestones),
        );
        if (existing) {
          existing.units += item.units;
          existing.extraHours += item.extraHours;
        } else {
          target.items.push(item);
        }
      }
    }

    await target.save();
    // Токен гостя больше ни к чему не ведёт — документ незачем хранить.
    await this.estimateModel.deleteOne({ _id: guest._id }).exec();
    return this.serialize(target);
  }

  /** Расчёт без сохранения: калькулятор на витрине, доступен без владельца. */
  async price(dto: PriceSelectionDto) {
    const items: EstimateItem[] = [];
    let currency: string | null = null;

    for (const entry of dto.items) {
      const { service, rate } = await this.resolveRate(entry.serviceId, entry.model);
      const units = entry.units ?? rate.minUnits ?? 1;
      const extraHours = entry.extraHours ?? 0;
      this.assertUnits(rate, units, extraHours);

      currency ??= service.currency;
      if (currency !== service.currency) {
        throw new BadRequestException(
          `All priced services must share a currency: got ${currency} and ${service.currency}`,
        );
      }

      items.push(
        this.buildItem(service, rate, {
          units,
          extraHours,
          milestones: this.resolveMilestones(rate, entry.milestoneKeys),
          notes: entry.notes,
        }),
      );
    }

    const priced = items.map((item) => ({ item, pricing: computeItemPricing(item) }));
    const totals = computeEstimatePricing(priced.map((row) => row.pricing));

    return {
      currency: currency ?? DEFAULT_CURRENCY,
      items: priced.map((row) => this.presentItem(row.item, row.pricing, true, false, null, null)),
      ...totals,
      discount: null,
    };
  }

  // ─── админ ─────────────────────────────────────────────────────────────────

  async findById(estimateId: string) {
    const estimate = await this.estimateModel.findById(estimateId).exec();
    if (!estimate) throw new NotFoundException('Estimate not found');
    return this.serialize(estimate);
  }

  async applyDiscount(estimateId: string, dto: ApplyDiscountDto | null) {
    const estimate = await this.estimateModel.findById(estimateId).exec();
    if (!estimate) throw new NotFoundException('Estimate not found');

    if (dto && dto.type === DiscountType.PERCENT && dto.value > 100) {
      throw new BadRequestException('A percent discount cannot exceed 100');
    }

    estimate.discount = dto
      ? { type: dto.type, value: dto.value, reason: dto.reason ?? null }
      : null;
    await estimate.save();
    return this.serialize(estimate);
  }

  // ─── владелец сметы ──────────────────────────────────────────────────────

  private ownerFilter(owner: EstimateOwner): QueryFilter<EstimateDocument> | null {
    if (owner.userId) {
      return { userId: new Types.ObjectId(owner.userId), status: EstimateStatus.ACTIVE };
    }
    if (owner.token) return { token: owner.token, status: EstimateStatus.ACTIVE };
    return null;
  }

  private async findActive(owner: EstimateOwner) {
    const filter = this.ownerFilter(owner);
    if (!filter) return null;
    return this.estimateModel.findOne(filter).exec();
  }

  private async requireEstimate(owner: EstimateOwner) {
    const estimate = await this.findActive(owner);
    if (!estimate) throw new NotFoundException('Estimate not found');
    return estimate;
  }

  private async getOrCreate(owner: EstimateOwner) {
    const existing = await this.findActive(owner);
    if (existing) return existing;

    if (owner.userId) {
      return this.estimateModel.create({
        userId: new Types.ObjectId(owner.userId),
        currency: DEFAULT_CURRENCY,
        expiresAt: null,
      });
    }

    return this.estimateModel.create({
      // Токен — это и есть доступ к гостевой смете, поэтому он случайный
      // и достаточно длинный, чтобы его нельзя было угадать.
      token: randomBytes(24).toString('base64url'),
      currency: DEFAULT_CURRENCY,
      expiresAt: new Date(Date.now() + GUEST_ESTIMATE_TTL_DAYS * 24 * 60 * 60 * 1000),
    });
  }

  // ─── каталог ───────────────────────────────────────────────────────────────

  private async resolveRate(serviceId: string, model: PricingModel) {
    const service = await this.serviceModel
      .findOne({ _id: serviceId, published: true })
      .exec();
    if (!service) throw new NotFoundException('Service not found');

    const rate = service.pricing?.find((candidate) => candidate.model === model);
    if (!rate) {
      const offered = (service.pricing ?? []).map((candidate) => candidate.model);
      throw new BadRequestException(
        offered.length
          ? `Service "${service.slug}" is not sold as "${model}". Available: ${offered.join(', ')}`
          : `Service "${service.slug}" has no self-service pricing`,
      );
    }
    return { service, rate };
  }

  private assertUnits(rate: ServiceRate, units: number, extraHours: number) {
    const min = rate.minUnits ?? 1;
    if (units < min) {
      throw new BadRequestException(`This rate starts at ${min} ${this.unitName(rate.model)}`);
    }
    if (rate.maxUnits != null && units > rate.maxUnits) {
      throw new BadRequestException(
        `This rate is capped at ${rate.maxUnits} ${this.unitName(rate.model)}`,
      );
    }
    if (extraHours > 0 && rate.model !== PricingModel.RETAINER) {
      throw new BadRequestException('extraHours applies to retainer rates only');
    }
  }

  private unitName(model: PricingModel): string {
    if (model === PricingModel.FIXED) return 'project(s)';
    if (model === PricingModel.RETAINER) return 'period(s)';
    return 'hour(s)';
  }

  /**
   * Этапы выбранного тарифа. Пропущенный `milestoneKeys` означает полный объём
   * — проектная услуга по умолчанию продаётся целиком; переданный список
   * сужает выбор, но обязательные этапы остаются всегда.
   */
  private resolveMilestones(
    rate: ServiceRate,
    keys: string[] | undefined,
  ): { key: string; title: string; amount: number }[] {
    const available: ServiceMilestone[] = rate.milestones ?? [];

    if (available.length === 0) {
      if (keys?.length) {
        throw new BadRequestException('This rate has no milestones to choose from');
      }
      return [];
    }
    if (rate.model !== PricingModel.FIXED && rate.model !== PricingModel.MIXED) {
      throw new BadRequestException('Milestones apply to fixed and mixed rates only');
    }

    const selected =
      keys === undefined
        ? available
        : (() => {
            const requested = new Set(keys);
            const unknown = keys.filter(
              (key) => !available.some((milestone) => milestone.key === key),
            );
            if (unknown.length) {
              throw new BadRequestException(`Unknown milestone(s): ${unknown.join(', ')}`);
            }
            return available.filter(
              (milestone) => milestone.required || requested.has(milestone.key),
            );
          })();

    if (selected.length === 0) {
      throw new BadRequestException('Select at least one milestone');
    }
    return selected.map((milestone) => ({
      key: milestone.key,
      title: milestone.title,
      amount: milestone.amount,
    }));
  }

  private assertCurrency(estimate: EstimateDocument, currency: string) {
    if (estimate.items.length === 0) {
      estimate.currency = currency;
      return;
    }
    if (estimate.currency !== currency) {
      throw new ConflictException(
        `This estimate is in ${estimate.currency}; the service is priced in ${currency}. Accept the new prices in your estimate first.`,
      );
    }
  }

  /** Снапшот тарифа в позицию: дальше смета живёт независимо от каталога. */
  private buildItem(
    service: ServiceDocument,
    rate: ServiceRate,
    input: {
      units: number;
      extraHours: number;
      milestones: { key: string; title: string; amount: number }[];
      notes?: string;
    },
  ): EstimateItem {
    return {
      serviceId: service._id as Types.ObjectId,
      slug: service.slug,
      title: service.title,
      model: rate.model,
      unitAmount: rate.amount,
      baseAmount: rate.baseAmount ?? 0,
      includedHours: rate.includedHours ?? 0,
      overageAmount: rate.overageAmount ?? 0,
      period: rate.period ?? null,
      units: input.units,
      extraHours: input.extraHours,
      milestones: input.milestones,
      tiers: (rate.tiers ?? []).map((tier) => ({
        minHours: tier.minHours,
        discountPercent: tier.discountPercent,
      })),
      currency: service.currency,
      notes: input.notes || null,
    } as EstimateItem;
  }

  private isSameLine(
    item: EstimateItem,
    serviceId: string,
    model: PricingModel,
    milestones: { key: string }[],
  ): boolean {
    if (item.serviceId.toString() !== serviceId || item.model !== model) return false;
    const left = item.milestones.map((milestone) => milestone.key).sort();
    const right = milestones.map((milestone) => milestone.key).sort();
    return left.length === right.length && left.every((key, index) => key === right[index]);
  }

  private requireItem(estimate: EstimateDocument, itemId: string) {
    if (!Types.ObjectId.isValid(itemId)) throw new NotFoundException('Estimate item not found');
    const item = estimate.items.find(
      (candidate) => (candidate as EstimateItem & { _id: Types.ObjectId })._id.toString() === itemId,
    );
    if (!item) throw new NotFoundException('Estimate item not found');
    return item;
  }

  // ─── сериализация ──────────────────────────────────────────────────────────

  private async loadServices(estimate: EstimateDocument) {
    const ids = [...new Set(estimate.items.map((item) => item.serviceId.toString()))];
    if (ids.length === 0) return new Map<string, ServiceDocument>();
    const services = await this.serviceModel.find({ _id: { $in: ids } }).exec();
    return new Map(services.map((service) => [service._id.toString(), service]));
  }

  private emptyEstimate() {
    return {
      id: null,
      token: null,
      currency: DEFAULT_CURRENCY,
      status: EstimateStatus.ACTIVE,
      items: [],
      discount: null,
      subtotal: 0,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
      total: 0,
      volumeDiscountTotal: 0,
      unavailableCount: 0,
    };
  }

  private presentItem(
    item: EstimateItem,
    pricing: ItemPricing,
    available: boolean,
    priceChanged: boolean,
    currentUnitAmount: number | null,
    currentCurrency: string | null,
  ) {
    return {
      id: (item as EstimateItem & { _id?: Types.ObjectId })._id?.toString() ?? null,
      serviceId: item.serviceId.toString(),
      slug: item.slug,
      title: item.title,
      model: item.model,
      currency: item.currency,
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
      tiers: item.tiers.map((tier) => ({
        minHours: tier.minHours,
        discountPercent: tier.discountPercent,
      })),
      notes: item.notes ?? null,
      pricing,
      /** Услугу снятую с продажи в сумму не берём, но из сметы не выкидываем. */
      available,
      /** Каталог разошёлся со снапшотом — принять новую цену можно `POST /estimate/refresh`. */
      priceChanged,
      currentUnitAmount,
      currentCurrency,
    };
  }

  private async serialize(estimate: EstimateDocument) {
    const services = await this.loadServices(estimate);

    const rows = estimate.items.map((item) => {
      const service = services.get(item.serviceId.toString());
      const rate = service?.pricing?.find((candidate) => candidate.model === item.model);
      const available = Boolean(service?.published && rate);

      const priceChanged =
        Boolean(rate) &&
        (service!.currency !== item.currency ||
          rate!.amount !== item.unitAmount ||
          (rate!.baseAmount ?? 0) !== item.baseAmount ||
          (rate!.overageAmount ?? 0) !== item.overageAmount ||
          item.milestones.some((milestone) => {
            const current = rate!.milestones?.find(
              (candidate) => candidate.key === milestone.key,
            );
            return !current || current.amount !== milestone.amount;
          }));

      return {
        pricing: computeItemPricing(item),
        available,
        payload: (pricing: ItemPricing) =>
          this.presentItem(
            item,
            pricing,
            available,
            priceChanged,
            rate?.amount ?? null,
            service?.currency ?? null,
          ),
      };
    });

    // В сумму идут только доступные позиции: снятая с продажи услуга не должна
    // попадать в счёт, даже пока она висит в смете с пометкой.
    const totals = computeEstimatePricing(
      rows.filter((row) => row.available).map((row) => row.pricing),
      estimate.discount,
    );

    return {
      id: estimate.id as string,
      token: estimate.token ?? null,
      currency: estimate.currency,
      status: estimate.status,
      items: rows.map((row) => row.payload(row.pricing)),
      discount: estimate.discount
        ? {
            type: estimate.discount.type,
            value: estimate.discount.value,
            reason: estimate.discount.reason ?? null,
          }
        : null,
      ...totals,
      unavailableCount: rows.filter((row) => !row.available).length,
    };
  }
}
