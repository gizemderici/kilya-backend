import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { ConsentType } from '../../generated/prisma/enums.js';
import { ConsentsService } from '../../users/consents.service.js';
import { REQUIRED_CONSENT_KEY } from '../decorators/index.js';

const CONSENT_LABELS: Record<ConsentType, string> = {
  HEALTH_DATA: 'sağlık verisi işleme',
  RESEARCH_SHARING: 'araştırma amaçlı veri paylaşımı',
};

/**
 * @RequireConsent() olan uç noktalarda kullanıcının aktif onayı var mı bakar.
 * JwtAuthGuard'dan sonra çalışır; decorator yoksa hiçbir şey yapmaz.
 */
@Injectable()
export class ConsentGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly consents: ConsentsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<ConsentType | undefined>(
      REQUIRED_CONSENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const user = context.switchToHttp().getRequest<Request>().user;
    if (!user) return false; // JwtAuthGuard zaten 401 vermiş olmalı

    if (!(await this.consents.hasActive(user.id, required))) {
      throw new ForbiddenException(
        `Bu işlem için ${CONSENT_LABELS[required]} onayı gerekiyor`,
      );
    }
    return true;
  }
}
