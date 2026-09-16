import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  /** Pencere içinde izin verilen en fazla istek sayısı */
  limit: number;
  /** Pencere süresi (milisaniye) */
  ttlMs: number;
}

export const RATE_LIMIT_KEY = 'rateLimit';
export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';

/** Varsayılan: IP başına, uç nokta başına dakikada 100 istek */
export const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  limit: 100,
  ttlMs: 60_000,
};

/**
 * Bir controller ya da uç nokta için sınırı değiştirir.
 * @example @RateLimit({ limit: 10, ttlMs: 60_000 }) // dakikada 10 istek
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

/** Uç noktayı istek sınırından muaf tutar (ör. sağlık kontrolü). */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
