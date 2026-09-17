import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { Env } from '../config/env.js';

/** Google ID token'ından bize gereken alanlar. */
export interface GoogleProfile {
  /** Google'ın kullanıcı için değişmez kimliği (`sub`). */
  googleId: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
}

/**
 * Android'in Credential Manager ile aldığı Google ID token'ını doğrular.
 *
 * `audience` mutlaka Web istemci ID'si olmalı: Android uygulaması token'ı
 * `serverClientId = GOOGLE_WEB_CLIENT_ID` ile ister, Google da token'ı bu
 * ID için imzalar. Android istemci ID'siyle doğrulama her zaman başarısız olur.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly clientId?: string;
  private readonly client = new OAuth2Client();

  constructor(config: ConfigService<Env, true>) {
    this.clientId = config.get('GOOGLE_WEB_CLIENT_ID', { infer: true });
    if (!this.clientId) {
      this.logger.warn(
        'GOOGLE_WEB_CLIENT_ID tanımlı değil; Google ile giriş kapalı',
      );
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.clientId);
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    if (!this.clientId) {
      throw new ServiceUnavailableException(
        'Google ile giriş bu sunucuda yapılandırılmamış',
      );
    }

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch (error) {
      // İmza, süre, audience ya da issuer hatası: ayrıntı istemciye gitmez.
      this.logger.debug(
        `Google ID token doğrulanamadı: ${(error as Error).message}`,
      );
      payload = undefined;
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Google kimliği doğrulanamadı');
    }

    return {
      googleId: payload.sub,
      email: payload.email?.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name,
    };
  }
}
