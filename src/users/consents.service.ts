import { Injectable, NotFoundException } from '@nestjs/common';
import type { ConsentType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ConsentResponseDto,
  type GrantConsentDto,
} from './dto/consents.dto.js';

/**
 * KVKK onayları. Kayıtlar silinmez: geri alınan onayın revokedAt'i dolar,
 * yeni sürüm onaylanınca yeni kayıt açılır. Böylece "hangi metni ne zaman
 * onayladı / geri aldı" geçmişi elde kalır.
 */
@Injectable()
export class ConsentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ConsentResponseDto[]> {
    const consents = await this.prisma.consent.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' },
    });
    return consents.map((c) => ConsentResponseDto.from(c));
  }

  /** Aynı tür + sürüm zaten aktifse tekrar kayıt açmaz (idempotent). */
  async grant(
    userId: string,
    { type, version }: GrantConsentDto,
  ): Promise<ConsentResponseDto> {
    const active = await this.findActive(userId, type);
    if (active?.version === version) {
      return ConsentResponseDto.from(active);
    }

    const [, created] = await this.prisma.$transaction([
      this.prisma.consent.updateMany({
        where: { userId, type, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.consent.create({ data: { userId, type, version } }),
    ]);
    return ConsentResponseDto.from(created);
  }

  async revoke(userId: string, type: ConsentType): Promise<void> {
    const { count } = await this.prisma.consent.updateMany({
      where: { userId, type, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      throw new NotFoundException('Bu tür için aktif bir onay yok');
    }
  }

  async hasActive(userId: string, type: ConsentType): Promise<boolean> {
    return (await this.findActive(userId, type)) !== null;
  }

  private findActive(userId: string, type: ConsentType) {
    return this.prisma.consent.findFirst({
      where: { userId, type, revokedAt: null },
    });
  }
}
