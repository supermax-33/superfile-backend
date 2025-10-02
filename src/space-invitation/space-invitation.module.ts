import { Module } from '@nestjs/common';

import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SpaceMemberModule } from '../space-member/space-member.module';
import { SpaceInvitationController } from './space-invitation.controller';
import { SpaceInvitationService } from './space-invitation.service';

@Module({
  imports: [PrismaModule, MailModule, SpaceMemberModule],
  controllers: [SpaceInvitationController],
  providers: [SpaceInvitationService],
  exports: [SpaceInvitationService],
})
export class SpaceInvitationModule {}
