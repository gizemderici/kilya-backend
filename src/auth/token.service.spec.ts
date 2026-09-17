import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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
    refreshToken: { create: vi.fn(async ({ data }) => data) },
  };
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { expiresIn: '15m' },
  });
  const config = { get: vi.fn(() => 30) } as unknown as ConfigService;
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
});
