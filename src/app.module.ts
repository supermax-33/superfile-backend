import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { SpaceModule } from './space/space.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, SpaceModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
