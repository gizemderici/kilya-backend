# Kilya ortak çalışma yönergeleri

- Çalışmaya başlamadan `docs/ISBIRLIGI.md`, `docs/yol-haritasi.md` ve `git status --short` çıktısını oku.
- Bu klasör backend Git deposudur. Üstteki Kilya klasörü Git deposu değildir.
- Kullanıcıyla Türkçe iletişim kur. Mevcut NestJS, TypeScript ESM ve Prisma düzenini koru.
- Claude Code ve Codex aynı dosyaları kullanabilir. Diğer aracın oturumunu veya niyetini dosyalardan bildiğini varsayma.
- Kod değişikliğinden önce ortak durum dosyasına görevini ve değiştireceğin dosyaları yaz. Diğer aracın aktif göreviyle çakışıyorsa farklı bir iş seç veya görev devrini netleştir. Bu dosya otomatik kilit değildir.
- Aynı dosyada eşzamanlı düzenleme yapma. Başkasının mevcut değişikliklerini geri alma; commit veya branch işlemlerinden önce durum ve diff'i yeniden kontrol et.
- Şema, migration, package.json ve package-lock.json değişikliklerini tek görev sahibi yürütmeli.
- `.env` içeriğini ve gizli değerleri raporlara, loglara veya Git'e koyma. Veritabanı sıfırlama komutlarını rutin kontrol için çalıştırma.
- Kontroller: `npm test`, `npm run lint`, `npx tsc --noEmit --incremental false`. E2E testlerinin şu anda geliştirme veritabanına yazdığını dikkate al; hedef veritabanını doğrulamadan çalıştırma.
- İş bitince ortak durum dosyasına değişiklikleri, kontrol sonuçlarını ve sıradaki işi kaydet. Yol haritasında yalnızca doğrulanan işleri tamamlandı işaretle.
