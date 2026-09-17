import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import { JwtAuthGuard } from './common/guards/index.js';
import { RateLimitGuard } from './common/rate-limit/index.js';
import { validateEnv } from './config/env.js';
import { loggerConfig } from './config/logger.config.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: loggerConfig,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    // Guard'lar kayıt sırasıyla çalışır; istek sınırı en önce kontrol edilsin
    // ardından JWT doğrulanır.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
