import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsEmail, IsString } from 'class-validator';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { Public } from '../src/common/decorators/index.js';
import { RateLimit } from '../src/common/rate-limit/index.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Not: Bu testler .env'deki veritabanını kullanır (docker compose up -d).
// Aşama 10'da ayrı test veritabanına (db-test) taşınacak.

class EchoDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;
}

/** Sadece testlerde var olan uç noktalar: global ayarları denemek için. */
@Public()
@Controller('e2e-test')
class E2eTestController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('echo')
  echo(@Body() body: EchoDto) {
    return body;
  }

  @Post('limited')
  @RateLimit({ limit: 2, ttlMs: 60_000 })
  limited() {
    return { ok: true };
  }

  @Post('duplicate-user')
  async duplicateUser(@Body() { email }: { email: string }) {
    await this.prisma.user.create({ data: { email } });
    await this.prisma.user.create({ data: { email } }); // P2002
  }
}

/** @Public() olmayan bir uç nokta: global JwtAuthGuard'ı denemek için. */
@Controller('e2e-test')
class E2eProtectedController {
  @Get('protected')
  protectedRoute() {
    return { ok: true };
  }
}

describe('Uygulama (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `e2e-${randomUUID()}@kilya.test`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [E2eTestController, E2eProtectedController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { email } });
    await app?.close();
  });

  describe('GET /api/v1/health', () => {
    it('veritabanı ayaktayken 200 döner', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body).toMatchObject({
        status: 'ok',
        info: { database: { status: 'up' } },
      });
    });

    it('helmet güvenlik başlıklarını ekler', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('doğrulama (ValidationPipe)', () => {
    const echo = () =>
      request(app.getHttpServer()).post('/api/v1/e2e-test/echo');

    it('geçerli gövdeyi kabul eder', async () => {
      await echo()
        .send({ email: 'a@b.com', name: 'Gizem' })
        .expect(201, { email: 'a@b.com', name: 'Gizem' });
    });

    it('bilinmeyen alan gelirse 400 döner', async () => {
      const res = await echo()
        .send({ email: 'a@b.com', name: 'Gizem', isAdmin: true })
        .expect(400);
      expect(res.body.message).toContain('property isAdmin should not exist');
    });

    it('geçersiz e-postada 400 döner', async () => {
      await echo().send({ email: 'gecersiz', name: 'Gizem' }).expect(400);
    });
  });

  it('istek sınırı aşılınca 429 döner', async () => {
    const limited = () =>
      request(app.getHttpServer()).post('/api/v1/e2e-test/limited');

    await limited().expect(201);
    await limited().expect(201);
    const res = await limited().expect(429);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('Prisma benzersizlik hatası 409 olarak döner', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/e2e-test/duplicate-user')
      .send({ email })
      .expect(409);

    expect(res.body).toEqual({
      statusCode: 409,
      message: 'Bu kayıt zaten mevcut',
      error: 'Conflict',
    });
  });

  describe('JwtAuthGuard (global)', () => {
    it('token olmadan korumalı uç nokta 401 döner', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/e2e-test/protected')
        .expect(401);
      expect(res.body.message).toBe('Giriş yapmanız gerekiyor');
    });

    it('bozuk token ile 401 döner', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/e2e-test/protected')
        .set('Authorization', 'Bearer bozuk.token.degeri')
        .expect(401);
    });

    it('/health token olmadan açık', async () => {
      await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    });
  });

  it('olmayan adres 404 döner', async () => {
    await request(app.getHttpServer()).get('/api/v1/yok').expect(404);
  });
});
