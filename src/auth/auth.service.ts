import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import type { Prisma } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import type { AuthResponseDto } from './dto/auth-response.dto.js';
import type { GoogleLoginDto } from './dto/google-login.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { LogoutDto } from './dto/logout.dto.js';
import type { RefreshDto } from './dto/refresh.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { UpgradeDto } from './dto/upgrade.dto.js';
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

  /**
   * Hesapsız kullanım: e-postasız, parolasız bir kullanıcı açar.
   * Not (Aşama 12): 90 gün hiç veri göndermemiş anonim hesapları silen
   * zamanlanmış görev eklenecek.
   */
  async createAnonymous(userAgent?: string): Promise<AuthResponseDto> {
    const user = await this.users.create({ isAnonymous: true });
    return this.tokens.issueTokens(user, userAgent);
  }

  /**
   * Anonim hesabı kalıcı yapar: aynı kullanıcı kaydına e-posta/parola ya da
   * Google kimliği eklenir; böylece önceki duruş verileri aynı userId'de kalır.
   */
  async upgrade(
    userId: string,
    dto: UpgradeDto,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Kullanıcı bulunamadı');
    if (!user.isAnonymous) {
      throw new BadRequestException('Bu hesap zaten kalıcı');
    }

    const data: Prisma.UserUpdateInput = { isAnonymous: false };

    if (dto.idToken) {
      const profile = await this.google.verify(dto.idToken);
      if (await this.users.findByGoogleId(profile.googleId)) {
        throw new ConflictException(
          'Bu Google hesabı başka bir kullanıcıya bağlı',
        );
      }
      if (profile.emailVerified && profile.email) {
        if (await this.users.findByEmail(profile.email)) {
          throw new ConflictException('Bu e-posta zaten kayıtlı');
        }
        data.email = profile.email;
      }
      data.googleId = profile.googleId;
      data.displayName ??= profile.name;
    } else if (dto.email && dto.password) {
      if (await this.users.findByEmail(dto.email)) {
        throw new ConflictException('Bu e-posta zaten kayıtlı');
      }
      data.email = dto.email;
      data.passwordHash = await argon2.hash(dto.password);
    } else {
      throw new BadRequestException(
        'E-posta ve parola ya da Google idToken gönderilmeli',
      );
    }

    const upgraded = await this.users.update(user.id, data);
    // Access token'daki "anon" bilgisi değişti; yeni çift verilir.
    return this.tokens.issueTokens(upgraded, userAgent);
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
