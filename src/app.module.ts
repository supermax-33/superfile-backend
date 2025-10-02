import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { SpaceModule } from './space/space.module';
import { SessionModule } from './sessions/session.module';
import { FileModule } from './file/file.module';
import { ConversationModule } from './conversation/conversation.module';
import { ReminderModule } from './reminder/reminder.module';
import { SpaceMemberModule } from './space-member/space-member.module';
import { SpaceInvitationModule } from './space-invitation/space-invitation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    SpaceModule,
    SpaceMemberModule,
    SpaceInvitationModule,
    SessionModule,
    FileModule,
    ConversationModule,
    ReminderModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
