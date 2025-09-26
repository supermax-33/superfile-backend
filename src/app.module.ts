import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { SpaceModule } from './space/space.module';
import { SessionModule } from './sessions/session.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    SpaceModule,
    SessionModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
