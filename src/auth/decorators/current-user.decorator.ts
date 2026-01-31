import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtValidatedUser } from '../strategies/jwt.strategy';

/**
 * Inyecta el usuario autenticado (payload del JWT) en el handler.
 * Requiere JwtAuthGuard en la ruta.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtValidatedUser | undefined, ctx: ExecutionContext): JwtValidatedUser | string => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtValidatedUser }>();
    const user = request.user;

    if (data) {
      return user[data];
    }

    return user;
  },
);
