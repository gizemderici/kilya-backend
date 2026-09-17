import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from '../common/guards/index.js';
import type { Env } from '../config/env.js';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto.js';

/** Refresh token veritabanında düz metin değil, SHA-256 özeti olarak saklanır. */
export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

const INVALID_SESSION = 'Oturum geçersiz, lütfen yeniden giriş yapın';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    const days = config.get('JWT_REFRESH_TTL_DAYS', { infer: true });
    this.refreshTtlMs = days * 24 * 60 * 60 * 1000;
  }

  /** Access + refresh token çifti üretir; refresh token'ın hash'ini kaydeder. */
  async issueTokens(user: User, userAgent?: string): Promise<AuthResponseDto> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      anon: user.isAnonymous,
    };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
        userAgent: userAgent?.slice(0, 255),
      },
    });

    return { accessToken, refreshToken, user: AuthUserDto.from(user) };
  }

  /**
   * Refresh token rotation: eskisini iptal eder, yeni çift verir.
   *
   * İptal edilmiş bir token tekrar gelirse token çalınmış olabilir (saldırgan
   * ya da gerçek kullanıcı eski kopyayı kullanıyor). Hangisi olduğunu bilemeyiz;
   * güvenli taraf kullanıcının tüm oturumlarını kapatmaktır.
   */
  async rotate(refreshToken: string, userAgent?: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!stored || stored.user.deletedAt) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    if (stored.revokedAt) {
      await this.onReuseDetected(stored.userId);
      throw new UnauthorizedException(INVALID_SESSION);
    }

    if (stored.expiresAt <= new Date()) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    // Atomik iptal: aynı token iki isteğe aynı anda gelirse yalnızca biri
    // kazanır; kaybeden "zaten iptal edilmiş" muamelesi görür.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      await this.onReuseDetected(stored.userId);
      throw new UnauthorizedException(INVALID_SESSION);
    }

    return this.issueTokens(stored.user, userAgent);
  }

  /**
   * Çıkış: verilen refresh token'ı siler. "İptal edildi" diye işaretlemiyoruz;
   * uygulama çıkıştan sonra yanlışlıkla eski token'la gelirse bu çalıntı
   * şüphesi sayılıp diğer cihazlardaki oturumları kapatmasın.
   * Bilinmeyen token sessizce geçilir.
   */
  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { tokenHash: hashToken(refreshToken) },
    });
  }

  /** Kullanıcının tüm oturumlarını kapatır (parola değişikliği, çalıntı şüphesi). */
  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async onReuseDetected(userId: string) {
    this.logger.warn(
      `İptal edilmiş refresh token yeniden kullanıldı; kullanıcı ${userId} için tüm oturumlar kapatılıyor`,
    );
    await this.revokeAll(userId);
  }
}
