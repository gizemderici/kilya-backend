import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Env } from '../config/env.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
      }),
    });
  }

  async onModuleInit() {
    // pg adapter'ı bağlantıyı ilk sorguya kadar erteler; açılışta
    // veritabanına gerçekten erişilebildiğini doğrulamak için sorgu atıyoruz.
    await this.$queryRaw`SELECT 1`;
    this.logger.log('Veritabanı bağlantısı hazır');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
