import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/index.js';
import { RateLimit } from '../common/rate-limit/index.js';
import { AuthService } from './auth.service.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@ApiTags('auth')
@Controller('auth')
// Kimlik uç noktaları kaba kuvvet saldırılarına açık: dakikada 10 istek.
@RateLimit({ limit: 10, ttlMs: 60_000 })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
}
