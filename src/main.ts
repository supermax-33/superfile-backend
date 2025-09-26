import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableVersioning();

  const config = new DocumentBuilder()
    .setTitle('Superfile Authentication API')
    .setDescription(
      'Authentication endpoints for the Superfile platform. Use these routes to register, verify OTP codes, manage sessions, and perform Google sign-ins from web or mobile clients.',
    )
    .setVersion('1.0')
    .addServer('http://localhost:3000', 'Local development server')
    .addServer('https://api.superfile.local', 'Staging/production gateway')
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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
