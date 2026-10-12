import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Пускает всех, но при валидном Bearer-токене заполняет `request.user`.
 *
 * Корзина обслуживает и гостя, и залогиненного одним и тем же эндпоинтом:
 * токен здесь опознаёт владельца, а его отсутствие — это гость, а не ошибка.
 * Маршруты помечены `@Public()`, чтобы глобальный `JwtAuthGuard` не отбил
 * запрос раньше, поэтому личность восстанавливается именно тут.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Просроченный или битый токен не должен ронять запрос — он просто
    // означает, что владельца установить не удалось.
    try {
      await super.canActivate(context);
    } catch {
      /* гость */
    }
    return true;
  }

  handleRequest<TUser>(_err: unknown, user: TUser): TUser | null {
    return user || null;
  }
}
