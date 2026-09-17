import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normalizeEmail } from './register.dto.js';

export class LoginDto {
  /** @example gizem@example.com */
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email!: string;

  /** @example Gizli-Parola-123 */
  @IsString()
  @IsNotEmpty({ message: 'Parola boş olamaz' })
  @MaxLength(128)
  password!: string;
}
