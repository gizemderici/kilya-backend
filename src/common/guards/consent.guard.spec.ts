import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { ConsentsService } from '../../users/consents.service.js';
import { REQUIRED_CONSENT_KEY } from '../decorators/index.js';
import { ConsentGuard } from './consent.guard.js';

function setup(required?: string, user?: { id: string }) {
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === REQUIRED_CONSENT_KEY ? required : undefined,
  } as unknown as Reflector;
  const consents = { hasActive: vi.fn(async () => false) };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  const guard = new ConsentGuard(
    reflector,
    consents as unknown as ConsentsService,
  );
  return { guard, consents, context };
}

describe('ConsentGuard', () => {
  it('decorator yoksa geçer, veritabanına bakmaz', async () => {
    const { guard, consents, context } = setup(undefined, { id: 'u1' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(consents.hasActive).not.toHaveBeenCalled();
  });

  it('aktif onay varsa geçer', async () => {
    const { guard, consents, context } = setup('HEALTH_DATA', { id: 'u1' });
    consents.hasActive.mockResolvedValueOnce(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(consents.hasActive).toHaveBeenCalledWith('u1', 'HEALTH_DATA');
  });

  it('onay yoksa 403 ve anlaşılır mesaj', async () => {
    const { guard, context } = setup('HEALTH_DATA', { id: 'u1' });
    const err = await guard.canActivate(context).catch((e: Error) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as Error).message).toContain('sağlık verisi işleme');
  });

  it('kullanıcı yoksa (JwtAuthGuard atlanmış) geçirmez', async () => {
    const { guard, context } = setup('HEALTH_DATA', undefined);
    await expect(guard.canActivate(context)).resolves.toBe(false);
  });
});
