/**
 * Общая обёртка писем portable.digital. Вёрстка табличная и со встроенными
 * стилями — иначе Outlook и Gmail её разваливают. Каждое значение из данных
 * проходит через `escapeHtml`: имя клиента или название услуги из админки не
 * должны превращаться в разметку письма.
 */

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Продавец в письмах. Держать в согласии с COMPANY_NAME / COMPANY_NUMBER во
 * фронтенде (src/lib/legal.ts). Адреса нет намеренно: он ещё не подтверждён,
 * а выдуманный адрес в письме о покупке хуже отсутствующего.
 */
export const SELLER = {
  legalName: 'PORTABLE DIGITAL LIMITED',
  companyNumber: '16974578',
  tradingName: 'Portable digital',
} as const;

export const LEGAL_PATHS = {
  terms: '/legal/terms-of-service',
  refund: '/legal/refund-cancellation',
  privacy: '/legal/privacy-policy',
  company: '/legal/company-details',
  contact: '/contact',
} as const;

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Суммы в минорных единицах: `22800, 'EUR'` → `€228.00`. */
export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100);
}

/** Дата и время в UTC — письмо читают в разных часовых поясах. */
export function formatUtc(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return `${new Date(date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const INK = '#0b0e10';
const MUTED = '#5b6670';
const LINE = '#e4e8ea';

export function heading(text: string): string {
  return `<h2 style="margin:28px 0 10px;font:600 17px/1.35 ${FONT};color:${INK}">${escapeHtml(text)}</h2>`;
}

export function paragraph(html: string, muted = false): string {
  return `<p style="margin:0 0 12px;font:400 15px/1.6 ${FONT};color:${muted ? MUTED : INK}">${html}</p>`;
}

export function link(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${INK};text-decoration:underline">${escapeHtml(label)}</a>`;
}

/** Таблица «название — сумма»; последняя строка выделяется как итог. */
export function amountsTable(rows: { label: string; detail?: string; amount: string }[], totalLabel: string, total: string): string {
  const cell = `padding:10px 0;border-bottom:1px solid ${LINE};font:400 14px/1.5 ${FONT};vertical-align:top`;
  const body = rows
    .map(
      (row) => `<tr><td style="${cell};color:${INK}">${escapeHtml(row.label)}${row.detail ? `<br><span style="color:${MUTED};font-size:13px">${escapeHtml(row.detail)}</span>` : ''}</td><td style="${cell};color:${INK};text-align:right;white-space:nowrap">${escapeHtml(row.amount)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:4px 0 8px">${body}<tr><td style="padding:12px 0 0;font:600 15px/1.5 ${FONT};color:${INK}">${escapeHtml(totalLabel)}</td><td style="padding:12px 0 0;font:600 15px/1.5 ${FONT};color:${INK};text-align:right;white-space:nowrap">${escapeHtml(total)}</td></tr></table>`;
}

/** Каркас письма: прехедер, шапка с маркой, содержимое, подвал с продавцом. */
export function layout({ preheader, title, content, siteUrl }: { preheader: string; title: string; content: string; siteUrl: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f5f6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f6"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:10px">
<tr><td style="background:${INK};border-radius:10px 10px 0 0;padding:22px 32px;font:600 18px/1 ${FONT};color:#ffffff">Portable <span style="font-weight:400;color:#c9d2d6">digital</span></td></tr>
<tr><td style="padding:30px 32px 8px">
<h1 style="margin:0 0 16px;font:600 22px/1.3 ${FONT};color:${INK}">${escapeHtml(title)}</h1>
${content}
</td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid ${LINE};font:400 12px/1.6 ${FONT};color:${MUTED}">
${escapeHtml(SELLER.legalName)} · company no. ${escapeHtml(SELLER.companyNumber)} · trading as ${escapeHtml(SELLER.tradingName)}<br>
${link(`${siteUrl}${LEGAL_PATHS.terms}`, 'Terms of Service')} · ${link(`${siteUrl}${LEGAL_PATHS.refund}`, 'Refund & Cancellation')} · ${link(`${siteUrl}${LEGAL_PATHS.privacy}`, 'Privacy Policy')} · ${link(`${siteUrl}${LEGAL_PATHS.contact}`, 'Contact us')}<br>
This is a service message about your order. Please keep it for your records.
</td></tr>
</table></td></tr></table>
</body></html>`;
}
