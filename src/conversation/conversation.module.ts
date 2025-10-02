import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { FileModule } from '../file/file.module';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { OpenAiModule } from '../openai/openai.module';
import { SpaceMemberModule } from '../space-member/space-member.module';

@Module({
  imports: [
    PrismaModule,
    FileModule,
    ConfigModule,
    OpenAiModule,
    SpaceMemberModule,
  ],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule {}
