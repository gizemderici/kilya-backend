import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Boşlukları kırpıp küçük harfe çevirir; e-posta karşılaştırmaları tutarlı olsun. */
export const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  /** @example gizem@example.com */
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email!: string;

  /**
   * En az 8 karakter.
   * @example Gizli-Parola-123
   */
  @IsString()
  @MinLength(8, { message: 'Parola en az 8 karakter olmalı' })
  @MaxLength(128, { message: 'Parola en fazla 128 karakter olabilir' })
  password!: string;
}
