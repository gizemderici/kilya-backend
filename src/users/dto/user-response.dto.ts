import type { User } from '../../generated/prisma/client.js';

/** Profil yanıtı. passwordHash, googleId gibi alanlar asla dışarı çıkmaz. */
export class UserResponseDto {
  id!: string;
  /** Anonim kullanıcıda null. */
  email!: string | null;
  isAnonymous!: boolean;
  displayName!: string | null;
  /** @example 1998 */
  birthYear!: number | null;
  /** @example 170 */
  heightCm!: number | null;
  /** @example 65 */
  weightKg!: number | null;
  /** IANA saat dilimi. @example Europe/Istanbul */
  timezone!: string;
  /** E-posta/parola ile giriş yapılabiliyor mu (Google-only hesapta false). */
  hasPassword!: boolean;
  /** Hesaba Google bağlı mı. */
  hasGoogle!: boolean;
  createdAt!: Date;

  static from(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      isAnonymous: user.isAnonymous,
      displayName: user.displayName,
      birthYear: user.birthYear,
      heightCm: user.heightCm,
      weightKg: user.weightKg,
      timezone: user.timezone,
      hasPassword: user.passwordHash !== null,
      hasGoogle: user.googleId !== null,
      createdAt: user.createdAt,
    };
  }
}
