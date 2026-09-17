import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/index.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const SECRET = 'test-secret-en-az-otuz-iki-karakter-uzun';

function contextFor(
  authorization?: string,
  metadata: Record<string, unknown> = {},
) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers: authorization ? { authorization } : {},
  };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const reflector = {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
  return { context, reflector, request };
}

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: SECRET });

  it('@Public() uç noktayı token olmadan geçirir', async () => {
    const { context, reflector } = contextFor(undefined, {
      [IS_PUBLIC_KEY]: true,
    });
    const guard = new JwtAuthGuard(reflector, jwt);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('token yoksa 401 fırlatır', async () => {
    const { context, reflector } = contextFor();
    const guard = new JwtAuthGuard(reflector, jwt);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('"Bearer" olmayan şema 401 fırlatır', async () => {
    const token = await jwt.signAsync({ sub: 'u1', anon: false });
    const { context, reflector } = contextFor(`Basic ${token}`);
    const guard = new JwtAuthGuard(reflector, jwt);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('imzası bozuk token 401 fırlatır', async () => {
    const other = new JwtService({
      secret: 'baska-bir-secret-otuz-iki-karakter+',
    });
    const token = await other.signAsync({ sub: 'u1', anon: false });
    const { context, reflector } = contextFor(`Bearer ${token}`);
    const guard = new JwtAuthGuard(reflector, jwt);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('süresi dolmuş token 401 fırlatır', async () => {
    const token = await jwt.signAsync(
      { sub: 'u1', anon: false },
      { expiresIn: -10 },
    );
    const { context, reflector } = contextFor(`Bearer ${token}`);
    const guard = new JwtAuthGuard(reflector, jwt);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('geçerli token ile request.user doldurulur', async () => {
    const token = await jwt.signAsync({ sub: 'u1', anon: true });
    const { context, reflector, request } = contextFor(`Bearer ${token}`);
    const guard = new JwtAuthGuard(reflector, jwt);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'u1', isAnonymous: true });
  });
});
