import {
  type ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimit, SkipRateLimit } from './rate-limit.decorator.js';
import { RateLimitGuard } from './rate-limit.guard.js';

class TestController {
  @RateLimit({ limit: 2, ttlMs: 60_000 })
  strict() {}

  default() {}

  @SkipRateLimit()
  skipped() {}
}

function contextFor(handler: keyof TestController, ip = '1.1.1.1') {
  const headers: Record<string, unknown> = {};
  const context = {
    getHandler: () => TestController.prototype[handler],
    getClass: () => TestController,
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
      getResponse: () => ({
        setHeader: (name: string, value: unknown) => {
          headers[name] = value;
        },
      }),
    }),
  } as unknown as ExecutionContext;
  return { context, headers };
}

function expect429(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    return;
  }
  throw new Error('429 bekleniyordu');
}

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;

  beforeEach(() => {
    vi.useFakeTimers();
    guard = new RateLimitGuard(new Reflector());
  });

  afterEach(() => {
    guard.onModuleDestroy();
    vi.useRealTimers();
  });

  it('sınır aşılınca 429 ve Retry-After döner', () => {
    const { context, headers } = contextFor('strict');

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(headers['X-RateLimit-Remaining']).toBe(0);
    expect429(() => guard.canActivate(context));
    expect(headers['Retry-After']).toBe(60);
  });

  it('pencere dolunca sayaç sıfırlanır', () => {
    const { context } = contextFor('strict');
    guard.canActivate(context);
    guard.canActivate(context);
    expect429(() => guard.canActivate(context));

    vi.advanceTimersByTime(60_000);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('farklı IP adresleri birbirini etkilemez', () => {
    guard.canActivate(contextFor('strict', '1.1.1.1').context);
    guard.canActivate(contextFor('strict', '1.1.1.1').context);

    expect(guard.canActivate(contextFor('strict', '2.2.2.2').context)).toBe(
      true,
    );
  });

  it('decorator yoksa varsayılan sınır (100) uygulanır', () => {
    const { context, headers } = contextFor('default');
    for (let i = 0; i < 100; i++) guard.canActivate(context);
    expect(headers['X-RateLimit-Limit']).toBe(100);
    expect429(() => guard.canActivate(context));
  });

  it('@SkipRateLimit sınırı tamamen atlar', () => {
    const { context, headers } = contextFor('skipped');
    for (let i = 0; i < 150; i++) {
      expect(guard.canActivate(context)).toBe(true);
    }
    expect(headers).toEqual({});
  });
});
