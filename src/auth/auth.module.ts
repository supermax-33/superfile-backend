import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { SessionModule } from 'src/sessions/session.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtExceptionFilter } from './filters/jwt-exception.filter';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MailModule,
    SessionModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'super-secret-key'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_TOKEN_TTL', '15m'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, JwtExceptionFilter],
})
export class AuthModule {}
