export interface AppConfig {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  frontendOrigin: string;
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshSecret: string;
    refreshTtl: string;
  };
  wemopay: {
    baseUrl: string;
    apiKey?: string;
    signingKey?: string;
    /** Публичный адрес, куда провайдер шлёт вебхуки. localhost не подойдёт. */
    webhookUrl?: string;
    /** Куда вернуть клиента после оплаты. */
    returnUrl?: string;
  };
  /** Абсолютный адрес витрины для ссылок в письмах (без завершающего `/`). */
  publicSiteUrl: string;
  mail: MailConfig;
}

export interface MailConfig {
  /**
   * Почта настроена, только когда есть хост и учётка. Без них письма копятся
   * в `mail_outbox` со статусом `pending` и уходят, как только переменные
   * появятся и бэкенд перезапустят.
   */
  configured: boolean;
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  replyTo?: string;
}

/**
 * Пустая строка в окружении — «не задано». Иначе `SMTP_HOST=` из шаблона .env
 * считался бы настроенной почтой, и воркер долбился бы в пустой хост.
 */
function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function mailConfig(): MailConfig {
  const host = env('SMTP_HOST');
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASS');
  const port = parseInt(env('SMTP_PORT') ?? '465', 10);
  const secureRaw = env('SMTP_SECURE');
  return {
    configured: Boolean(host && user && pass),
    host,
    port,
    // 465 — неявный TLS с первого байта; на остальных портах соединение
    // начинается открытым (для 587 TLS потом требуется через STARTTLS).
    secure: secureRaw === undefined ? port === 465 : secureRaw === 'true',
    user,
    pass,
    from: env('MAIL_FROM') ?? 'Portable digital <no-reply@portable.digital>',
    // Адрес для ответов задаётся явно: выдумывать ящик, которого нет, нельзя.
    replyTo: env('MAIL_REPLY_TO'),
  };
}

function publicSiteUrl(): string {
  const explicit = env('PUBLIC_SITE_URL');
  const fallback = (env('FRONTEND_ORIGIN') ?? 'http://localhost:3000').split(',')[0].trim();
  return (explicit ?? fallback).replace(/\/+$/, '');
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  mongodbUri:
    process.env.MONGODB_URI ?? 'mongodb://localhost:27017/itvit',
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  wemopay: {
    // Боевой хост отличается от песочницы — задаётся окружением, не кодом.
    baseUrl: process.env.WEMOPAY_BASE_URL ?? 'https://engine-sandbox.wemopay.net',
    apiKey: process.env.WEMOPAY_API_KEY,
    signingKey: process.env.WEMOPAY_SIGNING_KEY,
    webhookUrl: process.env.WEMOPAY_WEBHOOK_URL,
    returnUrl: process.env.WEMOPAY_RETURN_URL,
  },
  publicSiteUrl: publicSiteUrl(),
  mail: mailConfig(),
});
