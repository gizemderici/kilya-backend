import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { normalizeEmail } from './register.dto.js';

export class ForgotPasswordDto {
  /** @example gizem@example.com */
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email!: string;
}
