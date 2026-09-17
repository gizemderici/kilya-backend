import { ConflictException, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import type { User } from '../generated/prisma/client.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import type { TokenService } from './token.service.js';
import { fakeUser } from './token.service.spec.js';

function setup() {
  const users = {
    findByEmail: vi.fn<() => Promise<User | null>>(async () => null),
    create: vi.fn(async (data) => fakeUser({ id: 'new-user', ...data })),
  };
  const tokens = {
    issueTokens: vi.fn(async (user) => ({
      accessToken: 'at',
      refreshToken: 'rt',
      user: { id: user.id, email: user.email, isAnonymous: user.isAnonymous },
    })),
    rotate: vi.fn(),
    revoke: vi.fn(async () => undefined),
  };
  const service = new AuthService(
    users as unknown as UsersService,
    tokens as unknown as TokenService,
  );
  return { service, users, tokens };
}

describe('AuthService', () => {
  describe('register', () => {
    it("parolayı argon2 ile hash'ler ve token döner", async () => {
      const { service, users, tokens } = setup();
      const res = await service.register(
        { email: 'a@b.com', password: 'Gizli-Parola-123' },
        'ua',
      );

      const created = users.create.mock.calls[0][0];
      expect(created.email).toBe('a@b.com');
      expect(created.passwordHash).not.toBe('Gizli-Parola-123');
      await expect(
        argon2.verify(created.passwordHash, 'Gizli-Parola-123'),
      ).resolves.toBe(true);

      expect(tokens.issueTokens).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-user' }),
        'ua',
      );
      expect(res).toMatchObject({ accessToken: 'at', refreshToken: 'rt' });
    });

    it('e-posta kayıtlıysa 409 fırlatır ve kullanıcı oluşturmaz', async () => {
      const { service, users } = setup();
      users.findByEmail.mockResolvedValueOnce(fakeUser());

      await expect(
        service.register({ email: 'a@b.com', password: 'Gizli-Parola-123' }),
      ).rejects.toThrow(ConflictException);
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const password = 'Gizli-Parola-123';
    let passwordHash: string;
    beforeAll(async () => {
      passwordHash = await argon2.hash(password);
    });

    it('doğru parola ile token döner', async () => {
      const { service, users, tokens } = setup();
      users.findByEmail.mockResolvedValueOnce(fakeUser({ passwordHash }));

      const res = await service.login({ email: 'a@b.com', password }, 'ua');

      expect(tokens.issueTokens).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' }),
        'ua',
      );
      expect(res.accessToken).toBe('at');
    });

    it('yanlış parola, kayıtsız e-posta ve parolasız (Google) hesap aynı hatayı verir', async () => {
      const { service, users, tokens } = setup();
      const attempt = () =>
        service.login({ email: 'a@b.com', password: 'yanlis-parola' });

      users.findByEmail.mockResolvedValueOnce(fakeUser({ passwordHash }));
      const wrongPassword = await attempt().catch((e: Error) => e);

      users.findByEmail.mockResolvedValueOnce(null);
      const unknownEmail = await attempt().catch((e: Error) => e);

      users.findByEmail.mockResolvedValueOnce(
        fakeUser({ passwordHash: null, googleId: 'g-1' }),
      );
      const googleOnly = await attempt().catch((e: Error) => e);

      for (const err of [wrongPassword, unknownEmail, googleOnly]) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect((err as Error).message).toBe('E-posta veya parola hatalı');
      }
      expect(tokens.issueTokens).not.toHaveBeenCalled();
    });
  });

  it('logout verilen refresh tokenı iptal eder', async () => {
    const { service, tokens } = setup();
    await service.logout({ refreshToken: 'rt-123' });
    expect(tokens.revoke).toHaveBeenCalledWith('rt-123');
  });
});
