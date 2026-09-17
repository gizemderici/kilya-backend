import { SetMetadata } from '@nestjs/common';
import type { ConsentType } from '../../generated/prisma/enums.js';

export const REQUIRED_CONSENT_KEY = 'requiredConsent';

/**
 * Uç noktayı, kullanıcının belirtilen KVKK onayı aktif değilse 403 ile kapatır.
 * @example @RequireConsent('HEALTH_DATA') // duruş verisi gönderme
 */
export const RequireConsent = (type: ConsentType) =>
  SetMetadata(REQUIRED_CONSENT_KEY, type);
