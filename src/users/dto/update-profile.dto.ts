import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsIanaTimezone } from '../../common/validators/is-iana-timezone.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Tüm alanlar isteğe bağlı; yalnızca gönderilenler güncellenir. null göndermek alanı temizler. */
export class UpdateProfileDto {
  /** @example Gizem */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  displayName?: string | null;

  /** @example 1998 */
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  birthYear?: number | null;

  /** @example 170 */
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(250)
  heightCm?: number | null;

  /** @example 65 */
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(300)
  weightKg?: number | null;

  /** IANA saat dilimi; günlük istatistikler buna göre hesaplanır. @example Europe/Istanbul */
  @IsOptional()
  @IsIanaTimezone()
  timezone?: string;
}
