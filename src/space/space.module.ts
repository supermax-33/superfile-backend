import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SpaceController } from './space.controller';
import { SpaceOwnerGuard } from './guards/space-owner.guard';
import { SpaceService } from './space.service';

@Module({
  imports: [PrismaModule],
  controllers: [SpaceController],
  providers: [SpaceService, SpaceOwnerGuard],
  exports: [SpaceService],
})
export class SpaceModule {}
