import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './config/env.js';
import { setupSwagger } from './swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
