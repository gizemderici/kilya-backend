import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizeEmail } from './register.dto.js';

export class ResetPasswordDto {
  /** @example gizem@example.com */
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email!: string;

  /**
   * E-postayla gelen 6 haneli kod.
   * @example 482913
   */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Kod 6 haneli olmalı' })
  code!: string;

  /** @example Yeni-Parola-456 */
  @IsString()
  @MinLength(8, { message: 'Parola en az 8 karakter olmalı' })
  @MaxLength(128, { message: 'Parola en fazla 128 karakter olabilir' })
  newPassword!: string;
}
