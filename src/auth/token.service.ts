import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
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

@Injectable()
export class TokenService {
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
}
