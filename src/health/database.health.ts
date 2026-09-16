import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Veritabanı sağlık kontrolü.
 *
 * Terminus'un hazır PrismaHealthIndicator'ı hata olduğunda veritabanının
 * adresini de içeren ham hata mesajını yanıta koyuyor. /health herkese açık
 * olduğu için ayrıntıyı sadece loga yazıp dışarıya genel bir mesaj dönüyoruz.
 */
@Injectable()
export class DatabaseHealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key = 'database', timeoutMs = 1500) {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, timeoutMs);
      return indicator.up();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`Veritabanına ulaşılamıyor: ${detail.trim()}`);
      return indicator.down({ message: 'Veritabanına ulaşılamıyor' });
    }
  }
}

function withTimeout<T>(work: PromiseLike<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${ms} ms içinde yanıt gelmedi`)),
      ms,
    );
  });
  return Promise.race([Promise.resolve(work), timeout]).finally(() =>
    clearTimeout(timer),
  );
}
