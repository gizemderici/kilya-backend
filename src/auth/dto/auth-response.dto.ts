import type { User } from '../../generated/prisma/client.js';

export class AuthUserDto {
  /** @example 5f7d4c2e-1b3a-4d8e-9f0a-2c3b4d5e6f70 */
  id!: string;
  /** Anonim kullanıcıda null. @example gizem@example.com */
  email!: string | null;
  isAnonymous!: boolean;

  static from(user: User): AuthUserDto {
    return { id: user.id, email: user.email, isAnonymous: user.isAnonymous };
  }
}

export class AuthResponseDto {
  /** 15 dakika geçerli JWT; "Authorization: Bearer ..." başlığında gönderilir. */
  accessToken!: string;
  /** 30 gün geçerli, tek kullanımlık; /auth/refresh ile yenisi alınır. */
  refreshToken!: string;
  user!: AuthUserDto;
}
