import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import type { User } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { hashToken, TokenService } from './token.service.js';

const SECRET = 'test-secret-en-az-otuz-iki-karakter-uzun';

export const fakeUser = (over: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'a@b.com',
  passwordHash: null,
  googleId: null,
  isAnonymous: false,
  displayName: null,
  birthYear: null,
  heightCm: null,
  weightKg: null,
  timezone: 'Europe/Istanbul',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...over,
});

function setup() {
  const prisma = {
    refreshToken: {
      create: vi.fn(async ({ data }) => data),
      findUnique: vi.fn<() => Promise<unknown>>(async () => null),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { expiresIn: '15m' },
  });
  const config = { get: vi.fn(() => 30) } as unknown as ConfigService<
    Env,
    true
  >;
  const service = new TokenService(
    prisma as unknown as PrismaService,
    jwt,
    config,
  );
  return { service, prisma, jwt };
}

describe('TokenService', () => {
  describe('issueTokens', () => {
    it('access token kullanıcı id ve anonimlik bilgisini taşır', async () => {
      const { service, jwt } = setup();
      const { accessToken } = await service.issueTokens(
        fakeUser({ isAnonymous: true }),
      );
      expect(jwt.verify(accessToken)).toMatchObject({
        sub: 'user-1',
        anon: true,
      });
    });

    it('refresh token düz değil, SHA-256 hash olarak kaydedilir', async () => {
      const { service, prisma } = setup();
      const { refreshToken } = await service.issueTokens(fakeUser(), 'ua');
      const saved = prisma.refreshToken.create.mock.calls[0][0].data;

      expect(refreshToken).toHaveLength(43); // 32 bayt base64url
      expect(saved.tokenHash).toBe(hashToken(refreshToken));
      expect(saved.tokenHash).not.toBe(refreshToken);
      expect(saved.userAgent).toBe('ua');
    });

    it('refresh token 30 gün sonra sona erer', async () => {
      const { service, prisma } = setup();
      await service.issueTokens(fakeUser());
      const { expiresAt } = prisma.refreshToken.create.mock.calls[0][0].data;
      const days = (expiresAt.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThanOrEqual(30);
    });

    it('yanıtta kullanıcının sadece güvenli alanları döner', async () => {
      const { service } = setup();
      const res = await service.issueTokens(
        fakeUser({ passwordHash: 'gizli' }),
      );
      expect(res.user).toEqual({
        id: 'user-1',
        email: 'a@b.com',
        isAnonymous: false,
      });
      expect(res.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('rotate', () => {
    const stored = (over: Record<string, unknown> = {}) => ({
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: hashToken('eski-token'),
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      user: fakeUser(),
      ...over,
    });

    it('geçerli token: eskisini iptal eder, yeni çift döner', async () => {
      const { service, prisma } = setup();
      prisma.refreshToken.findUnique.mockResolvedValueOnce(stored());

      const res = await service.rotate('eski-token', 'ua');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'rt-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(res.refreshToken).not.toBe('eski-token');
      expect(res.user.id).toBe('user-1');
    });

    it('bilinmeyen token 401', async () => {
      const { service, prisma } = setup();
      await expect(service.rotate('yok')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('süresi dolmuş token 401', async () => {
      const { service, prisma } = setup();
      prisma.refreshToken.findUnique.mockResolvedValueOnce(
        stored({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.rotate('eski-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('silinmiş kullanıcının tokenı 401', async () => {
      const { service, prisma } = setup();
      prisma.refreshToken.findUnique.mockResolvedValueOnce(
        stored({ user: fakeUser({ deletedAt: new Date() }) }),
      );
      await expect(service.rotate('eski-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('iptal edilmiş token yeniden gelirse tüm oturumlar kapatılır', async () => {
      const { service, prisma } = setup();
      prisma.refreshToken.findUnique.mockResolvedValueOnce(
        stored({ revokedAt: new Date() }),
      );

      await expect(service.rotate('eski-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('eşzamanlı iki istek: kaybeden taraf tüm oturumları kapatır', async () => {
      const { service, prisma } = setup();
      prisma.refreshToken.findUnique.mockResolvedValueOnce(stored());
      prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.rotate('eski-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenLastCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  it('revoke: yalnızca verilen tokenı iptal eder', async () => {
    const { service, prisma } = setup();
    await service.revoke('tok');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: hashToken('tok'), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
