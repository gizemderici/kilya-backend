import type { IncomingMessage, ServerResponse } from 'node:http';
import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import type { Env } from './env.js';

type Req = IncomingMessage & { originalUrl?: string };

const urlOf = (req: Req) => req.originalUrl ?? req.url ?? '';

/** Loglara asla düz metin olarak yazılmaması gereken alanlar. */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.newPassword',
  'req.body.refreshToken',
  'req.body.idToken',
];

/**
 * nestjs-pino ayarları.
 * - development: renkli, tek satırlık okunaklı loglar (pino-pretty)
 * - test: sessiz
 * - production: JSON loglar (log toplama servisleri için)
 */
export function loggerConfig(config: ConfigService<Env, true>): Params {
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const isDev = nodeEnv === 'development';

  return {
    pinoHttp: {
      level: nodeEnv === 'test' ? 'silent' : isDev ? 'debug' : 'info',
      redact: { paths: REDACT_PATHS, censor: '[gizli]' },
      autoLogging: {
        // Sağlık kontrolü sık çağrılır; logları doldurmasın.
        ignore: (req: Req) => urlOf(req).startsWith('/api/v1/health'),
      },
      customSuccessMessage: (req: Req, res: ServerResponse, ms: number) =>
        `${req.method} ${urlOf(req)} ${res.statusCode} - ${ms}ms`,
      customErrorMessage: (req: Req, res: ServerResponse, err: Error) =>
        `${req.method} ${urlOf(req)} ${res.statusCode} - ${err.message}`,
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              translateTime: 'SYS:HH:MM:ss',
              ignore: 'pid,hostname,context,req,res,responseTime',
              messageFormat: '{if context}[{context}] {end}{msg}',
            },
          }
        : undefined,
    },
  };
}
