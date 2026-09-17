import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import type { AuthResponseDto } from '../auth/dto/auth-response.dto.js';
import { TokenService } from '../auth/token.service.js';
import type { Prisma, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  // ---------- Kayıt erişimi (Auth modülü de kullanır) ----------

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email, deletedAt: null } });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { googleId, deletedAt: null } });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  // ---------- Profil (/me) ----------

  async getProfile(userId: string): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.requireUser(userId));
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    await this.requireUser(userId);
    const user = await this.update(userId, {
      displayName: dto.displayName,
      birthYear: dto.birthYear,
      heightCm: dto.heightCm,
      weightKg: dto.weightKg,
      // timezone boş bırakılamaz; null gelirse dokunma.
      timezone: dto.timezone ?? undefined,
    });
    return UserResponseDto.from(user);
  }

  /**
   * Parola değiştirir ve tüm oturumları kapatır; istemcinin kullanmaya devam
   * edebilmesi için yeni bir token çifti döner.
   */
  async changePassword(
    userId: string,
    { currentPassword, newPassword }: ChangePasswordDto,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const user = await this.requireUser(userId);
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Bu hesapta parola yok; parola belirlemek için "parolamı unuttum" akışını kullanın',
      );
    }
    if (!(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Mevcut parola hatalı');
    }

    const updated = await this.update(userId, {
      passwordHash: await argon2.hash(newPassword),
    });
    await this.tokens.revokeAll(userId);
    return this.tokens.issueTokens(updated, userAgent);
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.findById(userId);
    // Token geçerli ama kullanıcı silinmiş: oturum artık geçersiz.
    if (!user) throw new UnauthorizedException('Kullanıcı bulunamadı');
    return user;
  }
}
