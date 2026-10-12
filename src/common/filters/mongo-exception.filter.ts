import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { MongoServerError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';

/**
 * Ошибки базы, которые на самом деле ошибки запроса, — в 4xx, а не в 500.
 *
 * - дубль уникального ключа → 409;
 * - кривой идентификатор в адресе (`/orders/not-an-id/status`) → 400. Раньше
 *   `findById` бросал CastError мимо фильтра, и любой такой запрос ронял
 *   бэкенд в 500 с трассой мангуста в логах.
 */
@Catch(MongoServerError, MongooseError.CastError)
export class MongoExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  catch(exception: MongoServerError | MongooseError.CastError, host: ArgumentsHost) {
    if (exception instanceof MongooseError.CastError) {
      return super.catch(new BadRequestException(`Invalid ${exception.path}`), host);
    }
    if (exception.code === 11000) {
      const field = Object.keys(exception.keyPattern ?? {})[0] ?? 'value';
      return super.catch(new ConflictException(`This ${field} is already taken`), host);
    }
    return super.catch(exception, host);
  }
}
