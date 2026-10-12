import { plainToInstance } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsOptional()
  @IsNumberString()
  PORT?: string;

  @IsString()
  @IsNotEmpty()
  MONGODB_URI!: string;

  @IsString()
  @MinLength(16, { message: 'JWT_ACCESS_SECRET must be at least 16 characters' })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(16, { message: 'JWT_REFRESH_SECRET must be at least 16 characters' })
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_TTL?: string;

  @IsOptional()
  @IsString()
  FRONTEND_ORIGIN?: string;

  // Платёжка необязательна для запуска: без ключей витрина работает, а оплата
  // отвечает 503. Так локальная разработка не требует боевых секретов.
  @IsOptional()
  @IsString()
  WEMOPAY_BASE_URL?: string;

  @IsOptional()
  @IsString()
  WEMOPAY_API_KEY?: string;

  // Длину не проверяем: боевой ключ WemoPay — 12 символов, и прежнее
  // «не короче 16» уронило бы бэкенд на старте с настоящим ключом.
  @IsOptional()
  @IsString()
  WEMOPAY_SIGNING_KEY?: string;

  @IsOptional()
  @IsString()
  WEMOPAY_WEBHOOK_URL?: string;

  @IsOptional()
  @IsString()
  WEMOPAY_RETURN_URL?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  // Пустая строка в окружении означает «не задано», но `@IsOptional()`
  // пропускает только `undefined` и `null`. Без этой нормализации
  // `WEMOPAY_SIGNING_KEY=` в .env валился на проверке длины и ронял запуск —
  // ровно та же ловушка, что и с пустым полем multipart-формы в заявках.
  const normalised = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, value === '' ? undefined : value]),
  );

  const validated = plainToInstance(EnvironmentVariables, normalised, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors
        .map((e) => `  - ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }
  return config;
}
