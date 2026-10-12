import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as argon2 from 'argon2';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Service, ServiceDocument } from '../services/schemas/service.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { SERVICES_SEED } from './services.data';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Учётка админа из окружения. Запасные значения — только для разработки.
 *
 * На проде их нет намеренно: однажды сид запустили в контейнере, куда
 * `SEED_ADMIN_*` не пробросили, и он молча завёл на живом сайте админа
 * `admin@itvit.local` / `Admin12345`. Теперь без явных значений на проде
 * админ просто не создаётся — каталог при этом синхронизируется как обычно.
 */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? (IS_PRODUCTION ? undefined : 'admin@itvit.local');
const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD ?? (IS_PRODUCTION ? undefined : 'Admin12345');

async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const serviceModel = app.get<Model<ServiceDocument>>(getModelToken(Service.name));
  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

  for (const item of SERVICES_SEED) {
    await serviceModel.updateOne({ slug: item.slug }, { $set: item }, { upsert: true }).exec();
  }
  logger.log(`Services synchronised: ${SERVICES_SEED.length}`);

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    logger.warn('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — admin account skipped');
  } else {
    const existingAdmin = await userModel.findOne({ email: ADMIN_EMAIL }).exec();
    if (existingAdmin) {
      logger.log(`Admin already exists: ${ADMIN_EMAIL}`);
    } else {
      await userModel.create({
        email: ADMIN_EMAIL,
        name: 'Administrator',
        passwordHash: await argon2.hash(ADMIN_PASSWORD),
        role: UserRole.ADMIN,
      });
      // Пароль в лог не пишем: на проде этот лог уходит в docker logs и CI.
      logger.log(`Admin created: ${ADMIN_EMAIL}${IS_PRODUCTION ? '' : ` / ${ADMIN_PASSWORD}`}`);
    }
  }

  await app.close();
  process.exit(0);
}

seed().catch((error) => {
  new Logger('Seed').error(error);
  process.exit(1);
});
