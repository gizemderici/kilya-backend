import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { GoogleAuthService } from './google-auth.service.js';

const configWith = (clientId?: string) =>
  ({ get: () => clientId }) as unknown as ConfigService<Env, true>;

describe('GoogleAuthService', () => {
  it("GOOGLE_WEB_CLIENT_ID yoksa 503 fırlatır, Google'a hiç gitmez", async () => {
    const service = new GoogleAuthService(configWith(undefined));
    expect(service.isConfigured).toBe(false);
    await expect(service.verify('herhangi-bir-token')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it("doğrulama hatasını 401'e çevirir, ayrıntı sızdırmaz", async () => {
    const service = new GoogleAuthService(configWith('web-client-id'));
    // Gerçek OAuth2Client'ı ağ olmadan denemek yerine mock'luyoruz.
    const client = (
      service as unknown as { client: { verifyIdToken: unknown } }
    ).client;
    client.verifyIdToken = vi.fn(async () => {
      throw new Error('Wrong recipient, payload audience != requiredAudience');
    });

    const err = await service.verify('bozuk').catch((e: Error) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect((err as Error).message).toBe('Google kimliği doğrulanamadı');
  });

  it("audience olarak Web istemci ID'sini kullanır ve profili sadeleştirir", async () => {
    const service = new GoogleAuthService(configWith('web-client-id'));
    const verifyIdToken = vi.fn(async () => ({
      getPayload: () => ({
        sub: '1234567890',
        email: 'Gizem@Gmail.com',
        email_verified: true,
        name: 'Gizem',
      }),
    }));
    (service as unknown as { client: { verifyIdToken: unknown } }).client = {
      verifyIdToken,
    };

    const profile = await service.verify('gecerli-token');

    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'gecerli-token',
      audience: 'web-client-id',
    });
    expect(profile).toEqual({
      googleId: '1234567890',
      email: 'gizem@gmail.com',
      emailVerified: true,
      name: 'Gizem',
    });
  });

  it("payload'da sub yoksa 401", async () => {
    const service = new GoogleAuthService(configWith('web-client-id'));
    (service as unknown as { client: { verifyIdToken: unknown } }).client = {
      verifyIdToken: vi.fn(async () => ({ getPayload: () => undefined })),
    };
    await expect(service.verify('token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
