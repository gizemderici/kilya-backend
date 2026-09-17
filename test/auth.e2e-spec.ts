import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { UnauthorizedException } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import {
  GoogleAuthService,
  type GoogleProfile,
} from '../src/auth/google-auth.service.js';
import { RateLimitGuard } from '../src/common/rate-limit/index.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Google'a ağ üzerinden gitmeden ID token doğrulamayı taklit eder.
 * Token biçimi: "ok:<googleId>:<email>[:unverified]" ya da başka bir şey (401).
 */
class FakeGoogleAuthService {
  readonly isConfigured = true;
  async verify(idToken: string): Promise<GoogleProfile> {
    const [tag, googleId, email, flag] = idToken.split(':');
    if (tag !== 'ok' || !googleId) {
      throw new UnauthorizedException('Google kimliği doğrulanamadı');
    }
    return {
      googleId,
      email,
      emailVerified: flag !== 'unverified',
      name: 'Google Kullanıcısı',
    };
  }
}

/** E-posta göndermek yerine kodları bellekte tutar. */
class FakeMailService {
  readonly codes = new Map<string, string>();
  async sendPasswordResetCode(to: string, code: string) {
    this.codes.set(to, code);
  }
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mail: FakeMailService;
  const suffix = randomUUID();
  const emailOf = (name: string) => `${name}-${suffix}@kilya.test`;
  const api = () => request(app.getHttpServer());
  /** E-postasız kalan anonim kullanıcılar; sonda silinir. */
  const anonymousIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GoogleAuthService)
      .useClass(FakeGoogleAuthService)
      .overrideProvider(MailService)
      .useClass(FakeMailService)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    mail = app.get(MailService) as unknown as FakeMailService;
  });

  // Auth uç noktaları dakikada 10 istekle sınırlı; test paketi bunu aşar.
  beforeEach(() => app.get(RateLimitGuard).reset());

  afterAll(async () => {
    await prisma?.user.deleteMany({
      where: {
        OR: [
          { email: { endsWith: `-${suffix}@kilya.test` } },
          { googleId: { startsWith: `g-${suffix}` } },
          { id: { in: anonymousIds } },
        ],
      },
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

  describe('POST /auth/google', () => {
    const google = (idToken: string) =>
      api().post('/api/v1/auth/google').send({ idToken });
    const gid = (name: string) => `g-${suffix}-${name}`;

    it('geçersiz token 401 döner, kullanıcı oluşturmaz', async () => {
      const before = await prisma.user.count();
      const res = await google('bozuk-token-xxxxxxxxxxxxxxx').expect(401);
      expect(res.body.message).toBe('Google kimliği doğrulanamadı');
      expect(await prisma.user.count()).toBe(before);
    });

    it('ilk girişte hesap açar, ikinci girişte aynı hesabı kullanır', async () => {
      const token = `ok:${gid('yeni')}:${emailOf('google')}`;

      const first = await google(token).expect(200);
      expect(first.body.user).toMatchObject({
        email: emailOf('google'),
        isAnonymous: false,
      });

      const second = await google(token).expect(200);
      expect(second.body.user.id).toBe(first.body.user.id);
    });

    it('aynı e-postayla e-posta/parola hesabı varsa ona bağlanır', async () => {
      const email = emailOf('bagla');
      const registered = await api()
        .post('/api/v1/auth/register')
        .send({ email, password: 'Gizli-Parola-123' })
        .expect(201);

      const res = await google(`ok:${gid('bagla')}:${email}`).expect(200);
      expect(res.body.user.id).toBe(registered.body.user.id);

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user?.googleId).toBe(gid('bagla'));
      expect(user?.passwordHash).toMatch(/^\$argon2id\$/); // parola korunur
    });

    it('doğrulanmamış e-posta mevcut hesaba bağlanmaz', async () => {
      const email = emailOf('dogrulanmamis');
      const registered = await api()
        .post('/api/v1/auth/register')
        .send({ email, password: 'Gizli-Parola-123' })
        .expect(201);

      const res = await google(
        `ok:${gid('dogrulanmamis')}:${email}:unverified`,
      ).expect(200);

      expect(res.body.user.id).not.toBe(registered.body.user.id);
      expect(res.body.user.email).toBeNull();
    });
  });

  describe('POST /auth/anonymous ve /auth/upgrade', () => {
    const anonymous = async () => {
      const res = await api().post('/api/v1/auth/anonymous').expect(201);
      anonymousIds.push(res.body.user.id);
      return res.body as {
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string | null; isAnonymous: boolean };
      };
    };
    const upgrade = (accessToken: string, body: object) =>
      api()
        .post('/api/v1/auth/upgrade')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(body);

    it('anonim kullanıcı açar; e-postasız, isAnonymous=true', async () => {
      const anon = await anonymous();
      expect(anon.user).toMatchObject({ email: null, isAnonymous: true });
      expect(anon.accessToken).toEqual(expect.any(String));
    });

    it('anonim kullanıcı e-posta ile kalıcı olunca aynı userId korunur', async () => {
      const anon = await anonymous();
      const email = emailOf('yukselt');

      // Anonimken "veri" üretmiş gibi: bir oturum kaydı var
      const before = await prisma.refreshToken.count({
        where: { userId: anon.user.id },
      });
      expect(before).toBe(1);

      const res = await upgrade(anon.accessToken, {
        email,
        password: 'Gizli-Parola-123',
      }).expect(200);

      expect(res.body.user).toEqual({
        id: anon.user.id,
        email,
        isAnonymous: false,
      });

      // Eski veriler aynı userId altında duruyor; artık parola ile giriş yapılır
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ email, password: 'Gizli-Parola-123' })
        .expect(200);
      expect(login.body.user.id).toBe(anon.user.id);
      expect(
        await prisma.refreshToken.count({ where: { userId: anon.user.id } }),
      ).toBeGreaterThanOrEqual(before + 1);
    });

    it('anonim kullanıcı Google ile kalıcı olur', async () => {
      const anon = await anonymous();
      const res = await upgrade(anon.accessToken, {
        idToken: `ok:g-${suffix}-yukselt:${emailOf('gyukselt')}`,
      }).expect(200);
      expect(res.body.user).toEqual({
        id: anon.user.id,
        email: emailOf('gyukselt'),
        isAnonymous: false,
      });
    });

    it('e-posta başka hesaptaysa 409, anonim hesap değişmez', async () => {
      const email = emailOf('dolu');
      await api()
        .post('/api/v1/auth/register')
        .send({ email, password: 'Gizli-Parola-123' })
        .expect(201);
      const anon = await anonymous();

      const res = await upgrade(anon.accessToken, {
        email,
        password: 'Baska-Parola-123',
      }).expect(409);
      expect(res.body.message).toBe('Bu e-posta zaten kayıtlı');

      const still = await prisma.user.findUnique({
        where: { id: anon.user.id },
      });
      expect(still?.isAnonymous).toBe(true);
    });

    it('kalıcı hesap tekrar upgrade edilemez (400); token olmadan 401', async () => {
      const anon = await anonymous();
      const upgraded = await upgrade(anon.accessToken, {
        email: emailOf('ikinci'),
        password: 'Gizli-Parola-123',
      }).expect(200);

      await upgrade(upgraded.body.accessToken, {
        email: emailOf('ucuncu'),
        password: 'Gizli-Parola-123',
      }).expect(400);

      await api()
        .post('/api/v1/auth/upgrade')
        .send({ email: emailOf('x'), password: 'Gizli-Parola-123' })
        .expect(401);
    });

    it('eksik alanlar 400', async () => {
      const anon = await anonymous();
      await upgrade(anon.accessToken, {}).expect(400);
      await upgrade(anon.accessToken, { email: emailOf('eksik') }).expect(400);
    });
  });

  describe('POST /auth/forgot-password ve /auth/reset-password', () => {
    const email = () => emailOf('sifirla');
    const oldPassword = 'Gizli-Parola-123';
    const newPassword = 'Yeni-Parola-456';
    const forgot = (e: string) =>
      api().post('/api/v1/auth/forgot-password').send({ email: e });
    const reset = (body: object) =>
      api().post('/api/v1/auth/reset-password').send(body);

    beforeAll(async () => {
      await api()
        .post('/api/v1/auth/register')
        .send({ email: email(), password: oldPassword })
        .expect(201);
    });

    it('kayıtlı ve kayıtsız e-posta için aynı 204 döner; sadece kayıtlıya kod gider', async () => {
      await forgot(email()).expect(204);
      await forgot(emailOf('kayitsiz')).expect(204);

      expect(mail.codes.get(email())).toMatch(/^\d{6}$/);
      expect(mail.codes.has(emailOf('kayitsiz'))).toBe(false);
    });

    it('kodla parola değişir, kod ikinci kez kullanılamaz, oturumlar kapanır', async () => {
      const session = await api()
        .post('/api/v1/auth/login')
        .send({ email: email(), password: oldPassword })
        .expect(200);

      await forgot(email()).expect(204);
      const code = mail.codes.get(email())!;

      await reset({ email: email(), code, newPassword }).expect(204);

      // Kod tek kullanımlık
      const again = await reset({
        email: email(),
        code,
        newPassword: 'Ucuncu-Parola-789',
      }).expect(400);
      expect(again.body.message).toBe('Kod geçersiz ya da süresi dolmuş');

      // Eski parola geçmez, yeni parola geçer
      await api()
        .post('/api/v1/auth/login')
        .send({ email: email(), password: oldPassword })
        .expect(401);
      await api()
        .post('/api/v1/auth/login')
        .send({ email: email(), password: newPassword })
        .expect(200);

      // Parola değişince önceki oturum kapanmış olmalı
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.body.refreshToken })
        .expect(401);
    });

    it('yanlış kod 400; yeni kod istenince eski kod geçersiz olur', async () => {
      await forgot(email()).expect(204);
      const first = mail.codes.get(email())!;
      await forgot(email()).expect(204);
      const second = mail.codes.get(email())!;

      await reset({ email: email(), code: '000000', newPassword }).expect(400);
      if (first !== second) {
        await reset({ email: email(), code: first, newPassword }).expect(400);
      }
      await reset({ email: email(), code: second, newPassword }).expect(204);
    });

    it('süresi dolmuş kod 400', async () => {
      await forgot(email()).expect(204);
      const code = mail.codes.get(email())!;
      const user = await prisma.user.findUnique({ where: { email: email() } });
      await prisma.passwordResetToken.updateMany({
        where: { userId: user!.id, usedAt: null },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await reset({ email: email(), code, newPassword }).expect(400);
    });

    it('bozuk gövde 400 (kod 6 hane, parola en az 8)', async () => {
      await reset({ email: email(), code: '12', newPassword }).expect(400);
      await reset({
        email: email(),
        code: '123456',
        newPassword: 'kisa',
      }).expect(400);
    });
  });
});
