import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { type AuthUser, IS_PUBLIC_KEY } from '../decorators/index.js';

/** Access token'ın içeriği. `sub` = kullanıcı id'si (JWT standardı). */
export interface AccessTokenPayload {
  sub: string;
  anon: boolean;
}

/**
 * Tüm uygulamaya APP_GUARD ile uygulanır: @Public() olmayan her uç nokta
 * geçerli bir "Authorization: Bearer <access token>" başlığı ister.
 * Doğrulanan kimlik request.user'a { id, isAnonymous } olarak yazılır.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Giriş yapmanız gerekiyor');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Oturum geçersiz ya da süresi dolmuş');
    }

    const user: AuthUser = { id: payload.sub, isAnonymous: payload.anon };
    request.user = user;
    return true;
  }
}

function extractBearerToken(request: Request): string | undefined {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  return scheme === 'Bearer' && token ? token : undefined;
}
