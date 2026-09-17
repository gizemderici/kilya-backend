# Kilya — ortak durum ve görev devri

Son kontrol: 17 Eylül 2026, Codex.
İncelenen commit: `5db1a4d`, branch: `main`.
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
| Claude Code | Aşama 4 — Kimlik doğrulama (4.1–4.8) | src/auth/**, src/users/**, src/common/guards/**, src/common/decorators/**, src/types/express.d.ts, src/health/health.controller.ts (@Public), src/app.module.ts, test/auth.e2e-spec.ts, test/app.e2e-spec.ts; 4.8 için docker-compose.yml (Mailpit), package.json/package-lock.json (nodemailer), .env.example, src/config/env.ts | Devam ediyor — 4.1–4.3 main'de (7ce1255, 1d590d0); 4.4 feat/auth-refresh branch'inde |

Claude Code Aşama 4 (Auth) üzerinde çalışıyor; yukarıdaki dosya kapsamına
Codex dokunmamalı. Codex tamamlanan değişiklikleri inceler ve test açıklarını
bildirir. İki tarafın kod yazacağı görevlerde önce dosya kapsamı bu tabloda
belirlenir.

Çalışma biçimi (Claude Code): her iş için `feat/auth-*` branch'i, iş bitince
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
