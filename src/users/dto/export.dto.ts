import { ConsentResponseDto } from './consents.dto.js';
import { GoalResponseDto } from './goals.dto.js';
import { UserResponseDto } from './user-response.dto.js';

export class ExportedSessionDto {
  userAgent!: string | null;
  createdAt!: Date;
  expiresAt!: Date;
  revokedAt!: Date | null;
}

/**
 * Kullanıcının tüm verisi (KVKK veri taşınabilirliği). Yeni modüller
 * (cihaz, duruş, istatistik) geldikçe buraya alan eklenir.
 */
export class UserExportDto {
  /** Biçim sürümü; alanlar değişince artırılır. @example kilya-export/1 */
  format!: string;
  exportedAt!: Date;
  profile!: UserResponseDto;
  goals!: GoalResponseDto[];
  consents!: ConsentResponseDto[];
  /** Oturumlar; token değerleri ya da hash'leri dahil değildir. */
  sessions!: ExportedSessionDto[];
}
