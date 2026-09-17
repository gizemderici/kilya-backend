import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { RateLimitGuard } from '../src/common/rate-limit/index.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Me (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const emailOf = (name: string) => `${name}-${suffix}@kilya.test`;
  const api = () => request(app.getHttpServer());
  const anonymousIds: string[] = [];

  interface Session {
    accessToken: string;
    refreshToken: string;
    user: { id: string };
  }

  const register = async (name: string, password = 'Gizli-Parola-123') => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email: emailOf(name), password })
      .expect(201);
    return res.body as Session;
  };
  const anonymous = async () => {
    const res = await api().post('/api/v1/auth/anonymous').expect(201);
    anonymousIds.push(res.body.user.id);
    return res.body as Session;
  };
  const auth = (s: Session) => ({ Authorization: `Bearer ${s.accessToken}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => app.get(RateLimitGuard).reset());

  afterAll(async () => {
    await prisma?.user.deleteMany({
      where: {
        OR: [
          { email: { endsWith: `-${suffix}@kilya.test` } },
          { id: { in: anonymousIds } },
        ],
      },
    });
    await app?.close();
  });

  describe('GET /me', () => {
    it('token olmadan 401', async () => {
      await api().get('/api/v1/me').expect(401);
    });

    it('profil döner; passwordHash ve googleId yok', async () => {
      const s = await register('profil');
      const res = await api().get('/api/v1/me').set(auth(s)).expect(200);

      expect(res.body).toMatchObject({
        id: s.user.id,
        email: emailOf('profil'),
        isAnonymous: false,
        displayName: null,
        timezone: 'Europe/Istanbul',
        hasPassword: true,
        hasGoogle: false,
      });
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body).not.toHaveProperty('googleId');
    });

    it('anonim kullanıcıda hasPassword=false, email=null', async () => {
      const s = await anonymous();
      const res = await api().get('/api/v1/me').set(auth(s)).expect(200);
      expect(res.body).toMatchObject({
        isAnonymous: true,
        email: null,
        hasPassword: false,
      });
    });
  });

  describe('PATCH /me', () => {
    it('gönderilen alanları günceller, tekrar okunur', async () => {
      const s = await register('guncelle');
      const res = await api()
        .patch('/api/v1/me')
        .set(auth(s))
        .send({
          displayName: '  Gizem  ',
          birthYear: 1998,
          heightCm: 170,
          weightKg: 65,
          timezone: 'Europe/Berlin',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        displayName: 'Gizem',
        birthYear: 1998,
        heightCm: 170,
        weightKg: 65,
        timezone: 'Europe/Berlin',
      });

      const again = await api().get('/api/v1/me').set(auth(s)).expect(200);
      expect(again.body.displayName).toBe('Gizem');
      expect(again.body.timezone).toBe('Europe/Berlin');
    });

    it('sadece bir alan gönderilince diğerleri değişmez; null alanı temizler', async () => {
      const s = await register('kismi');
      await api()
        .patch('/api/v1/me')
        .set(auth(s))
        .send({ displayName: 'Gizem', heightCm: 170 })
        .expect(200);

      const res = await api()
        .patch('/api/v1/me')
        .set(auth(s))
        .send({ heightCm: null })
        .expect(200);
      expect(res.body.displayName).toBe('Gizem');
      expect(res.body.heightCm).toBeNull();
    });

    it('geçersiz saat dilimi, aralık dışı değer ve bilinmeyen alan 400', async () => {
      const s = await register('gecersiz');
      const patch = (body: object) =>
        api().patch('/api/v1/me').set(auth(s)).send(body);

      const tz = await patch({ timezone: 'Istanbul' }).expect(400);
      expect(tz.body.message[0]).toContain('saat dilimi');
      await patch({ heightCm: 999 }).expect(400);
      await patch({ birthYear: 1850 }).expect(400);
      await patch({ email: emailOf('baska') }).expect(400); // e-posta buradan değişmez
      await patch({ passwordHash: 'x' }).expect(400);
    });
  });

  describe('POST /me/change-password', () => {
    it('parolayı değiştirir, eski oturumları kapatır, yeni token verir', async () => {
      const s = await register('parola');
      const res = await api()
        .post('/api/v1/me/change-password')
        .set(auth(s))
        .send({
          currentPassword: 'Gizli-Parola-123',
          newPassword: 'Yeni-Parola-456',
        })
        .expect(200);

      expect(res.body.refreshToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).not.toBe(s.refreshToken);

      // Eski refresh token artık geçersiz
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: s.refreshToken })
        .expect(401);

      // Yeni parola ile giriş
      await api()
        .post('/api/v1/auth/login')
        .send({ email: emailOf('parola'), password: 'Yeni-Parola-456' })
        .expect(200);
      await api()
        .post('/api/v1/auth/login')
        .send({ email: emailOf('parola'), password: 'Gizli-Parola-123' })
        .expect(401);
    });

    it('mevcut parola yanlışsa 401, parola değişmez', async () => {
      const s = await register('yanlis');
      const res = await api()
        .post('/api/v1/me/change-password')
        .set(auth(s))
        .send({ currentPassword: 'yanlis', newPassword: 'Yeni-Parola-456' })
        .expect(401);
      expect(res.body.message).toBe('Mevcut parola hatalı');

      await api()
        .post('/api/v1/auth/login')
        .send({ email: emailOf('yanlis'), password: 'Gizli-Parola-123' })
        .expect(200);
    });

    it('parolasız (anonim) hesapta 400', async () => {
      const s = await anonymous();
      await api()
        .post('/api/v1/me/change-password')
        .set(auth(s))
        .send({ currentPassword: 'x', newPassword: 'Yeni-Parola-456' })
        .expect(400);
    });
  });
});
