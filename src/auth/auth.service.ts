import { ConflictException, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { UsersService } from '../users/users.service.js';
import type { AuthResponseDto } from './dto/auth-response.dto.js';
import type { RefreshDto } from './dto/refresh.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  async register(
    { email, password }: RegisterDto,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    if (await this.users.findByEmail(email)) {
      throw new ConflictException('Bu e-posta zaten kayıtlı');
    }

    const user = await this.users.create({
      email,
      passwordHash: await argon2.hash(password),
    });

    return this.tokens.issueTokens(user, userAgent);
  }

  /** Refresh token ile yeni token çifti alır (rotation). */
  refresh({ refreshToken }: RefreshDto, userAgent?: string) {
    return this.tokens.rotate(refreshToken, userAgent);
  }
}
