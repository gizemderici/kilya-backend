import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConsentsService } from './consents.service.js';
import { UserExportDto } from './dto/export.dto.js';
import { GoalsService } from './goals.service.js';
import { UsersService } from './users.service.js';

/** Hesabın bütünüyle ilgili işlemler: dışa aktarma ve silme. */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly goals: GoalsService,
    private readonly consents: ConsentsService,
  ) {}

  async exportData(userId: string): Promise<UserExportDto> {
    const [profile, goals, consents, sessions] = await Promise.all([
      this.users.getProfile(userId),
      this.goals.list(userId),
      this.consents.list(userId),
      this.prisma.refreshToken.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          userAgent: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      }),
    ]);

    return {
      format: 'kilya-export/1',
      exportedAt: new Date(),
      profile,
      goals,
      consents,
      sessions,
    };
  }

  /**
   * Hesabı ve tüm verilerini kalıcı olarak siler. İlişkili tablolar
   * `onDelete: Cascade` ile temizlenir; tek sorgu yeter.
   */
  async deleteAccount(userId: string): Promise<void> {
    const { count } = await this.prisma.user.deleteMany({
      where: { id: userId },
    });
    if (count === 0) {
      throw new UnauthorizedException('Kullanıcı bulunamadı');
    }
    this.logger.log(`Hesap silindi: ${userId}`);
  }
}
