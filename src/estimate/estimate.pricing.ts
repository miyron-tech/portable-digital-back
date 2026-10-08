import { PricingModel } from '../services/schemas/service.schema';

/**
 * Единственный источник истины по деньгам сметы. Через него проходят и
 * выдача клиенту, и будущий расчёт заказа с платежом, поэтому показанная сумма
 * и списанная не могут разойтись.
 *
 * Всё считается в **минорных единицах** (целые центы). Float в деньгах не
 * участвует вообще: `0.1 + 0.2` в копейках — это `10 + 20`, без сюрпризов.
 */

export interface PriceableMilestone {
  amount: number;
}

export interface PriceableTier {
  minHours: number;
  discountPercent: number;
}

export interface PriceableItem {
  model: PricingModel;
  unitAmount: number;
  baseAmount: number;
  overageAmount: number;
  units: number;
  extraHours: number;
  milestones: PriceableMilestone[];
  tiers: PriceableTier[];
}

export interface ItemPricing {
  /** Единоразовая часть: проект, база смешанного тарифа, абонплата. */
  baseTotal: number;
  /** Часы, которые реально тарифицируются. */
  billableHours: number;
  /** Стоимость часов до объёмной скидки. */
  hoursTotal: number;
  volumeDiscountPercent: number;
  volumeDiscountAmount: number;
  /** `baseTotal + hoursTotal − volumeDiscountAmount`. */
  total: number;
}

export interface EstimateDiscountInput {
  type: 'percent' | 'fixed';
  value: number;
}

export interface EstimatePricing {
  subtotal: number;
  discountType: 'percent' | 'fixed' | null;
  discountValue: number;
  discountAmount: number;
  total: number;
  /** Сумма объёмных скидок по позициям — она уже внутри `subtotal`. */
  volumeDiscountTotal: number;
}

/** Процент от целой суммы, округляя до цента. Половина — вверх, детерминированно. */
const percentOf = (amount: number, percent: number): number =>
  Math.round((amount * percent) / 100);

const sum = (values: number[]): number => values.reduce((acc, value) => acc + value, 0);

/**
 * Лучшая объёмная скидка для набранных часов: берётся самый высокий порог,
 * который часы перешагнули. Ступени не складываются.
 */
export const resolveVolumeDiscount = (
  tiers: PriceableTier[],
  hours: number,
): number =>
  tiers
    .filter((tier) => hours >= tier.minHours)
    .reduce((best, tier) => Math.max(best, tier.discountPercent), 0);

/**
 * Стоимость одной позиции. Модель задаёт и разбор `units`, и то, какая часть
 * суммы считается часовой — объёмная скидка бьёт только по ней, потому что
 * скидка «за объём» — это скидка за часы, а не за фиксированную база.
 */
export const computeItemPricing = (item: PriceableItem): ItemPricing => {
  const selectedMilestones = sum(item.milestones.map((milestone) => milestone.amount));

  let baseTotal = 0;
  let billableHours = 0;
  let hourRate = 0;

  switch (item.model) {
    case PricingModel.FIXED:
      // Этапы, если заданы, вытесняют цену тарифа: платят за выбранный объём.
      baseTotal =
        (item.milestones.length > 0 ? selectedMilestones : item.unitAmount) * item.units;
      break;

    case PricingModel.HOURLY:
      billableHours = item.units;
      hourRate = item.unitAmount;
      break;

    case PricingModel.MIXED:
      // База начисляется один раз, часы — сверху.
      baseTotal = item.baseAmount + selectedMilestones;
      billableHours = item.units;
      hourRate = item.unitAmount;
      break;

    case PricingModel.RETAINER:
      // `units` — число периодов; тарифицируются только переработки.
      baseTotal = item.unitAmount * item.units;
      billableHours = item.extraHours;
      hourRate = item.overageAmount;
      break;
  }

  const hoursTotal = hourRate * billableHours;
  const volumeDiscountPercent = resolveVolumeDiscount(item.tiers, billableHours);
  const volumeDiscountAmount = percentOf(hoursTotal, volumeDiscountPercent);

  return {
    baseTotal,
    billableHours,
    hoursTotal,
    volumeDiscountPercent,
    volumeDiscountAmount,
    total: baseTotal + hoursTotal - volumeDiscountAmount,
  };
};

/** Итог сметы по уже посчитанным позициям и ручной скидке менеджера. */
export const computeEstimatePricing = (
  items: ItemPricing[],
  discount?: EstimateDiscountInput | null,
): EstimatePricing => {
  const subtotal = sum(items.map((item) => item.total));
  const volumeDiscountTotal = sum(items.map((item) => item.volumeDiscountAmount));

  let discountType: EstimatePricing['discountType'] = null;
  let discountValue = 0;
  let discountAmount = 0;

  if (discount && Number.isFinite(discount.value) && discount.value > 0) {
    discountValue = discount.value;
    if (discount.type === 'percent') {
      discountType = 'percent';
      discountAmount = percentOf(subtotal, Math.min(discountValue, 100));
    } else {
      discountType = 'fixed';
      discountAmount = Math.round(discountValue);
    }
  }

  // Скидка не уводит итог в минус и не превышает то, что есть в смете.
  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));

  return {
    subtotal,
    discountType,
    discountValue,
    discountAmount,
    total: subtotal - discountAmount,
    volumeDiscountTotal,
  };
};
