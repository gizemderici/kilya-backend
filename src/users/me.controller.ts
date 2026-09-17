import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthResponseDto } from '../auth/dto/auth-response.dto.js';
import { CurrentUser } from '../common/decorators/index.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { UsersService } from './users.service.js';

/** Giriş yapmış kullanıcının kendi hesabı. Tüm uç noktalar token ister. */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  /** Profil bilgisi. */
  @Get()
  @ApiOkResponse({ type: UserResponseDto })
  getProfile(@CurrentUser('id') userId: string): Promise<UserResponseDto> {
    return this.users.getProfile(userId);
  }

  /** Profili günceller; yalnızca gönderilen alanlar değişir. */
  @Patch()
  @ApiOkResponse({ type: UserResponseDto })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.users.updateProfile(userId, dto);
  }

  /**
   * Parolayı değiştirir. Tüm oturumlar kapatılır; yanıttaki yeni token çifti
   * kullanılmalıdır.
   */
  @Post('change-password')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Mevcut parola hatalı' })
  @ApiBadRequestResponse({
    description: 'Hesapta parola yok (Google ile açılmış)',
  })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.users.changePassword(userId, dto, userAgent);
  }
}
