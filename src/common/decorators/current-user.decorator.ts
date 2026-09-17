import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** JwtAuthGuard'ın request.user içine koyduğu, token'dan çözülen kimlik. */
export interface AuthUser {
  id: string;
  isAnonymous: boolean;
}

/**
 * Controller'da giriş yapmış kullanıcıyı verir.
 * @example me(@CurrentUser() user: AuthUser) { ... }
 * @example me(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<Request>().user as AuthUser;
    return field ? user[field] : user;
  },
);
