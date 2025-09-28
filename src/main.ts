import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips properties that do not have decorators
      forbidNonWhitelisted: true, // throws error if unknown properties are present
      transform: true, // auto-transform payloads to DTO instances
    }),
  );
  app.setGlobalPrefix('api');
  app.enableVersioning();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
