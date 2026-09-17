import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  /** @example Gizli-Parola-123 */
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  /** @example Yeni-Parola-456 */
  @IsString()
  @MinLength(8, { message: 'Parola en az 8 karakter olmalı' })
  @MaxLength(128, { message: 'Parola en fazla 128 karakter olabilir' })
  newPassword!: string;
}
