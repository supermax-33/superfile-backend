import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  const config = new DocumentBuilder()
    .setTitle('Superfile APIs')
    .setDescription('API endpoints for the Superfile platform.')
    .setVersion('1.0')
    .addServer('http://localhost:3000', 'Local development server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Paste the access token returned from the login, refresh token, or reset password endpoints.',
      },
      'access-token',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('sessions', 'User session management endpoints')
    .addTag('spaces', 'Space management endpoints')
    .addTag('files', 'File management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
