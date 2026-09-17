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

  describe('GET/PUT /me/goals', () => {
    it('başlangıçta boş; PUT ile yazılır ve okunur', async () => {
      const s = await anonymous(); // hedef seçimi onboarding'de, hesapsız da olabilir
      const empty = await api()
        .get('/api/v1/me/goals')
        .set(auth(s))
        .expect(200);
      expect(empty.body).toEqual({ goals: [] });

      const put = await api()
        .put('/api/v1/me/goals')
        .set(auth(s))
        .send({
          goals: [
            { type: 'POSTURE', dailyTargetMinutes: 240 },
            { type: 'BACK_PAIN' },
          ],
        })
        .expect(200);
      expect(put.body.goals).toEqual([
        {
          type: 'POSTURE',
          dailyTargetMinutes: 240,
          createdAt: expect.any(String),
        },
        {
          type: 'BACK_PAIN',
          dailyTargetMinutes: null,
          createdAt: expect.any(String),
        },
      ]);

      const get = await api().get('/api/v1/me/goals').set(auth(s)).expect(200);
      expect(get.body.goals.map((g: { type: string }) => g.type)).toEqual([
        'POSTURE',
        'BACK_PAIN',
      ]);
    });

    it('PUT listenin tamamını değiştirir; boş liste hepsini siler', async () => {
      const s = await register('hedef');
      const put = (goals: object[]) =>
        api().put('/api/v1/me/goals').set(auth(s)).send({ goals });

      await put([{ type: 'POSTURE' }, { type: 'KYPHOSIS' }]).expect(200);
      const replaced = await put([{ type: 'BACK_PAIN' }]).expect(200);
      expect(replaced.body.goals).toHaveLength(1);
      expect(replaced.body.goals[0].type).toBe('BACK_PAIN');

      const cleared = await put([]).expect(200);
      expect(cleared.body.goals).toEqual([]);
    });

    it('geçersiz tür, tekrar eden tür ve aralık dışı hedef 400', async () => {
      const s = await register('hedef-hata');
      const put = (goals: object[]) =>
        api().put('/api/v1/me/goals').set(auth(s)).send({ goals });

      await put([{ type: 'RUNNING' }]).expect(400);
      await put([{ type: 'POSTURE' }, { type: 'POSTURE' }]).expect(400);
      await put([{ type: 'POSTURE', dailyTargetMinutes: 2000 }]).expect(400);
      await put([{ type: 'POSTURE', extra: 1 }]).expect(400);
    });

    it('bir kullanıcının hedefleri diğerini etkilemez', async () => {
      const a = await register('hedef-a');
      const b = await register('hedef-b');
      await api()
        .put('/api/v1/me/goals')
        .set(auth(a))
        .send({ goals: [{ type: 'POSTURE' }] })
        .expect(200);

      const res = await api().get('/api/v1/me/goals').set(auth(b)).expect(200);
      expect(res.body.goals).toEqual([]);
    });
  });
});
