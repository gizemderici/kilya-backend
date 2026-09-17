# Kilya — ortak durum ve görev devri

Son kontrol: 17 Eylül 2026, Claude Code (Aşama 5 sonrası).
İncelenen commit: `23a6362`, branch: `main`.
İnceleme başlangıcında çalışma ağacı temizdi.

## Çalışma yöntemi

Bu belge Claude Code ile Codex arasında dosya üzerinden bağlam aktarır.
Doğrudan oturum bağlantısı, otomatik senkronizasyon veya kilit sağlamaz.
Her araç işe başlamadan belgeyi ve güncel Git durumunu yeniden okumalıdır.
Bir görevin sahibi değiştirilmeden aynı dosyalarda ikinci çalışma başlamamalıdır.

## Görev durumu

| Araç | Görev | Dosyalar | Durum |
|---|---|---|---|
| Codex | İlk inceleme ve ortak çalışma belgeleri | AGENTS.md, CLAUDE.md, docs/ISBIRLIGI.md | Tamamlandı |
| Codex | Veritabanı mimarisi ve veri sözlüğü | docs/VERITABANI.md, docs/ISBIRLIGI.md | Tamamlandı |
| Claude Code | Aşama 4 — Kimlik doğrulama (4.1–4.8) | src/auth/**, src/users/**, src/mail/**, src/common/guards/**, src/common/decorators/**, src/types/express.d.ts, src/health/health.controller.ts, src/app.module.ts, src/config/env.ts, src/common/rate-limit/rate-limit.guard.ts (reset), docker-compose.yml (Mailpit), package.json/package-lock.json, .env.example, test/auth.e2e-spec.ts, test/app.e2e-spec.ts | Tamamlandı — main `de200b2` |
| Claude Code | Aşama 5 — Kullanıcı, profil, hedefler, onaylar (5.1–5.4) | prisma/schema.prisma + yeni migration (UserGoal, Consent), prisma/seed.ts, src/users/**, src/common/guards/consent.guard.ts, src/common/decorators/**, src/app.module.ts, test/users.e2e-spec.ts, docs/yol-haritasi.md, docs/ISBIRLIGI.md | Tamamlandı — main `23a6362` |

Claude Code Aşama 5 işini bitirdi; sıradaki iş Aşama 6 (cihaz ve kalibrasyon)
için henüz sahip atanmadı. Codex tamamlanan değişiklikleri inceler ve test
açıklarını bildirir. İki tarafın kod yazacağı görevlerde önce dosya kapsamı bu
tabloda belirlenir.

Çalışma biçimi (Claude Code): her iş için `feat/<modül>-*` branch'i, iş bitince
`main`'e fast-forward merge ve push. Ara durum bu belgede güncellenir.

## Doğrulanan mevcut durum

- NestJS 12, TypeScript ESM, Prisma 7 ve PostgreSQL 17 altyapısı var.
- Ortam doğrulama, Helmet, DTO doğrulama, Pino loglama, Prisma hata filtresi,
  bellekte istek sınırı, Swagger ve veritabanı sağlık kontrolü uygulanmış.
- User, RefreshToken ve PasswordResetToken modelleri ile ilk migration var.
- Yol haritasında Aşama 0–3 tamamlandı; Aşama 4 (kimlik doğrulama) sırada.
- Auth controller/service, profil, cihaz, kalibrasyon ve duruş modülleri henüz yok.
- `npm test`: 2 dosyada 9 test geçti.
- `npm run lint` ve `npx tsc --noEmit --incremental false`: hata olmadan tamamlandı.
- E2E testleri ve çalışan API/veritabanı bağlantısı bu incelemede çalıştırılmadı.
- Uygulama kaynak kodu ve veritabanı bu incelemede değiştirilmedi.

## Takip edilecek noktalar

1. `test/app.e2e-spec.ts` geliştirme `.env` veritabanına test kullanıcısı yazar
   ve sonrasında siler. Compose içinde `db-test` (5433) var; e2e yapılandırması
   henüz buraya ayrılmamış. İzole test veritabanı bağlantısı ve migration
   hazırlığı eklenmeli.
2. README hâlâ Nest başlangıç şablonu. Projeye özel kurulum, veritabanı,
   migration ve test adımlarıyla güncellenmeli.
3. İstek sınırı bellekte tutuluyor. Birden çok API instance'ı ve proxy arkasında
   dağıtım öncesi ortak sayaç deposu ve güvenilir proxy ayarı ele alınmalı.
4. `docs/yol-haritasi.md` ile üst klasördeki `Yol Haritasi/yol-haritasi1.md`
   inceleme anında aynı. İlerleme için backend içindeki belge esas alınmalı;
   diğer kopyanın güncelliği ayrıca takip edilmeli.

## Görev devri kaydı biçimi

Her işte araç, görev, dosya kapsamı, başlangıç commit'i, durum, değişiklikler,
çalıştırılan kontroller ve sıradaki adım yazılır. Sırlar veya oturum dökümleri
bu belgeye kopyalanmaz.

## Son görev kaydı — veritabanı belgelendirmesi

- Başlangıç commit'i: `5db1a4d`
- Eklenen belge: `docs/VERITABANI.md`
- Mevcut üç tablo ile yol haritasındaki hedef şema ayrı ayrı belgelendi.
- Veri sözlüğü, ilişkiler, veri akışı, yerel kullanım ve önceliklendirilmiş
  veritabanı önerileri eklendi.
- Prisma şeması, migration veya çalışan veritabanı değiştirilmedi.
- Doğrulama: `git diff --check`; dokümandaki tablo/model adları Prisma şeması
  ve yol haritasıyla karşılaştırıldı.

## Son görev kaydı — Aşama 4 kimlik doğrulama (Claude Code)

- Başlangıç commit'i: `5db1a4d`; bitiş: `de200b2` (main, push edildi)
- Her alt iş ayrı `feat/auth-*` branch'inde yapılıp main'e fast-forward alındı:
  7ce1255 (4.1–4.2), 1d590d0 (4.3), 2b806b2 (4.4), e9705ca (4.5), fa1aa9e (4.6),
  2fe26dc (4.7), de200b2 (4.8)
- Uç noktalar: register, login, logout, refresh, google, anonymous, upgrade,
  forgot-password, reset-password (tümü `/api/v1/auth/...`, Swagger'da)
- Yeni modüller: UsersModule (UsersService), MailModule (nodemailer; Mailpit)
- Şema/migration değişmedi. package.json: @nestjs/jwt, google-auth-library,
  nodemailer (+ @types/nodemailer). Env: SMTP_HOST/PORT/USER/PASS, MAIL_FROM.
- Kontroller: `npm test` 75 geçti (8 dosya), `npm run test:e2e` 38 geçti
  (2 dosya, geliştirme veritabanına yazıp temizler), `npm run lint` ve
  `npx tsc --noEmit --incremental false` temiz, `npm run build` temiz.
  Canlı doğrulama: kayıt/giriş/refresh/rate limit ve Mailpit ile sıfırlama akışı.
- Açık: Google Cloud Console Web OAuth istemcisi (kullanıcı), Aşama 12 için
  90 günlük anonim hesap temizliği notu kodda.
- Codex için inceleme önerisi: src/auth/token.service.ts (rotation + çalıntı
  tespiti), src/auth/password-reset.service.ts, test/auth.e2e-spec.ts.
- Sıradaki iş: Aşama 5 — kullanıcı, profil ve hedefler (UserGoal, Consent
  modelleri → migration). Sahibi belirlenmeli.

## Son görev kaydı — Aşama 5 kullanıcı, profil, hedefler, onaylar (Claude Code)

- Başlangıç: `707b4b8`; bitiş: `23a6362` (main, push edildi)
- Branch'ler: feat/users-profile (57bb0ff), feat/users-goals (7a80ee5),
  feat/users-consents (013daa1), feat/users-delete-export (23a6362)
- Şema: GoalType, UserGoal, ConsentType, Consent; migration
  `20260917112316_user_goals_consents` (geliştirme DB'sine uygulandı)
- Uç noktalar: GET/PATCH/DELETE /me, POST /me/change-password, GET /me/export,
  GET/PUT /me/goals, GET/POST /me/consents, DELETE /me/consents/:type
- Ortak: TokenModule (TokenService artık Auth ve Users'ta ortak),
  @RequireConsent + ConsentGuard (APP_GUARD), IsIanaTimezone doğrulayıcısı
- Seed: test kullanıcısına hedef ve HEALTH_DATA onayı (idempotent)
- Kontroller: `npm test` 89 geçti (11 dosya), `npm run test:e2e` 57 geçti
  (3 dosya), lint / tsc / build temiz. Canlı: /me, /me/goals, /me/consents,
  Swagger'da 16 yol.
- Codex için inceleme önerisi: src/users/consents.service.ts (geçmiş mantığı),
  src/users/account.service.ts (cascade silme), test/users.e2e-spec.ts.
- Sıradaki iş: Aşama 6 — cihaz ve kalibrasyon (Device, DeviceSettings,
  Calibration modelleri → migration). Sahibi belirlenmeli.
