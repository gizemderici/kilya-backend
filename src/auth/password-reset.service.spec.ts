import { BadRequestException } from '@nestjs/common';
import argon2 from 'argon2';
import type { User } from '../generated/prisma/client.js';
import type { MailService } from '../mail/mail.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UsersService } from '../users/users.service.js';
import {
  hashResetCode,
  PasswordResetService,
} from './password-reset.service.js';
import type { TokenService } from './token.service.js';
import { fakeUser } from './token.service.spec.js';

function setup() {
  const prisma = {
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
    passwordResetToken: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async ({ data }) => data),
      findFirst: vi.fn<() => Promise<unknown>>(async () => null),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const users = {
    findByEmail: vi.fn<() => Promise<User | null>>(async () => null),
    update: vi.fn(async (id, data) => fakeUser({ id, ...data })),
  };
  const mail = {
    sendPasswordResetCode: vi.fn<
      (to: string, code: string, ttl: number) => Promise<void>
    >(async () => undefined),
  };
  const tokens = { revokeAll: vi.fn(async () => undefined) };
  const service = new PasswordResetService(
    prisma as unknown as PrismaService,
    users as unknown as UsersService,
    mail as unknown as MailService,
    tokens as unknown as TokenService,
  );
  return { service, prisma, users, mail, tokens };
}

describe('PasswordResetService', () => {
  describe('requestReset', () => {
    it('kayıtlı e-posta: 6 haneli kod üretir, hash kaydeder, e-posta gönderir', async () => {
      const { service, prisma, users, mail } = setup();
      users.findByEmail.mockResolvedValueOnce(fakeUser());

      await service.requestReset({ email: 'a@b.com' });

      const [to, code, ttl] = mail.sendPasswordResetCode.mock.calls[0];
      expect(to).toBe('a@b.com');
      expect(code).toMatch(/^\d{6}$/);
      expect(ttl).toBe(15);

      const saved = prisma.passwordResetToken.create.mock.calls[0][0].data;
      expect(saved.tokenHash).toBe(hashResetCode('user-1', code));
      expect(saved.tokenHash).not.toContain(code);
      expect(saved.expiresAt.getTime() - Date.now()).toBeGreaterThan(
        14 * 60_000,
      );

      // Eski kodlar silinir; tek aktif kod
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', usedAt: null },
      });
    });

    it('kayıtsız e-posta: hata vermez, e-posta göndermez', async () => {
      const { service, mail, prisma } = setup();
      await expect(
        service.requestReset({ email: 'yok@b.com' }),
      ).resolves.toBeUndefined();
      expect(mail.sendPasswordResetCode).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const dto = {
      email: 'a@b.com',
      code: '123456',
      newPassword: 'Yeni-Parola-456',
    };

    it('geçerli kod: parolayı değiştirir, kodu kullanılmış işaretler, oturumları kapatır', async () => {
      const { service, prisma, users, tokens } = setup();
      users.findByEmail.mockResolvedValueOnce(fakeUser());
      prisma.passwordResetToken.findFirst.mockResolvedValueOnce({
        id: 'prt-1',
      });

      await service.resetPassword(dto);

      expect(prisma.passwordResetToken.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          tokenHash: hashResetCode('user-1', '123456'),
          usedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
      });
      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'prt-1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      const [, data] = users.update.mock.calls[0];
      await expect(
        argon2.verify(data.passwordHash, 'Yeni-Parola-456'),
      ).resolves.toBe(true);
      expect(tokens.revokeAll).toHaveBeenCalledWith('user-1');
    });

    it('kod bulunamazsa 400, parola değişmez', async () => {
      const { service, users, tokens } = setup();
      users.findByEmail.mockResolvedValueOnce(fakeUser());

      await expect(service.resetPassword(dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(users.update).not.toHaveBeenCalled();
      expect(tokens.revokeAll).not.toHaveBeenCalled();
    });

    it('kayıtsız e-posta aynı 400 mesajını verir', async () => {
      const { service } = setup();
      const err = await service.resetPassword(dto).catch((e: Error) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as Error).message).toBe('Kod geçersiz ya da süresi dolmuş');
    });

    it('aynı kod eşzamanlı iki istekte yalnızca bir kez işe yarar', async () => {
      const { service, prisma, users } = setup();
      users.findByEmail.mockResolvedValueOnce(fakeUser());
      prisma.passwordResetToken.findFirst.mockResolvedValueOnce({
        id: 'prt-1',
      });
      prisma.passwordResetToken.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.resetPassword(dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(users.update).not.toHaveBeenCalled();
    });
  });

  it('hashResetCode kullanıcıya özeldir: aynı kod farklı kullanıcıda farklı hash', () => {
    expect(hashResetCode('u1', '123456')).not.toBe(
      hashResetCode('u2', '123456'),
    );
  });
});
