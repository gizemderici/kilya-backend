import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const emailOf = (name: string) => `${name}-${suffix}@kilya.test`;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({
      where: { email: { endsWith: `-${suffix}@kilya.test` } },
    });
    await app?.close();
  });

  describe('POST /auth/register', () => {
    it('kayıt olur, token çifti ve kullanıcıyı döner', async () => {
      const res = await api()
        .post('/api/v1/auth/register')
        .send({ email: emailOf('kayit'), password: 'Gizli-Parola-123' })
        .expect(201);

      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: { email: emailOf('kayit'), isAnonymous: false },
      });
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('e-postayı küçük harfe çevirir ve boşlukları kırpar', async () => {
      const res = await api()
        .post('/api/v1/auth/register')
        .send({
          email: `  ${emailOf('BUYUK').toUpperCase()}  `,
          password: 'Gizli-Parola-123',
        })
        .expect(201);
      expect(res.body.user.email).toBe(emailOf('buyuk'));
    });

    it('veritabanında parola düz metin değil, argon2 hash', async () => {
      const email = emailOf('hash');
      await api()
        .post('/api/v1/auth/register')
        .send({ email, password: 'Gizli-Parola-123' })
        .expect(201);

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user?.passwordHash).not.toContain('Gizli-Parola-123');
    });

    it('aynı e-postayla ikinci kayıt 409 döner', async () => {
      const body = { email: emailOf('tekrar'), password: 'Gizli-Parola-123' };
      await api().post('/api/v1/auth/register').send(body).expect(201);
      const res = await api()
        .post('/api/v1/auth/register')
        .send(body)
        .expect(409);
      expect(res.body.message).toBe('Bu e-posta zaten kayıtlı');
    });

    it('kısa parola ve bozuk e-posta 400 döner', async () => {
      await api()
        .post('/api/v1/auth/register')
        .send({ email: emailOf('kisa'), password: '1234567' })
        .expect(400);
      await api()
        .post('/api/v1/auth/register')
        .send({ email: 'bozuk', password: 'Gizli-Parola-123' })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    const register = async (name: string) => {
      const res = await api()
        .post('/api/v1/auth/register')
        .send({ email: emailOf(name), password: 'Gizli-Parola-123' })
        .expect(201);
      return res.body as {
        accessToken: string;
        refreshToken: string;
        user: { id: string };
      };
    };
    const refresh = (refreshToken: string) =>
      api().post('/api/v1/auth/refresh').send({ refreshToken });

    it('geçerli token ile yeni çift verir, eskisi geçersiz olur', async () => {
      const first = await register('refresh');

      const second = await refresh(first.refreshToken).expect(200);
      expect(second.body.refreshToken).not.toBe(first.refreshToken);
      expect(second.body.user.id).toBe(first.user.id);

      // Eski token artık kullanılamaz
      await refresh(first.refreshToken).expect(401);
    });

    it('iptal edilmiş token yeniden kullanılınca diğer oturumlar da kapanır', async () => {
      // Aynı kullanıcı iki cihazdan giriş yapmış gibi: iki refresh token
      const phone = await register('calinti');
      const tablet = await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: phone.refreshToken })
        .expect(200);
      // phone.refreshToken artık iptal; tablet.body.refreshToken geçerli.
      // Saldırgan eski (iptal edilmiş) token'ı tekrar kullanıyor:
      await refresh(phone.refreshToken).expect(401);

      // Kullanıcının hâlâ geçerli olan tablet oturumu da kapatılmış olmalı
      await refresh(tablet.body.refreshToken).expect(401);

      const active = await prisma.refreshToken.count({
        where: { userId: phone.user.id, revokedAt: null },
      });
      expect(active).toBe(0);
    });

    it('uydurma token 401', async () => {
      await refresh('a'.repeat(43)).expect(401);
    });
  });

  describe('POST /auth/login ve /auth/logout', () => {
    const email = () => emailOf('giris');
    const password = 'Gizli-Parola-123';

    beforeAll(async () => {
      await api()
        .post('/api/v1/auth/register')
        .send({ email: email(), password })
        .expect(201);
    });

    it('doğru bilgilerle giriş yapar', async () => {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: email().toUpperCase(), password })
        .expect(200);
      expect(res.body.user.email).toBe(email());
      expect(res.body.refreshToken).toEqual(expect.any(String));
    });

    it('yanlış parola ve kayıtsız e-posta birebir aynı yanıtı verir', async () => {
      const wrong = await api()
        .post('/api/v1/auth/login')
        .send({ email: email(), password: 'yanlis-parola' })
        .expect(401);
      const unknown = await api()
        .post('/api/v1/auth/login')
        .send({ email: emailOf('yok'), password })
        .expect(401);

      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body.message).toBe('E-posta veya parola hatalı');
    });

    it('logout refresh tokenı iptal eder; token gerektirir', async () => {
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ email: email(), password })
        .expect(200);
      const { accessToken, refreshToken } = login.body;

      await api()
        .post('/api/v1/auth/logout')
        .send({ refreshToken })
        .expect(401); // access token yok

      await api()
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(204);

      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('çıkıştan sonra eski tokenla deneme diğer cihazın oturumunu kapatmaz', async () => {
      const phone = await api()
        .post('/api/v1/auth/login')
        .send({ email: email(), password })
        .expect(200);
      const tablet = await api()
        .post('/api/v1/auth/login')
        .send({ email: email(), password })
        .expect(200);

      await api()
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${phone.body.accessToken}`)
        .send({ refreshToken: phone.body.refreshToken })
        .expect(204);
      // Telefon uygulaması hatayla eski token'ı tekrar deniyor
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: phone.body.refreshToken })
        .expect(401);

      // Tablet etkilenmemeli
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tablet.body.refreshToken })
        .expect(200);
    });
  });
});
