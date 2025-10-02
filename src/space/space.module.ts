import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OpenAiModule } from '../openai/openai.module';
import { SpaceController } from './space.controller';
import { SpaceService } from './space.service';
import { SpaceMemberModule } from '../space-member/space-member.module';

@Module({
  imports: [PrismaModule, OpenAiModule, SpaceMemberModule],
  controllers: [SpaceController],
  providers: [SpaceService],
  exports: [SpaceService],
})
export class SpaceModule {}
