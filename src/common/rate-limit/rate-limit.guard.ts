import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import {
  DEFAULT_RATE_LIMIT,
  RATE_LIMIT_KEY,
  type RateLimitOptions,
  SKIP_RATE_LIMIT_KEY,
} from './rate-limit.decorator.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * IP + uç nokta başına sabit pencereli istek sınırı.
 *
 * Neden @nestjs/throttler değil? Throttler henüz NestJS 12'yi desteklemiyor
 * (peerDependencies en fazla 11). Desteklediğinde bu guard onunla
 * değiştirilebilir; decorator'lar aynı işi görür.
 *
 * Sayaçlar bellekte tutulur: tek sunucu için yeterli. Birden fazla sunucu
 * çalıştırılırsa Redis gibi ortak bir depoya taşınmalı.
 *
 * Not: Yayına alırken uygulama bir proxy arkasındaysa gerçek istemci IP'si için
 * Express'te "trust proxy" ayarı açılmalı (Aşama 12).
 */
@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly buckets = new Map<string, Bucket>();
  private readonly sweeper: NodeJS.Timeout;

  constructor(private readonly reflector: Reflector) {
    // Süresi dolmuş sayaçları dakikada bir temizle; bellek şişmesin.
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (
      this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, targets)
    ) {
      return true;
    }

    const { limit, ttlMs } =
      this.reflector.getAllAndOverride<RateLimitOptions>(
        RATE_LIMIT_KEY,
        targets,
      ) ?? DEFAULT_RATE_LIMIT;

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const key = [
      req.ip ?? 'unknown',
      context.getClass().name,
      context.getHandler().name,
    ].join(':');

    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + ttlMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;

    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - bucket.count));
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (bucket.count > limit) {
      res.setHeader('Retry-After', resetSeconds);
      throw new HttpException(
        'Çok fazla istek gönderildi, lütfen biraz sonra tekrar deneyin',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /** Tüm sayaçları sıfırlar (testlerde, bir de ileride yönetim amaçlı). */
  reset() {
    this.buckets.clear();
  }

  onModuleDestroy() {
    clearInterval(this.sweeper);
  }

  private sweep() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
