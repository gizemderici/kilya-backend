import { createHash, randomInt } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import argon2 from 'argon2';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import { TokenService } from './token.service.js';

export const RESET_CODE_TTL_MINUTES = 15;

/**
 * Kod 6 haneli olduğu için iki kullanıcıya aynı kod düşebilir; tokenHash
 * sütunu benzersiz olduğundan hash'e kullanıcı id'si de katılır. Bu aynı
 * zamanda kodun yalnızca kendi kullanıcısı için geçerli olmasını sağlar.
 */
export const hashResetCode = (userId: string, code: string) =>
  createHash('sha256').update(`${userId}:${code}`).digest('hex');

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Kod üretip e-postayla gönderir. Kullanıcı olsun olmasın aynı şekilde döner;
   * hangi e-postaların kayıtlı olduğu sızmasın.
   */
  async requestReset({ email }: ForgotPasswordDto): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      this.logger.debug(
        'Parola sıfırlama: kayıtlı olmayan e-posta, sessizce geçildi',
      );
      return;
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

    await this.prisma.$transaction([
      // Önceki kullanılmamış kodlar geçersiz olsun; her zaman tek aktif kod.
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetCode(user.id, code),
          expiresAt: new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60_000),
        },
      }),
    ]);

    await this.mail.sendPasswordResetCode(email, code, RESET_CODE_TTL_MINUTES);
  }

  /** Kodu doğrular, parolayı değiştirir, kodu kullanılmış işaretler, tüm oturumları kapatır. */
  async resetPassword({
    email,
    code,
    newPassword,
  }: ResetPasswordDto): Promise<void> {
    const user = await this.users.findByEmail(email);
    const token = user
      ? await this.prisma.passwordResetToken.findFirst({
          where: {
            userId: user.id,
            tokenHash: hashResetCode(user.id, code),
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
        })
      : null;

    if (!user || !token) {
      throw new BadRequestException('Kod geçersiz ya da süresi dolmuş');
    }

    const passwordHash = await argon2.hash(newPassword);

    // Kod tek kullanımlık: aynı anda iki istek gelirse yalnızca biri kazanır.
    const { count } = await this.prisma.passwordResetToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) {
      throw new BadRequestException('Kod geçersiz ya da süresi dolmuş');
    }

    await this.users.update(user.id, { passwordHash });
    // Parola değişti: çalınmış olabilecek tüm oturumlar kapansın.
    await this.tokens.revokeAll(user.id);
  }
}
