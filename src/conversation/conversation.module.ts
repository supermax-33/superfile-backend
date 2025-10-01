import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { FileModule } from '../file/file.module';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { OpenAiModule } from '../openai/openai.module';

@Module({
  imports: [PrismaModule, FileModule, ConfigModule, OpenAiModule],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule {}
