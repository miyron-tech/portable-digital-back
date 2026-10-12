import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailOutbox, MailOutboxSchema } from './mail-outbox.schema';
import { MailService } from './mail.service';
import { MailTransport } from './mail.transport';
import { MailWorker } from './mail.worker';

/**
 * Транзакционная почта. Модуль-лист: не импортирует ни заказы, ни платежи —
 * они импортируют его. Иначе получился бы цикл модулей, а шаблоны всё равно
 * получают готовые данные аргументами.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: MailOutbox.name, schema: MailOutboxSchema }])],
  providers: [MailService, MailTransport, MailWorker],
  exports: [MailService],
})
export class MailModule {}
