import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import type { User } from '../generated/prisma/client.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import type {
  GoogleAuthService,
  GoogleProfile,
} from './google-auth.service.js';
import type { TokenService } from './token.service.js';
import { fakeUser } from './token.service.spec.js';

function setup() {
  const users = {
    findById: vi.fn<() => Promise<User | null>>(async () =>
      fakeUser({ id: 'anon-1', email: null, isAnonymous: true }),
    ),
    findByEmail: vi.fn<() => Promise<User | null>>(async () => null),
    findByGoogleId: vi.fn<() => Promise<User | null>>(async () => null),
    create: vi.fn(async (data) => fakeUser({ id: 'new-user', ...data })),
    update: vi.fn(async (id, data) => fakeUser({ id, ...data })),
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
  const google = {
    verify: vi.fn<() => Promise<GoogleProfile>>(async () => ({
      googleId: 'g-123',
      email: 'g@gmail.com',
      emailVerified: true,
      name: 'Gizem',
    })),
  };
  const service = new AuthService(
    users as unknown as UsersService,
    tokens as unknown as TokenService,
    google as unknown as GoogleAuthService,
  );
  return { service, users, tokens, google };
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

  describe('loginWithGoogle', () => {
    const dto = { idToken: 'google-id-token-xxxxxxxxxx' };

    it('googleId eşleşen kullanıcıyla giriş yapar', async () => {
      const { service, users, tokens } = setup();
      users.findByGoogleId.mockResolvedValueOnce(
        fakeUser({ id: 'g-user', googleId: 'g-123' }),
      );

      await service.loginWithGoogle(dto, 'ua');

      expect(users.create).not.toHaveBeenCalled();
      expect(users.update).not.toHaveBeenCalled();
      expect(tokens.issueTokens).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'g-user' }),
        'ua',
      );
    });

    it('aynı e-postalı hesap varsa googleId bağlar', async () => {
      const { service, users } = setup();
      users.findByEmail.mockResolvedValueOnce(
        fakeUser({ id: 'email-user', email: 'g@gmail.com' }),
      );

      await service.loginWithGoogle(dto);

      expect(users.update).toHaveBeenCalledWith('email-user', {
        googleId: 'g-123',
      });
      expect(users.create).not.toHaveBeenCalled();
    });

    it('e-posta doğrulanmamışsa mevcut hesaba bağlamaz, e-postasız yeni hesap açar', async () => {
      const { service, users, google } = setup();
      google.verify.mockResolvedValueOnce({
        googleId: 'g-123',
        email: 'g@gmail.com',
        emailVerified: false,
      });

      await service.loginWithGoogle(dto);

      expect(users.findByEmail).not.toHaveBeenCalled();
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ googleId: 'g-123', email: undefined }),
      );
    });

    it('hiç hesap yoksa yeni kullanıcı oluşturur', async () => {
      const { service, users } = setup();

      await service.loginWithGoogle(dto);

      expect(users.create).toHaveBeenCalledWith({
        googleId: 'g-123',
        email: 'g@gmail.com',
        displayName: 'Gizem',
      });
    });

    it('token doğrulanamazsa hata geçer, kullanıcı oluşturulmaz', async () => {
      const { service, users, google } = setup();
      google.verify.mockRejectedValueOnce(new UnauthorizedException());

      await expect(service.loginWithGoogle(dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  it('createAnonymous isAnonymous=true kullanıcı açar', async () => {
    const { service, users, tokens } = setup();
    await service.createAnonymous('ua');
    expect(users.create).toHaveBeenCalledWith({ isAnonymous: true });
    expect(tokens.issueTokens).toHaveBeenCalledWith(
      expect.objectContaining({ isAnonymous: true }),
      'ua',
    );
  });

  describe('upgrade', () => {
    it('e-posta/parola ile aynı kaydı günceller, yeni token verir', async () => {
      const { service, users, tokens } = setup();

      await service.upgrade(
        'anon-1',
        { email: 'a@b.com', password: 'Gizli-Parola-123' },
        'ua',
      );

      const [id, data] = users.update.mock.calls[0];
      expect(id).toBe('anon-1');
      expect(data.email).toBe('a@b.com');
      expect(data.isAnonymous).toBe(false);
      await expect(
        argon2.verify(data.passwordHash, 'Gizli-Parola-123'),
      ).resolves.toBe(true);
      expect(users.create).not.toHaveBeenCalled();
      expect(tokens.issueTokens).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'anon-1', isAnonymous: false }),
        'ua',
      );
    });

    it('Google ile aynı kaydı günceller', async () => {
      const { service, users } = setup();
      await service.upgrade('anon-1', {
        idToken: 'google-id-token-xxxxxxxxxx',
      });
      expect(users.update).toHaveBeenCalledWith('anon-1', {
        isAnonymous: false,
        googleId: 'g-123',
        email: 'g@gmail.com',
        displayName: 'Gizem',
      });
    });

    it('e-posta başka hesaptaysa 409', async () => {
      const { service, users } = setup();
      users.findByEmail.mockResolvedValueOnce(fakeUser({ id: 'other' }));
      await expect(
        service.upgrade('anon-1', {
          email: 'a@b.com',
          password: 'Gizli-Parola-123',
        }),
      ).rejects.toThrow(ConflictException);
      expect(users.update).not.toHaveBeenCalled();
    });

    it('Google hesabı başka kullanıcıya bağlıysa 409', async () => {
      const { service, users } = setup();
      users.findByGoogleId.mockResolvedValueOnce(fakeUser({ id: 'other' }));
      await expect(
        service.upgrade('anon-1', { idToken: 'google-id-token-xxxxxxxxxx' }),
      ).rejects.toThrow(ConflictException);
      expect(users.update).not.toHaveBeenCalled();
    });

    it('hesap zaten kalıcıysa 400', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValueOnce(fakeUser({ isAnonymous: false }));
      await expect(
        service.upgrade('user-1', {
          email: 'a@b.com',
          password: 'Gizli-Parola-123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  it('logout verilen refresh tokenı iptal eder', async () => {
    const { service, tokens } = setup();
    await service.logout({ refreshToken: 'rt-123' });
    expect(tokens.revoke).toHaveBeenCalledWith('rt-123');
  });
});
