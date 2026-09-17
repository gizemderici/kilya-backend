import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleAuthService } from './google-auth.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { TokenModule } from './token.module.js';

@Module({
  imports: [
    UsersModule,
    TokenModule,
    JwtModule.registerAsync({
      // Global: JwtAuthGuard (APP_GUARD) her modülden JwtService'i alabilsin.
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_ACCESS_TTL', { infer: true }),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleAuthService, PasswordResetService],
})
export class AuthModule {}
