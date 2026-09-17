import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '../common/decorators/index.js';
import { SkipRateLimit } from '../common/rate-limit/index.js';
import { DatabaseHealthIndicator } from './database.health.js';

@ApiTags('health')
@Public()
@SkipRateLimit()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  /**
   * Uygulamanın ve veritabanının ayakta olup olmadığını döner.
   * Her şey yolundaysa 200, veritabanına ulaşılamıyorsa 503.
   */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.database.isHealthy()]);
  }
}
