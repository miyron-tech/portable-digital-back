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
});
