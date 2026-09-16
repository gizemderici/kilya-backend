import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './config/env.js';
import { setupSwagger } from './swagger.js';

async function bootstrap() {
  // Açılış logları da pino'dan geçsin diye logger hazır olana kadar tamponla.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);

  const config = app.get(ConfigService<Env, true>);
  const nodeEnv = config.get('NODE_ENV', { infer: true });

  // Üretimde API dokümanı açık olmasın.
  if (nodeEnv !== 'production') {
    setupSwagger(app, { writeFile: nodeEnv === 'development' });
  }

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
