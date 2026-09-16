import { writeFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

interface SwaggerOptions {
  /** openapi.json dosyasını proje köküne yaz (Kotlin istemcisi bundan üretilir). */
  writeFile: boolean;
}

/**
 * Swagger arayüzü: http://localhost:3000/docs
 * Ham OpenAPI JSON:  http://localhost:3000/docs/json
 */
export function setupSwagger(
  app: INestApplication,
  { writeFile }: SwaggerOptions,
): void {
  const config = new DocumentBuilder()
    .setTitle('Kilya API')
    .setDescription('KILYA duruş takip uygulamasının backend API’si')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/json',
  });

  if (writeFile) {
    writeFileSync('openapi.json', `${JSON.stringify(document, null, 2)}\n`);
  }
}
