import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { SpaceModule } from './space/space.module';
import { SessionModule } from './sessions/session.module';
import { FileModule } from './file/file.module';
import { ConversationModule } from './conversation/conversation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    SpaceModule,
    SessionModule,
    FileModule,
    ConversationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
