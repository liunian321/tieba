import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import process from 'process';

async function bootstrap() {
  const logger = new Logger();
  const app = await NestFactory.create(AppModule, {
    logger,
  });

  process.on('unhandledRejection', (err: Error) => {
    logger.error('发生未处理的拒绝', { err });
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
