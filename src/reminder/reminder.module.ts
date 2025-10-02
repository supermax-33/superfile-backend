import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ReminderController } from './reminder.controller';
import { ReminderService } from './reminder.service';
import { SpaceMemberModule } from 'src/space-member/space-member.module';

@Module({
  imports: [PrismaModule, SpaceMemberModule],
  controllers: [ReminderController],
  providers: [ReminderService],
})
export class ReminderModule {}
