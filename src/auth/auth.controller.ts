import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Public } from '../common/decorators/index.js';
import { RateLimit } from '../common/rate-limit/index.js';
import { AuthService } from './auth.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { GoogleLoginDto } from './dto/google-login.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { LogoutDto } from './dto/logout.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UpgradeDto } from './dto/upgrade.dto.js';

@ApiTags('auth')
@Controller('auth')
// Kimlik uç noktaları kaba kuvvet saldırılarına açık: dakikada 10 istek.
@RateLimit({ limit: 10, ttlMs: 60_000 })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  /** E-posta ve parolayla yeni hesap açar; token çifti döner. */
  @Public()
  @Post('register')
  @HttpCode(201)
  @ApiCreatedResponse({ type: AuthResponseDto })
  register(
    @Body() dto: RegisterDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.register(dto, userAgent);
  }

  /** E-posta ve parolayla giriş yapar; token çifti döner. */
  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'E-posta veya parola hatalı' })
  login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.login(dto, userAgent);
  }

  /**
   * Google ile giriş. Android, Credential Manager'dan aldığı ID token'ı
   * gönderir; hesap yoksa oluşturulur, aynı e-postalı hesap varsa bağlanır.
   */
  @Public()
  @Post('google')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Google kimliği doğrulanamadı' })
  @ApiServiceUnavailableResponse({
    description: 'GOOGLE_WEB_CLIENT_ID sunucuda tanımlı değil',
  })
  google(
    @Body() dto: GoogleLoginDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.loginWithGoogle(dto, userAgent);
  }

  /** Hesapsız devam et: anonim kullanıcı açar, token çifti döner. */
  @Public()
  @Post('anonymous')
  @HttpCode(201)
  @ApiCreatedResponse({ type: AuthResponseDto })
  anonymous(
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.createAnonymous(userAgent);
  }

  /**
   * Anonim hesabı kalıcı yapar (e-posta + parola ya da Google idToken).
   * Aynı kullanıcı kaydı güncellenir; önceki veriler korunur.
   */
  @Post('upgrade')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Hesap zaten kalıcı ya da eksik alan' })
  @ApiConflictResponse({
    description: 'E-posta ya da Google hesabı başka bir kullanıcıda',
  })
  upgrade(
    @CurrentUser('id') userId: string,
    @Body() dto: UpgradeDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.upgrade(userId, dto, userAgent);
  }

  /**
   * Refresh token ile yeni access + refresh çifti alır. Eski refresh token
   * iptal edilir; iptal edilmiş bir token yeniden kullanılırsa kullanıcının
   * tüm oturumları kapatılır.
   */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Token geçersiz, süresi dolmuş ya da iptal edilmiş',
  })
  refresh(
    @Body() dto: RefreshDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.refresh(dto, userAgent);
  }

  /** Çıkış: bu cihazın refresh token'ını iptal eder. */
  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  logout(@Body() dto: LogoutDto): Promise<void> {
    return this.auth.logout(dto);
  }
  /**
   * Parola sıfırlama kodu ister. E-posta kayıtlı olsun olmasın 204 döner;
   * kayıtlıysa 6 haneli kod e-postayla gönderilir (15 dakika geçerli).
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(204)
  // E-posta bombardımanını önlemek için daha sıkı: dakikada 5 istek.
  @RateLimit({ limit: 5, ttlMs: 60_000 })
  @ApiNoContentResponse()
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    return this.passwordReset.requestReset(dto);
  }

  /**
   * E-postayla gelen kodla parolayı değiştirir. Kod tek kullanımlık;
   * başarılı olunca kullanıcının tüm oturumları kapatılır.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Kod geçersiz ya da süresi dolmuş' })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.passwordReset.resetPassword(dto);
  }
}
