import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32, 'en az 32 karakter olmalı'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  GOOGLE_WEB_CLIENT_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** ConfigModule.forRoot({ validate }) için; hatalı .env'de uygulama açılmaz. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Ortam değişkenleri geçersiz:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
