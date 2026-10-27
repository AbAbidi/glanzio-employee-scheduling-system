import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Trust only a deliberately configured local reverse proxy, never arbitrary
  // X-Forwarded-For supplied by the public internet.
  if (configService.get<string>('TRUST_PROXY') === 'loopback') {
    app.set('trust proxy', 'loopback');
  }

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: configService
      .get<string>('CORS_ORIGIN', 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  await app.listen(configService.get<number>('PORT', 3000));
}

void bootstrap();
