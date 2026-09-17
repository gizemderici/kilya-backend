import { Transform } from 'class-transformer';
import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import type { Consent } from '../../generated/prisma/client.js';
import { ConsentType } from '../../generated/prisma/enums.js';

export class GrantConsentDto {
  /** HEALTH_DATA: sağlık verisinin işlenmesi (KVKK) · RESEARCH_SHARING: anonim verinin araştırmada kullanılması */
  @IsEnum(ConsentType, {
    message: 'Onay türü HEALTH_DATA ya da RESEARCH_SHARING olmalı',
  })
  type!: ConsentType;

  /**
   * Kullanıcının onayladığı metnin sürümü (uygulamada gösterilen metinle eşleşir).
   * @example 2026-09
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'Sürüm yalnızca harf, rakam, nokta, tire ve alt çizgi içerebilir',
  })
  version!: string;
}

export class ConsentResponseDto {
  type!: ConsentType;
  version!: string;
  grantedAt!: Date;
  /** Geri alındıysa tarih, aksi hâlde null. */
  revokedAt!: Date | null;
  isActive!: boolean;

  static from(consent: Consent): ConsentResponseDto {
    return {
      type: consent.type,
      version: consent.version,
      grantedAt: consent.grantedAt,
      revokedAt: consent.revokedAt,
      isActive: consent.revokedAt === null,
    };
  }
}

export class ConsentsResponseDto {
  /** Tüm onay geçmişi, en yeni önce. */
  consents!: ConsentResponseDto[];
}
