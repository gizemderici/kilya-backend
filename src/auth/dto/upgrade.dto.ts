import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { normalizeEmail } from './register.dto.js';

/**
 * Anonim hesabı kalıcı yapar. İki yoldan biri gönderilir:
 * - `email` + `password`
 * - `idToken` (Google)
 */
export class UpgradeDto {
  /** @example gizem@example.com */
  @ValidateIf((o: UpgradeDto) => !o.idToken || o.email !== undefined)
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email?: string;

  /** @example Gizli-Parola-123 */
  @ValidateIf((o: UpgradeDto) => !o.idToken || o.password !== undefined)
  @IsString()
  @MinLength(8, { message: 'Parola en az 8 karakter olmalı' })
  @MaxLength(128, { message: 'Parola en fazla 128 karakter olabilir' })
  password?: string;

  /** Google ID token; e-posta/parola yerine. */
  @ValidateIf(
    (o: UpgradeDto) => o.email === undefined && o.password === undefined,
  )
  @IsString()
  @MinLength(20)
  idToken?: string;
}
