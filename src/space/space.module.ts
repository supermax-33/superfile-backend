import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OpenAiModule } from '../openai/openai.module';
import { SpaceController } from './space.controller';
import { SpaceOwnerGuard } from './guards/space-owner.guard';
import { SpaceService } from './space.service';

@Module({
  imports: [PrismaModule, OpenAiModule],
  controllers: [SpaceController],
  providers: [SpaceService, SpaceOwnerGuard],
  exports: [SpaceService],
})
export class SpaceModule {}
