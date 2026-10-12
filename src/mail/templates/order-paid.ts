import {
  amountsTable,
  escapeHtml,
  formatMoney,
  formatUtc,
  heading,
  LEGAL_PATHS,
  layout,
  link,
  paragraph,
  type RenderedMail,
  SELLER,
} from './layout';

export interface OrderPaidItem {
  title: string;
  model: string;
  units: number;
  unitAmount: number;
  includedHours?: number;
  period?: string | null;
  milestones: { title: string }[];
  pricing: { volumeDiscountPercent: number; total: number };
}

export interface OrderPaidData {
  siteUrl: string;
  orderNumber: string;
  customerName: string;
  paidAt: Date;
  currency: string;
  items: OrderPaidItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  termsVersion: string;
  termsAcceptedAt: Date;
}

/** Строка-пояснение под позицией: что именно куплено и по какой цене. */
function itemDetail(item: OrderPaidItem, currency: string): string {
  const unit = formatMoney(item.unitAmount, currency);
  const parts: string[] = [];
  if (item.model === 'hourly' || item.model === 'mixed') {
    parts.push(`${item.units} ${item.units === 1 ? 'hour' : 'hours'} × ${unit} per hour`);
  } else if (item.model === 'retainer') {
    const period = item.period ?? 'month';
    parts.push(`${item.units} ${period}${item.units === 1 ? '' : 's'} × ${unit}`);
    if (item.includedHours) parts.push(`${item.includedHours} hours included per ${period}`);
  } else if (item.milestones.length) {
    parts.push(item.milestones.map((milestone) => milestone.title).join(', '));
  }
  if (item.pricing.volumeDiscountPercent > 0) parts.push(`volume discount ${item.pricing.volumeDiscountPercent}%`);
  return parts.join(' · ');
}

const CANCEL_CONSUMER =
  'If you are a consumer, you can cancel within 14 days after the day the contract is made, without giving a reason.';
const CANCEL_HOW =
  'To cancel, send us a clear statement through our contact page and quote your order number. You do not have to use any form.';
const CANCEL_REFUND =
  'We refund what is due without undue delay and no later than 14 days after you tell us, to the card you paid with and without a fee.';
const CANCEL_EARLY_START =
  'We will not start work during the 14 days unless you separately ask us to. If you do, and then cancel, you pay only for the work already done.';
const CANCEL_BUSINESS =
  'If you ordered as a business, the Refund & Cancellation policy explains the terms that apply to you.';

/**
 * Письмо после оплаты: состав заказа, сумма, принятая редакция условий и
 * порядок отказа. Отправляется один раз на заказ (`order-paid:<id>`).
 */
export function orderPaidMail(d: OrderPaidData): RenderedMail {
  const money = (minor: number) => formatMoney(minor, d.currency);
  const terms = `${d.siteUrl}${LEGAL_PATHS.terms}`;
  const refund = `${d.siteUrl}${LEGAL_PATHS.refund}`;
  const contact = `${d.siteUrl}${LEGAL_PATHS.contact}`;
  const orderUrl = `${d.siteUrl}/orders/${encodeURIComponent(d.orderNumber)}`;
  const subject = `Payment received — order ${d.orderNumber} · ${SELLER.tradingName}`;

  const rows: { label: string; detail?: string; amount: string }[] = d.items.map((item) => ({
    label: item.title,
    detail: itemDetail(item, d.currency),
    amount: money(item.pricing.total),
  }));
  if (d.discountAmount > 0) rows.push({ label: 'Discount', amount: `−${money(d.discountAmount)}` });

  const content = [
    paragraph(`Hello ${escapeHtml(d.customerName)},`),
    paragraph(
      `We have received your payment of <strong>${escapeHtml(money(d.total))}</strong> for order <strong>${escapeHtml(d.orderNumber)}</strong> on ${escapeHtml(formatUtc(d.paidAt))}.`,
    ),
    heading('Your order'),
    amountsTable(rows, 'Total paid', money(d.total)),
    paragraph(`You can see the order and its status in your account: ${link(orderUrl, `order ${d.orderNumber}`)}.`, true),
    heading('What happens next'),
    paragraph('We will confirm in writing whether we accept the order and agree the start date with you. If we cannot accept it, we refund the full amount.'),
    heading('Terms you accepted'),
    paragraph(
      `You accepted our ${link(terms, 'Terms of Service')} and ${link(refund, 'Refund & Cancellation')} policy, edition ${escapeHtml(d.termsVersion)}, on ${escapeHtml(formatUtc(d.termsAcceptedAt))}.`,
    ),
    heading('Your right to cancel'),
    paragraph(escapeHtml(CANCEL_CONSUMER)),
    paragraph(`${escapeHtml(CANCEL_HOW)} ${link(contact, 'Contact page')}.`),
    paragraph(escapeHtml(CANCEL_REFUND)),
    paragraph(escapeHtml(CANCEL_EARLY_START)),
    paragraph(`${escapeHtml(CANCEL_BUSINESS)} ${link(refund, 'Read the policy')}.`, true),
  ].join('\n');

  const text = [
    `Hello ${d.customerName},`,
    '',
    `We have received your payment of ${money(d.total)} for order ${d.orderNumber} on ${formatUtc(d.paidAt)}.`,
    '',
    'YOUR ORDER',
    ...d.items.map((item) => `- ${item.title}: ${money(item.pricing.total)}${itemDetail(item, d.currency) ? ` (${itemDetail(item, d.currency)})` : ''}`),
    ...(d.discountAmount > 0 ? [`- Discount: −${money(d.discountAmount)}`] : []),
    `Total paid: ${money(d.total)}`,
    `Order page: ${orderUrl}`,
    '',
    'WHAT HAPPENS NEXT',
    'We will confirm in writing whether we accept the order and agree the start date with you. If we cannot accept it, we refund the full amount.',
    '',
    'TERMS YOU ACCEPTED',
    `Terms of Service and Refund & Cancellation policy, edition ${d.termsVersion}, accepted on ${formatUtc(d.termsAcceptedAt)}.`,
    `Terms: ${terms}`,
    `Refund & Cancellation: ${refund}`,
    '',
    'YOUR RIGHT TO CANCEL',
    CANCEL_CONSUMER,
    `${CANCEL_HOW} ${contact}`,
    CANCEL_REFUND,
    CANCEL_EARLY_START,
    CANCEL_BUSINESS,
    '',
    `${SELLER.legalName}, company no. ${SELLER.companyNumber}, trading as ${SELLER.tradingName}.`,
  ].join('\n');

  return {
    subject,
    html: layout({
      preheader: `Order ${d.orderNumber} is paid. Your receipt, the terms you accepted and how to cancel.`,
      title: 'Thank you — your payment is in',
      content,
      siteUrl: d.siteUrl,
    }),
    text,
  };
}
