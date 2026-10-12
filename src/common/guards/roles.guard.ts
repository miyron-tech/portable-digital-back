import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/users.service';

/**
 * Проверка `@Roles(...)`. Подключён глобально в AppModule сразу после
 * JwtAuthGuard, поэтому действует на любой маршрут с `@Roles` — забыть
 * `@UseGuards` на контроллере больше нельзя. Раньше так и вышло с заявками:
 * `@Roles(ADMIN)` стоял, а проверки не было, и список заявок с файлами отдавался
 * любому вошедшему; снаружи спасало лишь то, что BFF не проксировал `leads`.
 *
 * Роль берётся из базы, а не из токена: разжалованный или удалённый админ
 * теряет доступ сразу, а не когда истечёт access-токен.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    const current = user?.sub ? await this.users.findById(user.sub) : null;
    if (!current || !required.includes(current.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
