# KILYA Backend Yol Haritası

**Teknolojiler:** NestJS (TypeScript) · PostgreSQL · Prisma · Docker
**Mobil istemci:** Kotlin + Jetpack Compose (yalnızca Android)
**Hazırlanma tarihi:** 16 Eylül 2026

Bu belge backend'i sıfırdan yayına kadar 12 aşamada anlatır. Her aşama küçük
işlere bölünmüştür. Her işin sonunda **Bitti sayılır** maddesi var: o madde
sağlanmadan bir sonraki işe geçme.

Süreler kabaca tahmindir; günde birkaç saat çalışan tek bir geliştirici için
düşünülmüştür.

---

## İçindekiler

- [Genel mimari](#genel-mimari)
- [Aşama 0 — Hazırlık](#aşama-0--hazırlık)
- [Aşama 1 — Proje iskeleti](#aşama-1--proje-iskeleti)
- [Aşama 2 — Veritabanı](#aşama-2--veritabanı)
- [Aşama 3 — Ortak altyapı](#aşama-3--ortak-altyapı)
- [Aşama 4 — Kimlik doğrulama (Auth)](#aşama-4--kimlik-doğrulama-auth)
- [Aşama 5 — Kullanıcı, profil ve hedefler](#aşama-5--kullanıcı-profil-ve-hedefler)
- [Aşama 6 — Cihaz ve kalibrasyon](#aşama-6--cihaz-ve-kalibrasyon)
- [Aşama 7 — Duruş verisi alma](#aşama-7--duruş-verisi-alma)
- [Aşama 8 — İstatistikler](#aşama-8--istatistikler)
- [Aşama 9 — Düşme olayları ve öneriler](#aşama-9--düşme-olayları-ve-öneriler)
- [Aşama 10 — Test ve sürekli entegrasyon](#aşama-10--test-ve-sürekli-entegrasyon)
- [Aşama 11 — Mobil entegrasyon](#aşama-11--mobil-entegrasyon)
- [Aşama 12 — Güvenlik, KVKK ve yayına alma](#aşama-12--güvenlik-kvkk-ve-yayına-alma)
- [Ek A — Uç nokta listesi](#ek-a--uç-nokta-listesi)
- [Ek B — İlerleme özeti](#ek-b--ilerleme-özeti)

---

## Genel mimari

```
ESP32 + IMU  ──BLE──▶  Android uygulaması  ──HTTPS──▶  NestJS  ──▶  PostgreSQL
(eşik + titreşim)      (ML, Room, WorkManager)        (REST API)
```

Temel kurallar:

1. **Titreşim kararı cihazda verilir.** Telefon sadece eşik ayarlarını gönderir.
2. **Ham sensör verisi sunucuya gelmez.** Telefon veriyi işler ve dakikalık
   özetleri toplu olarak gönderir.
3. **Mobil uygulama internetsiz de çalışır.** Veriler önce telefondaki Room
   veritabanına yazılır, bağlantı gelince gönderilir. Bu yüzden sunucu aynı
   paketi iki kez alırsa veriyi iki kez yazmamalıdır.
4. **API sözleşmesi Swagger (OpenAPI) ile üretilir.** Kotlin istemcisi bu
   sözleşmeden otomatik oluşturulur.
5. **Tüm zamanlar veritabanında UTC saklanır.** Günlük istatistikler
   kullanıcının saat dilimine göre (varsayılan `Europe/Istanbul`) hesaplanır.

---

## Aşama 0 — Hazırlık

**Süre:** yarım gün

### İş 0.1 — Araçları kur

- [ ] Node.js'in LTS sürümünü kur (`node -v` ile kontrol et)
- [ ] Docker Desktop'ı kur ve çalıştır (`docker -v`)
- [ ] Git'i kur, adını ve e-postanı ayarla
- [ ] VS Code eklentileri: Oxc (oxlint), Prettier, Prisma, Docker
- [ ] API denemek için Postman, Insomnia ya da Bruno'dan birini kur
- [ ] Veritabanını görmek için DBeaver ya da TablePlus kur

**Bitti sayılır:** `node -v`, `npm -v`, `docker -v` ve `git --version`
komutları sürüm numarası döndürüyor.

### İş 0.2 — Repo aç

- [ ] GitHub'da `kilya-backend` adında private bir repo oluştur
- [ ] Branch düzenini belirle: `main` her zaman çalışır durumda olsun, her iş
      için ayrı bir branch aç (`feat/auth-register` gibi)
- [ ] Commit mesajları için bir kural seç (örnek: `feat:`, `fix:`, `chore:`)

**Bitti sayılır:** Repo var ve bilgisayarına klonlandı.

---

## Aşama 1 — Proje iskeleti

**Süre:** 1 gün

### İş 1.1 — NestJS projesini oluştur

```bash
npm i -g @nestjs/cli
nest new kilya-backend
cd kilya-backend
npm run start:dev
```

- [ ] Paket yöneticisi olarak `npm` seç
- [ ] Tarayıcıda `http://localhost:3000` adresini aç, "Hello World!" görünmeli
- [ ] Örnek `app.controller.ts`, `app.service.ts` ve testini sil

**Bitti sayılır:** `npm run start:dev` hatasız çalışıyor.

### İş 1.2 — Klasör yapısını kur

Modüller ilerledikçe şu yapıya ulaşacaksın:

```
kilya-backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/            ortam değişkenleri ve doğrulaması
│   ├── prisma/            PrismaService ve PrismaModule
│   ├── common/            decorator, guard, filter, yardımcılar
│   ├── generated/prisma/  Prisma'nın ürettiği istemci (git'e eklenmez)
│   ├── health/
│   ├── auth/
│   ├── users/
│   ├── devices/
│   ├── posture/
│   ├── stats/
│   ├── events/
│   └── recommendations/
├── test/                  e2e testleri
├── docker-compose.yml
├── prisma.config.ts
├── .env                   (git'e eklenmez)
└── .env.example
```

- [ ] `src/config`, `src/common`, `src/prisma` klasörlerini oluştur
- [ ] `.gitignore` dosyasına `.env` ve `src/generated` satırlarını ekle

**Bitti sayılır:** Klasörler hazır, ilk commit atıldı.

### İş 1.3 — Ortam değişkenleri

```bash
npm i @nestjs/config zod dotenv
```

- [ ] `.env.example` dosyası oluştur:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://kilya:kilya@localhost:5432/kilya
JWT_ACCESS_SECRET=degistir-uzun-rastgele-bir-deger
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=30
GOOGLE_WEB_CLIENT_ID=
```

- [ ] Bu dosyayı `.env` adıyla kopyala ve değerleri doldur
- [ ] `src/config/env.ts` içinde Zod ile şema yaz:

```ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),
  GOOGLE_WEB_CLIENT_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
export const validateEnv = (config: Record<string, unknown>) =>
  envSchema.parse(config);
```

- [ ] `app.module.ts` içine ekle:

```ts
ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })
```

**Bitti sayılır:** `.env` içinden `JWT_ACCESS_SECRET` silindiğinde uygulama
açılırken anlaşılır bir hata veriyor.

### İş 1.4 — Kod kalitesi

- [ ] Nest'in getirdiği oxlint ve Prettier ayarlarını koru
- [ ] `package.json` içine `"lint"` ve `"format"` script'lerinin çalıştığını
      kontrol et
- [ ] VS Code'da "kaydederken biçimlendir" ayarını aç

**Bitti sayılır:** `npm run lint` hatasız bitiyor.

---

## Aşama 2 — Veritabanı

**Süre:** 1–2 gün

### İş 2.1 — PostgreSQL'i Docker ile çalıştır

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: kilya
      POSTGRES_PASSWORD: kilya
      POSTGRES_DB: kilya
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  db-test:
    image: postgres:16
    environment:
      POSTGRES_USER: kilya
      POSTGRES_PASSWORD: kilya
      POSTGRES_DB: kilya_test
    ports:
      - "5433:5432"

volumes:
  pgdata:
```

- [ ] `docker compose up -d` komutunu çalıştır
- [ ] DBeaver ile `localhost:5432` adresine bağlan
- [ ] `db-test` servisi Aşama 10'daki testler için; şimdilik çalışıyor olması yeterli

**Bitti sayılır:** DBeaver'da `kilya` veritabanı görünüyor.

### İş 2.2 — Prisma'yı kur

Prisma 7 ile kurulum eskisinden biraz farklı. Takılırsan
[Prisma'nın NestJS rehberine](https://www.prisma.io/docs/guides/v7/frameworks/nestjs)
bak.

```bash
npm i -D prisma
npm i @prisma/client @prisma/adapter-pg pg
npx prisma init --output ../src/generated/prisma
```

- [ ] `prisma/schema.prisma` başını şöyle düzenle:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

Not: Güncel Nest projeleri ESM olarak gelir (`package.json` içinde `"type": "module"`),
bu yüzden `moduleFormat` ayarı gerekmez. Projen CommonJS ise generator'a
`moduleFormat = "cjs"` satırını ekle.

- [ ] `prisma.config.ts` dosyasının `.env`'i okuduğundan emin ol:

```ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

**Bitti sayılır:** `npx prisma validate` hatasız bitiyor.

### İş 2.3 — PrismaService ve PrismaModule

- [ ] `src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js'; // ESM'de göreli importlar .js ile biter

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] `src/prisma/prisma.module.ts` içinde `@Global()` bir modül yap ve
      `PrismaService`'i export et
- [ ] `AppModule`'e `PrismaModule`'ü ekle

**Bitti sayılır:** Uygulama açılırken veritabanına bağlanıyor. Docker
kapatıldığında hata veriyor.

### İş 2.4 — Veri modelini yaz

Aşağıdaki şemanın tamamını şimdi yazmak zorunda değilsin. **Şimdilik sadece
`User`, `RefreshToken` ve `PasswordResetToken` modellerini ekle.** Diğerlerini
ilgili aşamaya geldiğinde eklersin. Yine de tüm resmi görmen için şema burada:

```prisma
// ---------- Kullanıcı ve kimlik ----------

model User {
  id           String    @id @default(uuid())
  email        String?   @unique
  passwordHash String?
  googleId     String?   @unique
  isAnonymous  Boolean   @default(false)
  displayName  String?
  birthYear    Int?
  heightCm     Int?
  weightKg     Int?
  timezone     String    @default("Europe/Istanbul")
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?

  refreshTokens  RefreshToken[]
  resetTokens    PasswordResetToken[]
  goals          UserGoal[]
  consents       Consent[]
  devices        Device[]
  calibrations   Calibration[]
  postureMinutes PostureMinute[]
  dailyStats     DailyStat[]
  fallEvents     FallEvent[]
}

model RefreshToken {
  id        String    @id @default(uuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  userAgent String?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ---------- Hedefler ve onaylar ----------

enum GoalType {
  POSTURE      // duruşumu düzeltmek
  BACK_PAIN    // sırt ağrısını azaltmak
  KYPHOSIS     // kifozu önlemek
}

model UserGoal {
  id                 String   @id @default(uuid())
  userId             String
  type               GoalType
  dailyTargetMinutes Int?
  createdAt          DateTime @default(now())
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type])
}

enum ConsentType {
  HEALTH_DATA        // KVKK: sağlık verisinin işlenmesi
  RESEARCH_SHARING   // anonim verinin araştırmada kullanılması
}

model Consent {
  id        String      @id @default(uuid())
  userId    String
  type      ConsentType
  version   String      // onaylanan metnin sürümü, ör. "2026-09"
  grantedAt DateTime    @default(now())
  revokedAt DateTime?
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, type])
}

// ---------- Cihaz ----------

enum VibrationMode {
  OFF
  SOFT
  STRONG
  PATTERN
}

model Device {
  id              String          @id @default(uuid())
  userId          String
  hardwareId      String          @unique  // BLE MAC ya da seri numara
  name            String          @default("Kilya")
  firmwareVersion String?
  lastSeenAt      DateTime?
  createdAt       DateTime        @default(now())
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  settings        DeviceSettings?
  calibrations    Calibration[]
  postureMinutes  PostureMinute[]
  fallEvents      FallEvent[]
}

model DeviceSettings {
  deviceId          String        @id
  angleThresholdDeg Float         @default(20)
  holdSeconds       Int           @default(5)   // bu süreden uzun kötü duruşta titreşim
  vibrationMode     VibrationMode @default(SOFT)
  updatedAt         DateTime      @updatedAt
  device            Device        @relation(fields: [deviceId], references: [id], onDelete: Cascade)
}

model Calibration {
  id        String   @id @default(uuid())
  userId    String
  deviceId  String
  pitchRef  Float    // referans öne-arkaya eğim (derece)
  rollRef   Float    // referans yana eğim (derece)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  device    Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@index([deviceId, isActive])
}

// ---------- Duruş verisi ----------

model PostureMinute {
  id             BigInt   @id @default(autoincrement())
  userId         String
  deviceId       String
  minuteStart    DateTime // UTC, saniyesi 00
  goodSeconds    Int
  badSeconds     Int
  avgPitch       Float
  avgRoll        Float
  score          Int      // 0–100, telefonda hesaplanır
  vibrationCount Int      @default(0)
  regionLoads    Json?    // ör. { "neck": 0.4, "upperBack": 0.7, "lowerBack": 0.2 }
  receivedAt     DateTime @default(now())
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  device         Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@unique([userId, deviceId, minuteStart])  // aynı dakika iki kez yazılmaz
  @@index([userId, minuteStart])
}

model DailyStat {
  userId         String
  date           DateTime @db.Date   // kullanıcının saat dilimine göre gün
  wearSeconds    Int
  goodSeconds    Int
  badSeconds     Int
  avgScore       Int
  vibrationCount Int
  updatedAt      DateTime @updatedAt
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, date])
}

// ---------- Olaylar ve öneriler ----------

model FallEvent {
  id            String    @id @default(uuid())
  userId        String
  deviceId      String
  clientEventId String    @unique   // telefonun ürettiği kimlik, tekrar gönderimi önler
  occurredAt    DateTime
  confidence    Float
  confirmedAt   DateTime?           // kullanıcı "evet düştüm" dediyse
  dismissedAt   DateTime?           // kullanıcı "yanlış alarm" dediyse
  createdAt     DateTime  @default(now())
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  device        Device    @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@index([userId, occurredAt])
}

model Recommendation {
  id        String  @id @default(uuid())
  code      String  @unique   // ör. "NECK_STRETCH_1"
  region    String            // neck, upperBack, lowerBack, shoulders
  minLoad   Float             // bu yük seviyesinin üstünde önerilir
  title     String
  body      String
  isActive  Boolean @default(true)
}
```

- [ ] İlk üç modeli ekle
- [ ] Migration oluştur ve istemciyi üret:

```bash
npx prisma migrate dev --name init_users
npx prisma generate
```

- [ ] `npx prisma studio` ile tabloları görüntüle

**Bitti sayılır:** DBeaver'da `User`, `RefreshToken`, `PasswordResetToken`
tabloları görünüyor.

### İş 2.5 — Seed (örnek veri)

- [ ] `prisma/seed.ts` dosyasında bir test kullanıcısı ve birkaç `Recommendation`
      kaydı oluştur
- [ ] `prisma.config.ts` içine seed komutunu ekle:
      `migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' }`
- [ ] `npm i -D tsx` ve `npx prisma db seed` ile çalıştır

Not: Prisma 7'de `migrate dev` ve `migrate reset` seed'i ve `generate`'i
kendiliğinden çalıştırmaz. Bu yüzden `package.json`'a bir kısayol ekle:

```json
"db:reset": "prisma migrate reset --force && prisma generate && prisma db seed"
```

**Bitti sayılır:** `npm run db:reset` veritabanını sıfırlayıp örnek verileri
yeniden yüklüyor.

---

## Aşama 3 — Ortak altyapı

**Süre:** 1–2 gün

### İş 3.1 — Global ayarlar (`main.ts`)

```bash
npm i class-validator class-transformer helmet
```

- [ ] API'ye önek ve sürüm ekle, adresler `/api/v1/...` şeklinde olsun:

```ts
app.setGlobalPrefix('api');
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
```

- [ ] Global doğrulama:

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // DTO'da olmayan alanları at
    forbidNonWhitelisted: true,   // bilinmeyen alan gelirse hata ver
    transform: true,              // string → number dönüşümleri
  }),
);
```

- [ ] `app.use(helmet())` ekle
- [ ] `app.enableShutdownHooks()` ekle

**Bitti sayılır:** Bilinmeyen bir alanla istek atıldığında 400 dönüyor.

### İş 3.2 — Swagger

```bash
npm i @nestjs/swagger
```

- [ ] `main.ts` içinde:

```ts
const config = new DocumentBuilder()
  .setTitle('Kilya API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('docs', app, document);

if (process.env.NODE_ENV !== 'production') {
  writeFileSync('./openapi.json', JSON.stringify(document, null, 2));
}
```

- [ ] `nest-cli.json` içine Swagger eklentisini ekle; DTO'lara tek tek
      `@ApiProperty` yazmaktan kurtarır:

```json
"compilerOptions": {
  "plugins": [{ "name": "@nestjs/swagger", "options": { "introspectComments": true } }]
}
```

**Bitti sayılır:** `http://localhost:3000/docs` açılıyor, proje kökünde
`openapi.json` oluşuyor.

### İş 3.3 — Loglama

```bash
npm i nestjs-pino pino-http
npm i -D pino-pretty
```

- [ ] `LoggerModule.forRoot()` ekle; geliştirmede `pino-pretty` kullan
- [ ] `Authorization` başlığı ve `password` alanı loglarda gizlensin (`redact`)

**Bitti sayılır:** Her istek terminalde tek satırlık okunaklı bir logla görünüyor,
parolalar loglarda yok.

### İş 3.4 — Hata biçimi

- [ ] `src/common/filters/prisma-exception.filter.ts` yaz:
  - Prisma `P2002` (benzersizlik ihlali) → `409 Conflict`
  - Prisma `P2025` (kayıt bulunamadı) → `404 Not Found`
- [ ] Tüm hatalar aynı biçimde dönsün:

```json
{ "statusCode": 409, "error": "Conflict", "message": "Bu e-posta zaten kayıtlı" }
```

**Bitti sayılır:** Aynı e-postayla iki kez kayıt olunduğunda 500 değil 409 dönüyor.

### İş 3.5 — İstek sınırı

`@nestjs/throttler` henüz NestJS 12'yi desteklemediği için projede kendi
guard'ımız var: `src/common/rate-limit/`.

- [x] Genel sınır: IP ve uç nokta başına dakikada 100 istek (`RateLimitGuard`)
- [x] Auth uç noktaları için daha sıkı sınır: dakikada 10 (forgot-password 5) istek
      (`@RateLimit({ limit: 10, ttlMs: 60_000 })`, Aşama 4'te)

**Bitti sayılır:** Sınırı aşan istekler `429` ve `Retry-After` başlığı alıyor.
Giriş uç noktasına art arda 11 istek atıldığında `429` dönüyor (Aşama 4).

### İş 3.6 — Sağlık kontrolü

```bash
npm i @nestjs/terminus
```

- [x] `GET /api/v1/health` uç noktası yaz; veritabanı bağlantısını kontrol etsin
      (`DatabaseHealthIndicator`; terminus'un hazır `PrismaHealthIndicator`'ı
      hata mesajında veritabanı adresini gösterdiği için kendi göstergemiz var)

**Bitti sayılır:** Docker açıkken `status: ok`, kapalıyken `503` dönüyor.

---

## Aşama 4 — Kimlik doğrulama (Auth)

**Süre:** 1–1,5 hafta. En önemli aşama; acele etme.

**Durum (17 Eylül 2026):** Kod tarafı tamamlandı (4.1–4.8). Açık kalan tek madde
Google Cloud Console'da Web OAuth istemcisi oluşturup `GOOGLE_WEB_CLIENT_ID`'yi
`.env`'e yazmak; o olmadan `/auth/google` 503 döner, diğer her şey çalışır.

Uygulamada yol haritasından farklar:
- Çıkışta refresh token satırı *silinir*, iptal işaretlenmez: uygulama çıkıştan
  sonra yanlışlıkla eski tokenla gelirse çalıntı şüphesiyle diğer cihazların
  oturumları kapanmasın.
- Sıfırlama kodunun hash'ine `userId` katılır (`sha256(userId:kod)`): 6 haneli
  kod iki kullanıcıya aynı düşebilir, `tokenHash` benzersiz.
- Kod tahminine karşı ek deneme sayacı yok; dakikada 10 istek sınırı + 15 dk
  ömür yeterli görüldü (IP başına en çok ~150 deneme / 1.000.000 olasılık).
- `RateLimitGuard.reset()` eklendi; e2e testleri auth sınırını aşıyor.

Arayüzdeki karşılık: karşılama, kayıt formu, giriş, parola sıfırlama,
"hesapsız devam et".

### Token düzeni

| Token | Ömür | Nerede saklanır |
|---|---|---|
| Access token (JWT) | 15 dakika | Telefonun belleğinde |
| Refresh token (rastgele dize) | 30 gün | Telefonda şifreli depoda; sunucuda **sadece hash'i** |

Refresh token her kullanıldığında yenisi verilir, eskisi iptal edilir (rotation).
İptal edilmiş bir token tekrar gelirse o kullanıcının tüm oturumları kapatılır;
bu, çalınmış token kullanımını yakalar.

### İş 4.1 — Paketler ve modül

```bash
npm i @nestjs/jwt argon2 google-auth-library
nest g module auth
nest g controller auth
nest g service auth
nest g module users
nest g service users
```

- [x] `JwtModule.registerAsync` ile secret ve süreyi `ConfigService`'ten al

### İş 4.2 — Global guard ve decorator'lar

- [x] `src/common/guards/jwt-auth.guard.ts`: `Authorization: Bearer ...`
      başlığını doğrular, `request.user` içine `{ id, isAnonymous }` koyar
- [x] Guard'ı `APP_GUARD` ile **tüm uygulamaya** uygula; böylece yeni bir uç
      noktayı korumayı unutamazsın
- [x] `@Public()` decorator'ı: giriş ve kayıt gibi uç noktaları guard'dan muaf tutar
- [x] `@CurrentUser()` decorator'ı: controller'da kullanıcıyı almak için

**Bitti sayılır:** `/health` dışındaki her uç nokta token olmadan `401` dönüyor.

### İş 4.3 — Kayıt ol

`POST /api/v1/auth/register`

- [x] `RegisterDto`: `email` (`@IsEmail`), `password` (en az 8 karakter)
- [x] E-postayı küçük harfe çevir ve boşlukları temizle
- [x] Parolayı `argon2.hash()` ile hash'le
- [x] Kullanıcıyı oluştur, access + refresh token döndür:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "c3f1...",
  "user": { "id": "...", "email": "a@b.com", "isAnonymous": false }
}
```

**Bitti sayılır:** Swagger'dan kayıt olunabiliyor, veritabanında parola düz
metin olarak görünmüyor.

### İş 4.4 — Token üretimi ve yenileme

- [x] `TokenService` yaz:
  - `issueTokens(user)`: JWT imzalar, 32 baytlık rastgele refresh token üretir
    (`crypto.randomBytes`), SHA-256 hash'ini veritabanına yazar
  - `rotate(refreshToken)`: hash'i bulur, süresi ve iptal durumu kontrol edilir,
    eskisini iptal edip yenisini verir
- [x] `POST /api/v1/auth/refresh` → `{ refreshToken }` alır, yeni çift döndürür
- [x] İptal edilmiş token tekrar gelirse kullanıcının tüm refresh token'larını iptal et

**Bitti sayılır:** Aynı refresh token ikinci kez kullanıldığında `401` dönüyor
ve kullanıcının diğer oturumları da kapanıyor.

### İş 4.5 — Giriş ve çıkış

- [x] `POST /api/v1/auth/login` → e-posta ve parolayı `argon2.verify()` ile kontrol et
- [x] Hata mesajı her durumda aynı olsun: "E-posta veya parola hatalı"
      (hangi e-postaların kayıtlı olduğu dışarıya sızmasın)
- [x] `POST /api/v1/auth/logout` → gönderilen refresh token'ı iptal et

**Bitti sayılır:** Yanlış parola ve kayıtlı olmayan e-posta aynı yanıtı veriyor.

### İş 4.6 — Google ile giriş

Android tarafı Credential Manager ile bir **ID token** alır ve sunucuya gönderir.

`POST /api/v1/auth/google` → `{ idToken }`

- [ ] (Gizem) Google Cloud Console'da bir **Web** OAuth istemcisi oluştur; Client ID'yi
      `GOOGLE_WEB_CLIENT_ID` olarak kaydet (Android uygulaması da bunu
      `serverClientId` olarak kullanacak)
- [x] Token'ı doğrula:

```ts
const ticket = await this.googleClient.verifyIdToken({
  idToken,
  audience: this.config.get('GOOGLE_WEB_CLIENT_ID'),
});
const payload = ticket.getPayload(); // sub, email, email_verified, name
```

- [x] Kullanıcı bulma sırası:
  1. `googleId = sub` olan kullanıcı varsa → giriş yap
  2. Yoksa ve `email_verified` doğruysa, aynı e-postalı kullanıcı varsa →
     hesaba `googleId` ekle
  3. Hiçbiri yoksa → yeni kullanıcı oluştur

**Bitti sayılır:** Geçersiz ya da başka uygulamaya ait token `401` dönüyor.

### İş 4.7 — Hesapsız kullanım (anonim kullanıcı)

- [x] `POST /api/v1/auth/anonymous` → `isAnonymous: true` bir kullanıcı
      oluştur, token döndür
- [x] `POST /api/v1/auth/upgrade` (giriş yapmış anonim kullanıcı için) →
      `{ email, password }` ya da `{ idToken }` alır, **aynı kullanıcı kaydını**
      günceller; böylece önceki duruş verileri kaybolmaz
- [x] Anonim kullanıcının e-postası zaten başka bir hesaptaysa `409` dön
- [x] 90 gün hiç veri göndermemiş anonim hesapları temizleyen bir zamanlanmış
      görev için not al (Aşama 12)

**Bitti sayılır:** Anonim kullanıcı veri gönderip sonra kayıt olduğunda verileri
aynı `userId` altında duruyor.

### İş 4.8 — Parola sıfırlama

```bash
npm i nodemailer
npm i -D @types/nodemailer
```

- [x] Geliştirmede e-postaları görmek için `docker-compose.yml`'a **Mailpit**
      ekle (`axllent/mailpit`, arayüz: `localhost:8025`)
- [x] `POST /api/v1/auth/forgot-password` → `{ email }`
  - Kullanıcı olsun olmasın **her zaman 204** dön
  - Varsa 6 haneli kod ya da rastgele token üret, hash'ini 15 dakika ömürle kaydet,
    e-posta gönder
- [x] `POST /api/v1/auth/reset-password` → `{ email, code, newPassword }`
  - Kodu doğrula, parolayı güncelle, token'ı kullanılmış işaretle
  - Kullanıcının tüm refresh token'larını iptal et

**Bitti sayılır:** Mailpit'te gelen kodla parola değiştirilebiliyor, kod ikinci
kez kullanılamıyor.

---

## Aşama 5 — Kullanıcı, profil ve hedefler

**Süre:** 3–4 gün

Arayüzdeki karşılık: hedef seçimi, kayıt tamamlandı, profil ekranı.

### İş 5.1 — Profil

```bash
nest g resource users --no-spec
```

- [ ] `GET /api/v1/me` → kullanıcı bilgisi (parola hash'i asla dönmesin; yanıt
      için ayrı bir `UserResponseDto` kullan)
- [ ] `PATCH /api/v1/me` → `displayName`, `birthYear`, `heightCm`, `weightKg`,
      `timezone`
- [ ] `timezone` için geçerli IANA adı mı diye kontrol et
      (`Intl.supportedValuesOf('timeZone')`)
- [ ] `POST /api/v1/me/change-password` → mevcut parolayı doğrula, yenisini kaydet

**Bitti sayılır:** Profil güncellenip tekrar okunabiliyor; yanıtta `passwordHash` yok.

### İş 5.2 — Hedefler

- [ ] `UserGoal` modelini şemaya ekle, migration çalıştır
- [ ] `GET /api/v1/me/goals`
- [ ] `PUT /api/v1/me/goals` → `{ goals: [{ type: "POSTURE", dailyTargetMinutes: 240 }] }`
      listesinin tamamını değiştirir (transaction içinde sil + ekle)

**Bitti sayılır:** Onboarding'deki hedef seçimi kaydedilip okunabiliyor.

### İş 5.3 — KVKK onayları

- [ ] `Consent` modelini ekle
- [ ] `GET /api/v1/me/consents`
- [ ] `POST /api/v1/me/consents` → `{ type, version }`
- [ ] `DELETE /api/v1/me/consents/:type` → `revokedAt` doldurur
- [ ] Bir guard ya da servis kontrolü yaz: `HEALTH_DATA` onayı olmayan kullanıcı
      duruş verisi gönderemesin (`403`)

**Bitti sayılır:** Onay vermemiş kullanıcının veri gönderme isteği reddediliyor.

### İş 5.4 — Hesap silme ve veri dışa aktarma

- [ ] `DELETE /api/v1/me` → kullanıcıyı ve tüm verilerini sil
      (`onDelete: Cascade` sayesinde tek sorgu)
- [ ] `GET /api/v1/me/export` → kullanıcının tüm verilerini JSON olarak döndür

**Bitti sayılır:** Silinen kullanıcının hiçbir tabloda kaydı kalmıyor.

---

## Aşama 6 — Cihaz ve kalibrasyon

**Süre:** 3–4 gün

Arayüzdeki karşılık: cihaz bağlantısı, Bluetooth izni, kalibrasyon.

### İş 6.1 — Cihaz kaydı

- [ ] `Device` ve `DeviceSettings` modellerini ekle, migration çalıştır
- [ ] `nest g resource devices`
- [ ] `POST /api/v1/devices` → `{ hardwareId, name?, firmwareVersion? }`
  - Cihaz yoksa oluştur ve varsayılan `DeviceSettings` kaydını da ekle
  - Cihaz aynı kullanıcıdaysa bilgilerini güncelle
  - Cihaz başka bir kullanıcıdaysa `409` dön (ileride "cihazı devral" akışı eklenebilir)
- [ ] `GET /api/v1/devices` → kullanıcının cihazları
- [ ] `PATCH /api/v1/devices/:id` → ad, firmware sürümü
- [ ] `DELETE /api/v1/devices/:id` → eşleştirmeyi kaldır

**Önemli:** Her sorguda `where: { id, userId }` kullan. Bir kullanıcı başkasının
cihaz kimliğini bilse bile ona erişememeli. Bulunamazsa `404` dön.

**Bitti sayılır:** Kullanıcı A, kullanıcı B'nin cihazına erişmeye çalıştığında
`404` alıyor.

### İş 6.2 — Cihaz ayarları

- [ ] `GET /api/v1/devices/:id/settings`
- [ ] `PUT /api/v1/devices/:id/settings` →
      `{ angleThresholdDeg, holdSeconds, vibrationMode }`
- [ ] Sınırları doğrula: eşik 5–45 derece, süre 1–60 saniye
- [ ] Yanıtta `updatedAt` dön; telefon bu değere bakarak ayarları ESP32'ye tekrar
      gönderip göndermeyeceğine karar verir

**Bitti sayılır:** Aralık dışı değerler `400` dönüyor.

### İş 6.3 — Kalibrasyon

- [ ] `Calibration` modelini ekle
- [ ] `POST /api/v1/devices/:id/calibrations` → `{ pitchRef, rollRef }`
  - Transaction içinde: o cihazın önceki kalibrasyonlarını `isActive: false`
    yap, yenisini `isActive: true` ekle
- [ ] `GET /api/v1/devices/:id/calibrations/active`
- [ ] `GET /api/v1/devices/:id/calibrations` → geçmiş (son 20)

**Bitti sayılır:** Bir cihazın aynı anda yalnızca bir aktif kalibrasyonu oluyor.

---

## Aşama 7 — Duruş verisi alma

**Süre:** 4–5 gün. Sistemin kalbi; performans ve güvenilirlik burada önemli.

### İş 7.1 — Model

- [ ] `PostureMinute` modelini ekle, migration çalıştır
- [ ] `nest g module posture`, `controller`, `service`

### İş 7.2 — Toplu gönderim uç noktası

`POST /api/v1/posture/batch`

```json
{
  "deviceId": "8c1f...",
  "minutes": [
    {
      "minuteStart": "2026-09-16T09:15:00Z",
      "goodSeconds": 48,
      "badSeconds": 12,
      "avgPitch": 14.2,
      "avgRoll": -2.1,
      "score": 78,
      "vibrationCount": 1,
      "regionLoads": { "neck": 0.3, "upperBack": 0.6, "lowerBack": 0.2 }
    }
  ]
}
```

- [ ] DTO doğrulamaları:
  - `minutes` en az 1, en fazla 500 eleman (`@ArrayMaxSize(500)`,
    `@ValidateNested`, `@Type(() => MinuteDto)`)
  - `goodSeconds + badSeconds <= 60`
  - `score` 0–100
  - `minuteStart` saniyesi 0 olmalı, gelecekte olmamalı, 30 günden eski olmamalı
- [ ] Cihazın bu kullanıcıya ait olduğunu kontrol et
- [ ] `HEALTH_DATA` onayını kontrol et (İş 5.3)
- [ ] Kaydet — tekrar gelen dakikalar sessizce atlansın:

```ts
const result = await this.prisma.postureMinute.createMany({
  data: rows,
  skipDuplicates: true,   // @@unique([userId, deviceId, minuteStart]) sayesinde
});
```

- [ ] `Device.lastSeenAt` alanını güncelle
- [ ] Yanıt:

```json
{ "received": 60, "inserted": 58, "duplicates": 2 }
```

**Bitti sayılır:** Aynı paket iki kez gönderildiğinde ikincisinde
`inserted: 0` dönüyor ve tabloda kopya yok.

### İş 7.3 — İstek boyutu ve performans

- [ ] `main.ts` içinde JSON gövde sınırını ayarla (ör. 1 MB)
- [ ] 500 dakikalık bir paketi Postman ile gönder, süreyi ölç
      (hedef: 300 ms altı)
- [ ] `@@index([userId, minuteStart])` indeksinin sorgu planında kullanıldığını
      `EXPLAIN ANALYZE` ile kontrol et

**Bitti sayılır:** 500 kayıtlık paket hedef sürenin altında işleniyor.

### İş 7.4 — Ham veriyi okuma

- [ ] `GET /api/v1/posture/minutes?from=...&to=...` → belirli aralıktaki
      dakikalar (en fazla 24 saatlik aralık; grafik detayı için)

**Bitti sayılır:** 24 saatten uzun aralık istendiğinde `400` dönüyor.

---

## Aşama 8 — İstatistikler

**Süre:** 4–5 gün

Arayüzdeki karşılık: ana ekrandaki duruş skoru (72/100), istatistik ekranı
(günlük ve haftalık ilerleme).

### İş 8.1 — Günlük özet tablosu

- [ ] `DailyStat` modelini ekle
- [ ] `StatsService.recomputeDays(userId, dates[])` yaz. Toplu gönderimden
      sonra etkilenen günler için çağrılır. Hesaplama tek bir SQL sorgusuyla
      yapılır:

```sql
INSERT INTO "DailyStat"
  ("userId", "date", "wearSeconds", "goodSeconds", "badSeconds",
   "avgScore", "vibrationCount", "updatedAt")
SELECT
  pm."userId",
  (pm."minuteStart" AT TIME ZONE u."timezone")::date AS day,
  SUM(pm."goodSeconds" + pm."badSeconds"),
  SUM(pm."goodSeconds"),
  SUM(pm."badSeconds"),
  ROUND(AVG(pm."score")),
  SUM(pm."vibrationCount"),
  NOW()
FROM "PostureMinute" pm
JOIN "User" u ON u."id" = pm."userId"
WHERE pm."userId" = $1
  AND pm."minuteStart" >= $2   -- en erken günün başlangıcı (UTC)
  AND pm."minuteStart" <  $3   -- en geç günün bitişi (UTC)
GROUP BY pm."userId", day
ON CONFLICT ("userId", "date") DO UPDATE SET
  "wearSeconds"    = EXCLUDED."wearSeconds",
  "goodSeconds"    = EXCLUDED."goodSeconds",
  "badSeconds"     = EXCLUDED."badSeconds",
  "avgScore"       = EXCLUDED."avgScore",
  "vibrationCount" = EXCLUDED."vibrationCount",
  "updatedAt"      = NOW();
```

- [ ] Prisma'da `$executeRaw` ile çalıştır (parametreli; string birleştirme yapma)
- [ ] Toplu gönderim servisinin sonunda çağır

**Bitti sayılır:** İstanbul saatiyle 23:59 ve 00:01'e ait iki dakika farklı
günlere yazılıyor.

### İş 8.2 — Bugün (ana ekran)

- [ ] `GET /api/v1/stats/today` →

```json
{
  "date": "2026-09-16",
  "score": 72,
  "wearMinutes": 312,
  "goodRatio": 0.81,
  "vibrationCount": 14,
  "goalProgress": { "targetMinutes": 240, "goodMinutes": 253 },
  "regionLoads": { "neck": 0.35, "upperBack": 0.58, "lowerBack": 0.21 }
}
```

- [ ] `regionLoads`, bugünkü dakikaların `regionLoads` ortalamasıdır
      (kas yükü haritası için)

### İş 8.3 — Aralık ve haftalık

- [ ] `GET /api/v1/stats/daily?from=2026-09-01&to=2026-09-30` → günlük liste
      (en fazla 366 gün)
- [ ] `GET /api/v1/stats/weekly?weeks=8` → hafta başına ortalama skor ve toplam
      süre (`date_trunc('week', "date")`)
- [ ] Veri olmayan günler de listede `null` değerlerle dönsün; grafikte boşluk
      doğru görünür (`generate_series` kullan)

**Bitti sayılır:** İstatistik ekranındaki grafikler bu uç noktalarla
çizilebiliyor.

### İş 8.4 — Tutarlılık görevi

```bash
npm i @nestjs/schedule
```

- [ ] Her gece 03:00'te (İstanbul) önceki 2 günün `DailyStat` kayıtlarını
      yeniden hesaplayan bir `@Cron` görevi yaz. Geç gelen verileri yakalar.

**Bitti sayılır:** Görev elle tetiklendiğinde hatasız bitiyor.

---

## Aşama 9 — Düşme olayları ve öneriler

**Süre:** 3–4 gün

### İş 9.1 — Düşme olayları

- [ ] `FallEvent` modelini ekle
- [ ] `nest g resource events`
- [ ] `POST /api/v1/events/falls` → `{ clientEventId, deviceId, occurredAt, confidence }`
  - `clientEventId` sayesinde aynı olay iki kez kaydedilmez
- [ ] `PATCH /api/v1/events/falls/:id` → `{ status: "confirmed" | "dismissed" }`
- [ ] `GET /api/v1/events/falls?from=&to=`

Not: "yanlış alarm" işaretlenen olaylar modelin yeniden eğitimi için değerli
etiketlerdir.

**Bitti sayılır:** Aynı `clientEventId` ile ikinci istek yeni kayıt oluşturmuyor.

### İş 9.2 — Öneriler (kural tabanlı ilk sürüm)

- [ ] `Recommendation` modelini ekle, seed ile 10–15 öneri yükle
      (boyun, üst sırt, bel, omuz esneme ve egzersizleri)
- [ ] `GET /api/v1/recommendations/today` → bugünkü `regionLoads` değerlerine
      göre `minLoad` eşiğini aşan bölgeler için en fazla 3 öneri döndür
- [ ] Öneri metinlerini bir fizyoterapiste kontrol ettir

**Bitti sayılır:** Üst sırt yükü yüksek bir kullanıcıya üst sırt önerileri geliyor.

---

## Aşama 10 — Test ve sürekli entegrasyon

**Süre:** sürekli; ayrıca 3–4 günlük toplu çalışma

Test yazmayı sona bırakma. Her aşamada o aşamanın testlerini de yaz; bu
aşama eksikleri tamamlamak ve otomasyonu kurmak içindir.

### İş 10.1 — Birim testleri (Vitest)

Öncelik sırası:

- [ ] `TokenService`: token üretimi, rotation, iptal edilmiş token'ın yakalanması
- [ ] `AuthService`: kayıt, giriş, Google akışının üç durumu, anonim yükseltme
- [ ] `PostureService`: DTO sınırları, tekrarların atlanması
- [ ] `StatsService`: saat dilimi sınırı (gece yarısı)

### İş 10.2 — E2E testleri

```bash
npm i -D supertest @types/supertest
```

- [ ] `.env.test` oluştur (`DATABASE_URL` → `localhost:5433/kilya_test`)
- [ ] Testlerden önce `prisma migrate reset --force` çalıştır (`.env.test`
      değerleriyle; `npm i -D dotenv-cli` kurup `dotenv -e .env.test --` önekiyle)
- [ ] Senaryolar:
  1. Kayıt → giriş → `/me` → çıkış
  2. Anonim kullanıcı → veri gönder → kayıt ol → veriler duruyor
  3. Cihaz ekle → kalibrasyon → toplu veri → `/stats/today`
  4. Başka kullanıcının cihazına erişim → `404`

**Bitti sayılır:** `npm run test:e2e` temiz bir veritabanında baştan sona geçiyor.

### İş 10.3 — GitHub Actions

- [ ] `.github/workflows/ci.yml`: her push ve PR'da
  - PostgreSQL servisini başlat
  - `npm ci` → `npm run lint` → `npx prisma migrate deploy` → `npm test` →
    `npm run test:e2e` → `npm run build`
- [ ] `main` branch'ine doğrudan push'u kapat, PR zorunlu olsun

**Bitti sayılır:** PR'larda yeşil tik görünüyor.

---

## Aşama 11 — Mobil entegrasyon

**Süre:** 2–3 gün (mobil geliştirmeyle paralel)

### İş 11.1 — Kotlin istemcisini üret

- [ ] `openapi.json` dosyasını mobil projeye kopyala (ya da iki repo arasında
      bir script ile eşitle)
- [ ] Android projesinde OpenAPI Generator Gradle eklentisini kur:
  - `generatorName = "kotlin"`
  - `library = "jvm-retrofit2"`
  - `serializationLibrary = "kotlinx_serialization"`
- [ ] Üretilen modelleri elle değiştirme; API değişince yeniden üret

**Bitti sayılır:** Android projesi üretilen istemciyle derleniyor.

### İş 11.2 — Mobil ile anlaşılacak kurallar

- [ ] Access token süresi dolunca (`401`) istemci bir kez `/auth/refresh`
      denesin; o da başarısız olursa giriş ekranına dönsün (OkHttp `Authenticator`)
- [ ] WorkManager toplu gönderimi en fazla 500 dakikalık paketlerle yapsın;
      `2xx` gelince Room'daki kayıtları "gönderildi" işaretlesin
- [ ] `429` ve `5xx` yanıtlarında üstel bekleme ile tekrar denesin
- [ ] Tüm tarih alanları ISO 8601 ve UTC (`Z` ile biten) olsun

### İş 11.3 — Telefondan yerel sunucuya bağlan

- [ ] Emülatörden bilgisayardaki sunucuya `http://10.0.2.2:3000` ile eriş
- [ ] Gerçek telefondan erişmek için bilgisayarın yerel IP'sini kullan ya da
      `ngrok` gibi bir tünel aç
- [ ] Geliştirme sürümünde HTTP'ye izin veren `network_security_config` ekle
      (yayın sürümünde kapalı olsun)

**Bitti sayılır:** Emülatörden kayıt olunup veri gönderilebiliyor.

---

## Aşama 12 — Güvenlik, KVKK ve yayına alma

**Süre:** 1 hafta

### İş 12.1 — Güvenlik kontrol listesi

- [ ] Tüm gizli değerler `.env`'de; repoda hiçbir secret yok
      (`git log` içinde de aranmalı)
- [ ] `npm audit` ile bilinen açıkları kontrol et
- [ ] Her sorguda `userId` filtresi var mı, tek tek gözden geçir
- [ ] Yanıtlarda `passwordHash`, `tokenHash` gibi alanlar hiç dönmüyor
- [ ] Hata yanıtlarında yığın izi (stack trace) üretim ortamında gizli
- [ ] Parola sıfırlama ve giriş uç noktalarında istek sınırı açık

### İş 12.2 — KVKK

Bu bir hukuki görüş değildir; yayına çıkmadan önce bir uzmana danış.

- [ ] Aydınlatma metni ve açık rıza metnini hazırla; sürüm numarası ver
      (`Consent.version`)
- [ ] Sunucunun ve veritabanının hangi ülkede olduğuna karar ver; yurt dışına
      veri aktarımının ayrı kuralları var
- [ ] Veritabanı disk şifrelemesi açık bir sağlayıcı seç
- [ ] Veri saklama süresi belirle; süresi dolan verileri silen bir `@Cron` görevi yaz
- [ ] 90 gün pasif kalan anonim hesapları silen görevi yaz (İş 4.7)
- [ ] Araştırma için dışa aktarılan verilerde kimlik bilgisi olmasın
      (`userId` yerine rastgele bir takma kimlik)

### İş 12.3 — Docker imajı

- [ ] Çok aşamalı `Dockerfile` yaz:
  1. `build` aşaması: `npm ci`, `npx prisma generate`, `npm run build`
  2. `runtime` aşaması: sadece `dist`, `node_modules` (üretim), `prisma` klasörü
- [ ] Konteyner başlarken önce `npx prisma migrate deploy`, sonra
      `node dist/main.js` çalışsın
- [ ] `.dockerignore` ekle (`node_modules`, `.env`, `test`)

**Bitti sayılır:** `docker build` ve `docker run` ile uygulama yerelde ayağa kalkıyor.

### İş 12.4 — Yayına alma

- [ ] Barındırma seç: Railway, Render, Fly.io ya da Türkiye'de bir VPS
      (KVKK kararına göre)
- [ ] Yönetilen PostgreSQL oluştur
- [ ] Ortam değişkenlerini sağlayıcının panelinden gir
      (`JWT_ACCESS_SECRET` üretimde yeni ve uzun olsun)
- [ ] Alan adı bağla, HTTPS açık olsun
- [ ] Üretimde Swagger'ı kapat ya da parola ile koru

**Bitti sayılır:** `https://api.<alanadi>/api/v1/health` `ok` dönüyor.

### İş 12.5 — Yedekleme ve izleme

- [ ] Günlük otomatik yedek aç (sağlayıcı sunuyorsa) ya da `pg_dump` ile
      zamanlanmış yedek al
- [ ] Bir yedeği boş bir veritabanına **geri yükleyip** dene
- [ ] Hata takibi için Sentry ekle (`@sentry/nestjs`)
- [ ] `/health` için bir çalışma süresi izleyicisi kur (UptimeRobot gibi)

**Bitti sayılır:** Yedekten geri yükleme en az bir kez başarıyla denendi.

---

## Ek A — Uç nokta listesi

Tüm adresler `/api/v1` ile başlar. 🔓 = token gerekmez.

| Yöntem | Adres | Açıklama | Aşama |
|---|---|---|---|
| GET | `/health` 🔓 | Sağlık kontrolü | 3 |
| POST | `/auth/register` 🔓 | E-posta ile kayıt | 4 |
| POST | `/auth/login` 🔓 | Giriş | 4 |
| POST | `/auth/refresh` 🔓 | Token yenileme | 4 |
| POST | `/auth/logout` | Çıkış | 4 |
| POST | `/auth/google` 🔓 | Google ile giriş | 4 |
| POST | `/auth/anonymous` 🔓 | Hesapsız devam et | 4 |
| POST | `/auth/upgrade` | Anonim hesabı kalıcı yap | 4 |
| POST | `/auth/forgot-password` 🔓 | Sıfırlama kodu iste | 4 |
| POST | `/auth/reset-password` 🔓 | Parolayı sıfırla | 4 |
| GET | `/me` | Profil | 5 |
| PATCH | `/me` | Profili güncelle | 5 |
| POST | `/me/change-password` | Parola değiştir | 5 |
| DELETE | `/me` | Hesabı sil | 5 |
| GET | `/me/export` | Verileri dışa aktar | 5 |
| GET / PUT | `/me/goals` | Hedefler | 5 |
| GET / POST | `/me/consents` | Onaylar | 5 |
| DELETE | `/me/consents/:type` | Onayı geri al | 5 |
| GET / POST | `/devices` | Cihazlar | 6 |
| PATCH / DELETE | `/devices/:id` | Cihaz güncelle / kaldır | 6 |
| GET / PUT | `/devices/:id/settings` | Eşik ve titreşim ayarları | 6 |
| GET / POST | `/devices/:id/calibrations` | Kalibrasyonlar | 6 |
| GET | `/devices/:id/calibrations/active` | Aktif kalibrasyon | 6 |
| POST | `/posture/batch` | Dakikalık özetleri gönder | 7 |
| GET | `/posture/minutes` | Dakika detayları | 7 |
| GET | `/stats/today` | Ana ekran | 8 |
| GET | `/stats/daily` | Günlük istatistik | 8 |
| GET | `/stats/weekly` | Haftalık istatistik | 8 |
| GET / POST | `/events/falls` | Düşme olayları | 9 |
| PATCH | `/events/falls/:id` | Olayı onayla / reddet | 9 |
| GET | `/recommendations/today` | Günün önerileri | 9 |

---

## Ek B — İlerleme özeti

| Aşama | Konu | Tahmini süre | Durum |
|---|---|---|---|
| 0 | Hazırlık | yarım gün | ✅ |
| 1 | Proje iskeleti | 1 gün | ✅ |
| 2 | Veritabanı | 1–2 gün | ✅ |
| 3 | Ortak altyapı | 1–2 gün | ✅ |
| 4 | Kimlik doğrulama | 1–1,5 hafta | ✅ (Google Client ID bekliyor) |
| 5 | Kullanıcı, profil, hedefler | 3–4 gün | ☐ |
| 6 | Cihaz ve kalibrasyon | 3–4 gün | ☐ |
| 7 | Duruş verisi alma | 4–5 gün | ☐ |
| 8 | İstatistikler | 4–5 gün | ☐ |
| 9 | Düşme olayları ve öneriler | 3–4 gün | ☐ |
| 10 | Test ve CI | sürekli + 3–4 gün | ☐ |
| 11 | Mobil entegrasyon | 2–3 gün | ☐ |
| 12 | Güvenlik, KVKK, yayına alma | 1 hafta | ☐ |

**Toplam:** yaklaşık 7–9 hafta.

### İlk kilometre taşı

Aşama 0–4 bittiğinde: kayıt, giriş, Google girişi ve anonim kullanım
çalışıyor; hepsi Swagger'da görünüyor ve test ediliyor. Mobil tarafla
entegrasyona bu noktada başlanabilir.
