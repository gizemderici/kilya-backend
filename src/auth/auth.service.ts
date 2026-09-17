import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { UsersService } from '../users/users.service.js';
import type { AuthResponseDto } from './dto/auth-response.dto.js';
import type { GoogleLoginDto } from './dto/google-login.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { LogoutDto } from './dto/logout.dto.js';
import type { RefreshDto } from './dto/refresh.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { GoogleAuthService } from './google-auth.service.js';
import { TokenService } from './token.service.js';

/** Giriş hatalarında tek mesaj: hangi e-postaların kayıtlı olduğu sızmasın. */
const BAD_CREDENTIALS = 'E-posta veya parola hatalı';

@Injectable()
export class AuthService {
  /**
   * Kullanıcı bulunamadığında da argon2.verify çalıştırılır ki yanıt süresi
   * "kayıtlı e-posta + yanlış parola" durumuyla aynı olsun (zamanlama sızıntısı).
   */
  private readonly dummyHash = argon2.hash(randomBytes(16).toString('hex'));

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly google: GoogleAuthService,
  ) {}

  async register(
    { email, password }: RegisterDto,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    if (await this.users.findByEmail(email)) {
      throw new ConflictException('Bu e-posta zaten kayıtlı');
    }

    const user = await this.users.create({
      email,
      passwordHash: await argon2.hash(password),
    });

    return this.tokens.issueTokens(user, userAgent);
  }

  async login(
    { email, password }: LoginDto,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const user = await this.users.findByEmail(email);
    // Google ile açılmış hesabın parolası yoktur; o da "hatalı" sayılır.
    const hash = user?.passwordHash ?? (await this.dummyHash);

    const ok = await argon2.verify(hash, password);
    if (!ok || !user?.passwordHash) {
      throw new UnauthorizedException(BAD_CREDENTIALS);
    }

    return this.tokens.issueTokens(user, userAgent);
  }

  /**
   * Google ID token'ı ile giriş. Kullanıcı bulma sırası:
   * 1. googleId eşleşen kullanıcı → giriş
   * 2. e-posta doğrulanmışsa ve aynı e-postalı kullanıcı varsa → hesaba
   *    googleId bağlanır (önceden e-posta/parola ile kayıt olmuş olabilir)
   * 3. hiçbiri yoksa → yeni kullanıcı
   */
  async loginWithGoogle(
    { idToken }: GoogleLoginDto,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const profile = await this.google.verify(idToken);

    let user = await this.users.findByGoogleId(profile.googleId);

    if (!user && profile.emailVerified && profile.email) {
      const byEmail = await this.users.findByEmail(profile.email);
      if (byEmail) {
        user = await this.users.update(byEmail.id, {
          googleId: profile.googleId,
        });
      }
    }

    user ??= await this.users.create({
      googleId: profile.googleId,
      // Doğrulanmamış e-postayı hesaba bağlamıyoruz; başkasının adresi olabilir.
      email: profile.emailVerified ? profile.email : undefined,
      displayName: profile.name,
    });

    return this.tokens.issueTokens(user, userAgent);
  }

  /** Refresh token ile yeni token çifti alır (rotation). */
  refresh({ refreshToken }: RefreshDto, userAgent?: string) {
    return this.tokens.rotate(refreshToken, userAgent);
  }

  /** Cihazdaki refresh token'ı iptal eder; access token süresi dolunca biter. */
  logout({ refreshToken }: LogoutDto): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }
}
