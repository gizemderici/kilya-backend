import {
  type INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import helmet from 'helmet';

/**
 * Uygulamanın global ayarları. main.ts ve e2e testleri aynı ayarlarla
 * çalışsın diye tek bir yerde tutuluyor.
 */
export function configureApp(app: INestApplication): void {
  // Tüm adresler /api/v1/... şeklinde olur.
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO'da tanımlı olmayan alanları at
      forbidNonWhitelisted: true, // bilinmeyen alan gelirse 400 dön
      transform: true, // gövdeyi DTO sınıfına, "5" gibi değerleri number'a çevir
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Swagger arayüzü http üzerinden (localhost ya da yerel ağ IP'si)
          // açılırken dosyaların https'e yönlendirilip yüklenememesini önler.
          upgradeInsecureRequests: null,
        },
      },
    }),
  );

  // SIGTERM gibi sinyallerde onModuleDestroy çalışsın
  // (ör. PrismaService bağlantıyı düzgün kapatsın).
  app.enableShutdownHooks();
}
